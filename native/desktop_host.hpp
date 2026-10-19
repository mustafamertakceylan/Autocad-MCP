// Included on the AutoCAD UI thread after start/stop. No CAD command or file execution API.
struct DesktopStart {
    std::promise<json> result;
};
HWND desktop_window = nullptr;
std::mutex desktop_mutex;
std::deque<std::shared_ptr<DesktopStart>> desktop_pending;
json desktop_state = json::object();
bool desktop_stopping = false;
std::filesystem::path desktop_control_root;
json desktop_dispatch(const json &request);
void desktop_open_control() {
    desktop_host = std::make_unique<mcp::Runtime>(desktop_control_root, desktop_dispatch,
        std::vector<std::string>{"desktop_get_status", "desktop_start"}, AUTOCAD_MCP_BUILD_ID);
}

void desktop_sync() {
    // Only called by the host UI thread; workers read a copy under the mutex.
    std::lock_guard guard(desktop_mutex);
    desktop_state = {{"backend", "objectarx"}, {"simulation", false},
                     {"processId", GetCurrentProcessId()}, {"nativeBuildId", AUTOCAD_MCP_BUILD_ID},
                     {"bridgeStarted", runtime != nullptr},
                     {"cadGrantFile", runtime ? json(utf8(runtime->grant_file().c_str())) : json(nullptr)}};
}
LRESULT CALLBACK desktop_window_proc(HWND window, UINT message, WPARAM w, LPARAM l) {
    if (message == WM_TIMER && w == 80) {
        // Rotate management credentials before expiry; CAD pairing itself is renewed
        // only by an explicit Connect after its lifetime ends.
        bool idle = false; { std::lock_guard guard(desktop_mutex); idle = desktop_pending.empty(); }
        if (idle && (!desktop_host || desktop_host->expires_within(300000))) {
            desktop_host.reset(); try { desktop_open_control(); } catch (...) {}
        }
        return 0;
    }
    if (message == WM_APP + 80) {
        std::deque<std::shared_ptr<DesktopStart>> pending;
        { std::lock_guard guard(desktop_mutex); pending.swap(desktop_pending); }
        for (const auto &request : pending) {
            try {
                if (runtime && runtime->expires_within(0)) stop();
                if (!runtime) start();
                desktop_sync();
                std::lock_guard guard(desktop_mutex);
                request->result.set_value(desktop_state);
            } catch (...) { request->result.set_value(mcp::error("EXECUTION_FAILED", "Cannot prepare local bridge")); }
        }
        return 0;
    }
    return DefWindowProcW(window, message, w, l);
}
json desktop_dispatch(const json &request) {
    try {
        const auto method = request.at("method").get<std::string>();
        const auto &params = request.at("params");
        need(params.is_object() && params.size() == 1 && params.contains("instanceId"));
        if (method == "desktop_get_status") { std::lock_guard guard(desktop_mutex); return desktop_state; }
        need(method == "desktop_start");
        auto pending = std::make_shared<DesktopStart>(); auto result = pending->result.get_future();
        { std::lock_guard guard(desktop_mutex);
          need(!desktop_stopping && desktop_pending.size() < 4, "DOC_BUSY"); desktop_pending.push_back(pending); }
        if (!PostMessageW(desktop_window, WM_APP + 80, 0, 0)) return mcp::error("IPC_UNAVAILABLE", "Host UI unavailable");
        if (result.wait_for(std::chrono::seconds(8)) != std::future_status::ready)
            return mcp::error("DOC_BUSY", "AutoCAD UI is busy; refresh connection state");
        return result.get();
    } catch (...) { return mcp::error("SECURITY_DENIED", "Desktop management request rejected"); }
}
void desktop_initialize() {
    try {
        desktop_sync();
        WNDCLASSW cls{}; cls.lpfnWndProc = desktop_window_proc;
        cls.lpszClassName = L"AutocadMcpDesktopHost"; cls.hInstance = GetModuleHandleW(nullptr);
        need(RegisterClassW(&cls) != 0);
        desktop_window = CreateWindowW(cls.lpszClassName, L"", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, cls.hInstance, nullptr);
        need(desktop_window != nullptr);
        desktop_control_root = GetEnvironmentVariableW(L"MCP_RUNTIME_DIR", nullptr, 0) > 0
                        ? env_path(L"MCP_RUNTIME_DIR") / L"desktop-hosts"
                        : env_path(L"LOCALAPPDATA") / L"AutocadMCP" / L"desktop-hosts";
        need(desktop_control_root.is_absolute());
        if (!application_locked) { need(acrxLockApplication(application_id)); application_locked = true; }
        desktop_stopping = false;
        desktop_open_control(); SetTimer(desktop_window, 80, 60000, nullptr);
    } catch (...) {
        desktop_host.reset();
        if (desktop_window) { DestroyWindow(desktop_window); desktop_window = nullptr; }
        UnregisterClassW(L"AutocadMcpDesktopHost", GetModuleHandleW(nullptr));
        release_application_if_idle();
        acutPrintf(L"\nAutocad MCP desktop discovery unavailable; MCPSTART remains available.\n");
    }
}
void desktop_shutdown() {
    if (desktop_window) KillTimer(desktop_window, 80);
    { std::lock_guard guard(desktop_mutex); desktop_stopping = true;
      for (const auto &request : desktop_pending) request->result.set_value(mcp::error("IPC_UNAVAILABLE", "AutoCAD is closing"));
      desktop_pending.clear(); }
    desktop_host.reset();
    if (desktop_window) { DestroyWindow(desktop_window); desktop_window = nullptr; }
    UnregisterClassW(L"AutocadMcpDesktopHost", GetModuleHandleW(nullptr));
}
