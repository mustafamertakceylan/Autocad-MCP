#include "platform.hpp"
#include "bridge.hpp"
#include <shellapi.h>
#include <commctrl.h>
#include <gdiplus.h>
#include <atomic>
#include <map>
#include <thread>
#include <memory>
#include <algorithm>
#include <cstring>
#pragma comment(linker, "\"/manifestdependency:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")

namespace {
using mcp::json;
std::wstring wide(const std::string &s) {
    if (s.empty()) return {};
    int n = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, s.data(), static_cast<int>(s.size()), nullptr, 0);
    desktop::require(n > 0, "Invalid text"); std::wstring out(n, 0); MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, s.data(), static_cast<int>(s.size()), out.data(), n); return out;
}
std::string utf8(const std::wstring &s) {
    if (s.empty()) return {};
    int n = WideCharToMultiByte(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0, nullptr, nullptr);
    std::string out(n, 0); WideCharToMultiByte(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), out.data(), n, nullptr, nullptr); return out;
}
enum { HEADER = 100, SUBTITLE, CAD_STATUS, CLIENT_STATUS, HOST_LABEL, HOSTS, CONNECT, DISCONNECT, REFRESH, CONFIG_LABEL, WORKSPACE, BROWSE, CONFIGURE, OPEN_FOLDER, STARTUP, HINT, FEEDBACK, EXIT_APP, NAV_CONNECTION = 150, NAV_CLIENTS, NAV_SETTINGS, CLIENT_SETUP, OPEN_CODEX, OPEN_CLAUDE, OPEN_OPENCODE, HIDE_APP, NAV_GUIDE, GUIDE_CAD, GUIDE_MCP, GUIDE_CLIENT, GUIDE_PLUGIN_FOLDER, GUIDE_ACTION, GUIDE_COPY_COMMAND, GUIDE_COPY_ARGS, GUIDE_COMMAND_LABEL, GUIDE_COMMAND, GUIDE_ARGS_LABEL, GUIDE_ARGS, GUIDE_NOTE, GUIDE_STEP1 = 180, GUIDE_STEP2 = 182, GUIDE_STEP3 = 184, GUIDE_STEP4 = 186, TRAY_SHOW = 200, TRAY_CONNECT, TRAY_EXIT };
constexpr UINT tray_message = WM_APP + 82, agent_message = WM_APP + 83, agent_closed = WM_APP + 84;
std::filesystem::path exe, state_root, server_root, hosts_root, cad_root;
bool custom_root = false, tray_start = false, exiting = false, snapshot_pending = false, workspace_loaded = false;
HWND window = nullptr; HINSTANCE instance = nullptr; HANDLE instance_mutex = nullptr;
std::map<int, HWND> controls; HFONT regular_font = nullptr, header_font = nullptr;
NOTIFYICONDATAW tray{}; HICON tray_icon = nullptr; bool tray_added = false; UINT taskbar_created = 0;
json last_snapshot = json::object(); std::vector<std::string> host_ids; std::map<int, std::string> outstanding; int sequence = 0;
HANDLE agent_process = nullptr, agent_stdin = nullptr, agent_stdout = nullptr, agent_job = nullptr;
std::thread reader; std::atomic<bool> agent_live = false;
int scaled(int value) { return MulDiv(value, static_cast<int>(GetDpiForWindow(window)), 96); }
std::wstring text(HWND control) { int n = GetWindowTextLengthW(control); std::wstring value(n + 1, 0); GetWindowTextW(control, value.data(), n + 1); value.resize(n); return value; }
void feedback(const std::wstring &value, bool error = false);
#include "brand.hpp"
#include "guide.hpp"
void request(const std::string &method, json values = json::object()) {
    if (!agent_live || !agent_stdin) { feedback(L"Bağlantı yöneticisi çalışmıyor. Uygulamayı yeniden açın."); return; }
    if (outstanding.size() >= 8) return;
    int id = ++sequence; values["id"] = id; values["method"] = method;
    auto data = values.dump() + "\n"; DWORD written = 0;
    if (!WriteFile(agent_stdin, data.data(), static_cast<DWORD>(data.size()), &written, nullptr) || written != data.size()) { feedback(L"Yerel bağlantı yöneticisine ulaşılamıyor."); return; }
    outstanding[id] = method; if (method == "snapshot") snapshot_pending = true;
}
void refresh() { if (!snapshot_pending) request("snapshot"); }
HICON status_icon(COLORREF color) {
    BITMAPV5HEADER header{}; header.bV5Size = sizeof(header); header.bV5Width = 32; header.bV5Height = -32; header.bV5Planes = 1; header.bV5BitCount = 32; header.bV5Compression = BI_BITFIELDS;
    header.bV5RedMask = 0x00ff0000; header.bV5GreenMask = 0x0000ff00; header.bV5BlueMask = 0x000000ff; header.bV5AlphaMask = 0xff000000;
    void *pixels = nullptr; HDC dc = GetDC(nullptr); HBITMAP bitmap = CreateDIBSection(dc, reinterpret_cast<BITMAPINFO *>(&header), DIB_RGB_COLORS, &pixels, nullptr, 0); ReleaseDC(nullptr, dc);
    if (!bitmap) return CopyIcon(LoadIconW(nullptr, IDI_APPLICATION));
    auto *data = static_cast<DWORD *>(pixels);
    for (int y = 0; y < 32; y++) for (int x = 0; x < 32; x++) {
        int dx = x - 15, dy = y - 15; bool in = dx * dx + dy * dy <= 180;
        data[y * 32 + x] = in ? 0xff000000 | (GetRValue(color) << 16) | (GetGValue(color) << 8) | GetBValue(color) : 0;
    }
    HBITMAP mask = CreateBitmap(32, 32, 1, 1, nullptr); ICONINFO info{TRUE, 0, 0, mask, bitmap}; HICON icon = CreateIconIndirect(&info); DeleteObject(mask); DeleteObject(bitmap); return icon;
}
void update_tray() {
    bool connected = last_snapshot.value("connected", false); size_t count = last_snapshot.contains("hosts") ? last_snapshot["hosts"].size() : 0;
    auto color = connected ? RGB(24, 142, 78) : count ? RGB(210, 138, 15) : RGB(115, 122, 134);
    auto next = branding::status_icon(color); if (!next) next = status_icon(color); auto old = tray_icon; tray_icon = next;
    SendMessageW(window, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(next)); SendMessageW(window, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(next));
    tray.cbSize = sizeof(tray); tray.hWnd = window; tray.uID = 1; tray.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP; tray.uCallbackMessage = tray_message; tray.hIcon = tray_icon;
    std::wstring status = connected ? L"Autocad MCP — AutoCAD bağlı" : count ? L"Autocad MCP — Bağlanmaya hazır" : L"Autocad MCP — AutoCAD bekleniyor";
    wcsncpy_s(tray.szTip, status.c_str(), _TRUNCATE);
    if (!Shell_NotifyIconW(tray_added ? NIM_MODIFY : NIM_ADD, &tray)) { tray_added = false; if (old) DestroyIcon(old); return; }
    tray_added = true; tray.uVersion = NOTIFYICON_VERSION_4; Shell_NotifyIconW(NIM_SETVERSION, &tray);
    if (old) DestroyIcon(old);
}
#include "view.hpp"
void feedback(const std::wstring &value, bool error) {
    view::notice = value; view::notice_error = error; view::notice_until = GetTickCount64() + 12000;
    SetWindowTextW(controls[FEEDBACK], value.c_str()); ShowWindow(controls[FEEDBACK], value.empty() ? SW_HIDE : SW_SHOW); InvalidateRect(window, nullptr, FALSE);
}
void show() { ShowWindow(window, SW_RESTORE); SetForegroundWindow(window); }
void connect_selected() {
    auto index = SendMessageW(controls[HOSTS], LB_GETCURSEL, 0, 0);
    if (index == LB_ERR || static_cast<size_t>(index) >= host_ids.size()) { feedback(L"Bağlanılacak AutoCAD oturumunu seçin."); show(); return; }
    request("connect", {{"hostId", host_ids[static_cast<size_t>(index)]}}); feedback(L"AutoCAD bağlantısı doğrulanıyor…");
}
void apply_snapshot(const json &data) {
    if (!data.contains("hosts") || !data["hosts"].is_array()) return;
    std::string selected; auto old = SendMessageW(controls[HOSTS], LB_GETCURSEL, 0, 0);
    if (old != LB_ERR && static_cast<size_t>(old) < host_ids.size()) selected = host_ids[static_cast<size_t>(old)];
    bool hosts_changed = !last_snapshot.contains("hosts") || last_snapshot["hosts"] != data["hosts"];
    last_snapshot = data;
    if (!workspace_loaded) { if (data.contains("workspace") && data["workspace"].is_string()) SetWindowTextW(controls[WORKSPACE], wide(data["workspace"].get<std::string>()).c_str()); workspace_loaded = true; }
    if (hosts_changed) {
    host_ids.clear(); SendMessageW(controls[HOSTS], WM_SETREDRAW, FALSE, 0); SendMessageW(controls[HOSTS], LB_RESETCONTENT, 0, 0);
    for (const auto &host : data["hosts"]) {
        host_ids.push_back(host.at("hostId").get<std::string>());
        std::wstring label = L"AutoCAD 2027    ·    Oturum " + std::to_wstring(host.at("processId").get<int>());
        label += host.value("compatible", false) ? L"    ·    Hazır" : L"    ·    Eklenti sürümü uyumsuz";
        SendMessageW(controls[HOSTS], LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(label.c_str()));
        if (host_ids.back() == selected) SendMessageW(controls[HOSTS], LB_SETCURSEL, host_ids.size() - 1, 0);
    }
    if (host_ids.size() == 1) SendMessageW(controls[HOSTS], LB_SETCURSEL, 0, 0);
    SendMessageW(controls[HOSTS], WM_SETREDRAW, TRUE, 0); InvalidateRect(controls[HOSTS], nullptr, FALSE);
    }
    bool connected = data.value("connected", false); auto clients = data.value("clientCount", 0);
    std::wstring status = !agent_live ? L"Bağlantı yöneticisi kapalı" : connected ? L"AutoCAD'e bağlı" : host_ids.empty() ? L"AutoCAD bekleniyor" : L"Bağlanmaya hazır";
    SetWindowTextW(controls[CAD_STATUS], status.c_str());
    std::wstring hint = connected ? std::to_wstring(data.value("documentCount", 0)) + L" çizim  ·  " + std::to_wstring(data.value("toolCount", 0)) + L" araç kullanıma hazır" : host_ids.empty() ? L"AutoCAD 2027'yi açın. Eklenti hazır olduğunda burada görünecek." : L"Oturumunuzu seçin ve bağlantıyı başlatın.";
    SetWindowTextW(controls[HINT], hint.c_str());
    auto client_status = clients ? std::to_wstring(clients) + L" AI istemcisi bağlı" : L"AI istemcisi bekleniyor";
    SetWindowTextW(controls[CLIENT_STATUS], client_status.c_str());
    EnableWindow(controls[CONNECT], !host_ids.empty()); EnableWindow(controls[DISCONNECT], connected);
    SetWindowTextW(controls[CONNECT], connected ? L"Yeniden bağlan" : L"AutoCAD'e bağlan");
    layout(); update_tray();
}
void browse() {
    IFileOpenDialog *dialog = nullptr;
    if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog)))) return;
    DWORD options = 0; dialog->GetOptions(&options); dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM); dialog->SetTitle(L"Yeni veya boş istemci klasörünü seçin");
    if (SUCCEEDED(dialog->Show(window))) {
        IShellItem *item = nullptr; if (SUCCEEDED(dialog->GetResult(&item))) { PWSTR path = nullptr; if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path))) { SetWindowTextW(controls[WORKSPACE], path); CoTaskMemFree(path); } item->Release(); }
    }
    dialog->Release();
}
void open_plugin_folder() {
    auto folder = server_root.parent_path() / L"Win64";
    if (!std::filesystem::is_regular_file(folder / L"AutocadMcp.arx")) {
        wchar_t roaming[32768]{}; auto size = GetEnvironmentVariableW(L"APPDATA", roaming, 32768);
        if (size && size < 32768) { auto installed = std::filesystem::path(roaming) / L"Autodesk" / L"ApplicationPlugins" / L"AutocadMcp.bundle" / L"Contents" / L"Win64"; if (std::filesystem::is_regular_file(installed / L"AutocadMcp.arx")) folder = installed; }
    }
    if (std::filesystem::is_regular_file(folder / L"AutocadMcp.arx")) ShellExecuteW(window, L"open", folder.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    else feedback(L"Eklenti bulunamadı. İndirdiğin paketten install.cmd'yi çalıştır.", true);
}
void stop_agent() {
    if (agent_stdin) { const std::string message = "{\"id\":999999,\"method\":\"exit\"}\n"; DWORD n = 0; WriteFile(agent_stdin, message.data(), static_cast<DWORD>(message.size()), &n, nullptr); CloseHandle(agent_stdin); agent_stdin = nullptr; }
    if (agent_process && WaitForSingleObject(agent_process, 3000) != WAIT_OBJECT_0) TerminateProcess(agent_process, 1);
    if (agent_job) { CloseHandle(agent_job); agent_job = nullptr; }
    if (reader.joinable()) reader.join();
    if (agent_stdout) { CloseHandle(agent_stdout); agent_stdout = nullptr; }
    if (agent_process) { CloseHandle(agent_process); agent_process = nullptr; }
}
void start_agent() {
    SECURITY_ATTRIBUTES attrs{sizeof(attrs), nullptr, TRUE}; HANDLE input = nullptr, output = nullptr;
    desktop::require(CreatePipe(&input, &agent_stdin, &attrs, 0) && CreatePipe(&agent_stdout, &output, &attrs, 0), "Agent pipes unavailable");
    SetHandleInformation(agent_stdin, HANDLE_FLAG_INHERIT, 0); SetHandleInformation(agent_stdout, HANDLE_FLAG_INHERIT, 0);
    HANDLE null = CreateFileW(L"NUL", GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, &attrs, OPEN_EXISTING, 0, nullptr);
    auto node = server_root / L"runtime" / L"node.exe", script = server_root / L"dist" / L"src" / L"desktop-agent.js";
    desktop::require(std::filesystem::is_regular_file(node) && std::filesystem::is_regular_file(script), "Packaged Node/desktop agent missing");
    auto command = desktop::quote(node.wstring()) + L" " + desktop::quote(script.wstring()) + L" --state-root " + desktop::quote(state_root.wstring());
    if (!hosts_root.empty()) command += L" --hosts-root " + desktop::quote(hosts_root.wstring());
    if (!cad_root.empty()) command += L" --cad-root " + desktop::quote(cad_root.wstring());
    STARTUPINFOW startup{}; startup.cb = sizeof(startup); startup.dwFlags = STARTF_USESTDHANDLES; startup.hStdInput = input; startup.hStdOutput = output; startup.hStdError = null;
    PROCESS_INFORMATION process{}; BOOL created = CreateProcessW(node.c_str(), command.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW | CREATE_SUSPENDED, nullptr, server_root.c_str(), &startup, &process);
    CloseHandle(input); CloseHandle(output); CloseHandle(null); desktop::require(created != FALSE, "Desktop agent unavailable");
    agent_process = process.hProcess; agent_job = CreateJobObjectW(nullptr, nullptr);
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{}; limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if (!agent_job || !SetInformationJobObject(agent_job, JobObjectExtendedLimitInformation, &limits, sizeof(limits)) || !AssignProcessToJobObject(agent_job, process.hProcess)) { TerminateProcess(process.hProcess, 1); CloseHandle(process.hThread); throw std::runtime_error("Desktop agent lifetime unavailable"); }
    ResumeThread(process.hThread); CloseHandle(process.hThread); agent_live = true;
    reader = std::thread([] {
        char bytes[4096]; DWORD count = 0; std::string buffer;
        while (ReadFile(agent_stdout, bytes, sizeof(bytes), &count, nullptr) && count) {
            buffer.append(bytes, count); if (buffer.size() > 65536) break;
            size_t end;
            while ((end = buffer.find('\n')) != std::string::npos) {
                try { auto data = std::make_unique<json>(mcp::parse(buffer.substr(0, end))); if (PostMessageW(window, agent_message, 0, reinterpret_cast<LPARAM>(data.get()))) data.release(); } catch (...) {}
                buffer.erase(0, end + 1);
            }
        }
        agent_live = false; PostMessageW(window, agent_closed, 0, 0);
    });
}
LRESULT CALLBACK procedure(HWND hwnd, UINT message, WPARAM w, LPARAM l) {
    if (message == taskbar_created && taskbar_created) { tray_added = false; update_tray(); return 0; }
    if (message == WM_SIZE) { if (w == SIZE_MINIMIZED) ShowWindow(hwnd, SW_HIDE); else if (!controls.empty()) layout(); return 0; }
    if (message == WM_ERASEBKGND) return 1;
    if (message == WM_PAINT) {
        PAINTSTRUCT ps{}; HDC dc = BeginPaint(hwnd, &ps); RECT bounds{}; GetClientRect(hwnd, &bounds);
        HDC buffer = CreateCompatibleDC(dc); HBITMAP bitmap = CreateCompatibleBitmap(dc, bounds.right, bounds.bottom); auto old = SelectObject(buffer, bitmap);
        view::paint(buffer); BitBlt(dc, 0, 0, bounds.right, bounds.bottom, buffer, 0, 0, SRCCOPY); SelectObject(buffer, old); DeleteObject(bitmap); DeleteDC(buffer); EndPaint(hwnd, &ps); return 0;
    }
    if (message == WM_DRAWITEM) { auto &item = *reinterpret_cast<DRAWITEMSTRUCT *>(l); if (item.CtlType == ODT_STATIC) view::guide_text(item); else if (item.CtlID == HOSTS) view::list_item(item); else view::button(item); return TRUE; }
    if (message == WM_MEASUREITEM) { auto *item = reinterpret_cast<MEASUREITEMSTRUCT *>(l); if (item->CtlID == HOSTS) item->itemHeight = scaled(48); return TRUE; }
    if (message == WM_CTLCOLORSTATIC || message == WM_CTLCOLOREDIT || message == WM_CTLCOLORBTN || message == WM_CTLCOLORLISTBOX) {
        HDC dc = reinterpret_cast<HDC>(w); int id = GetDlgCtrlID(reinterpret_cast<HWND>(l)); bool dark = id == CAD_STATUS || id == HINT;
        auto background = dark ? view::hero : (id == FEEDBACK || id == CONFIG_LABEL || id == GUIDE_NOTE || id == GUIDE_COMMAND_LABEL || id == GUIDE_ARGS_LABEL) ? view::background : RGB(255, 255, 255);
        SetBkMode(dc, TRANSPARENT); SetBkColor(dc, background); SetDCBrushColor(dc, background);
        SetTextColor(dc, dark ? (id == HINT ? RGB(224, 191, 198) : RGB(255, 255, 255)) : id == FEEDBACK ? (view::notice_error ? RGB(169, 45, 45) : view::accent) : (id == GUIDE_NOTE || (id >= GUIDE_STEP1 && id <= GUIDE_STEP4 + 1 && (id - GUIDE_STEP1) % 2 == 1)) ? view::muted : view::ink);
        return reinterpret_cast<LRESULT>(GetStockObject(DC_BRUSH));
    }
    if (message == WM_GETMINMAXINFO) { auto *info = reinterpret_cast<MINMAXINFO *>(l); UINT dpi = GetDpiForWindow(hwnd); if (!dpi) dpi = 96; info->ptMinTrackSize = {MulDiv(760, dpi, 96), MulDiv(730, dpi, 96)}; return 0; }
    if (message == WM_DPICHANGED) { auto *bounds = reinterpret_cast<RECT *>(l); SetWindowPos(hwnd, nullptr, bounds->left, bounds->top, bounds->right - bounds->left, bounds->bottom - bounds->top, SWP_NOZORDER | SWP_NOACTIVATE); fonts(); layout(); return 0; }
    if (message == WM_TIMER) { if (!tray_added) update_tray(); if (!view::notice.empty() && GetTickCount64() > view::notice_until) feedback(L""); refresh(); return 0; }
    if (message == WM_CLOSE) { ShowWindow(hwnd, SW_HIDE); return 0; }
    if (message == agent_closed) { if (!exiting) { snapshot_pending = false; last_snapshot = json::object(); SetWindowTextW(controls[CAD_STATUS], L"Bağlantı yöneticisi kapalı"); SetWindowTextW(controls[HINT], L"Uygulamayı tamamen kapatıp yeniden açın."); SetWindowTextW(controls[CLIENT_STATUS], L"Bağlantı denetlenemiyor"); host_ids.clear(); EnableWindow(controls[CONNECT], FALSE); EnableWindow(controls[DISCONNECT], FALSE); feedback(L"Yerel bağlantı yöneticisine ulaşılamıyor.", true); layout(); update_tray(); } return 0; }
    if (message == agent_message) {
        std::unique_ptr<json> data(reinterpret_cast<json *>(l)); int id = data->value("id", 0);
        if (id == 0 && data->value("ready", false)) { refresh(); return 0; }
        auto it = outstanding.find(id); if (it == outstanding.end()) return 0; auto method = it->second; outstanding.erase(it);
        if (method == "snapshot") snapshot_pending = false;
        if (!data->value("ok", false)) { feedback(wide(data->value("error", std::string("İşlem tamamlanamadı."))), true); return 0; }
        if ((method == "snapshot" || method == "connect" || method == "disconnect") && data->contains("result")) { apply_snapshot((*data)["result"]); if (method != "snapshot") feedback(method == "connect" ? L"AutoCAD bağlantısı hazır." : L"Bağlantı kesildi. AutoCAD açık kalır."); }
        if (method == "configure") { feedback(L"Klasörler hazır. İstemcinizi kendi klasöründe açın."); layout(); }
        return 0;
    }
    if (message == tray_message) {
        auto event = LOWORD(l);
        if (event == NIN_SELECT || event == NIN_KEYSELECT || event == WM_LBUTTONDBLCLK) show();
        else if (event == WM_CONTEXTMENU || event == WM_RBUTTONUP) {
            HMENU menu = CreatePopupMenu(); AppendMenuW(menu, MF_STRING, TRAY_SHOW, L"Durumu göster"); AppendMenuW(menu, MF_STRING, TRAY_CONNECT, L"Seçili AutoCAD'e bağlan"); AppendMenuW(menu, MF_SEPARATOR, 0, nullptr); AppendMenuW(menu, MF_STRING, TRAY_EXIT, L"Çıkış ve bağlantıyı kes");
            POINT point{}; GetCursorPos(&point); SetForegroundWindow(hwnd); TrackPopupMenu(menu, TPM_RIGHTBUTTON, point.x, point.y, 0, hwnd, nullptr); DestroyMenu(menu); PostMessageW(hwnd, WM_NULL, 0, 0);
        }
        return 0;
    }
    if (message == WM_COMMAND) {
        try {
            if (LOWORD(w) == WORKSPACE && HIWORD(w) == EN_CHANGE) { if (view::page == 1) { bool ready = view::prepared(); for (int id : {OPEN_CODEX, OPEN_CLAUDE, OPEN_OPENCODE, OPEN_FOLDER}) EnableWindow(controls[id], ready); } return 0; }
            if (LOWORD(w) == GUIDE_CLIENT && HIWORD(w) == CBN_SELCHANGE) { auto index = SendMessageW(controls[GUIDE_CLIENT], CB_GETCURSEL, 0, 0); if (index >= 0 && index <= 4) guide::client = static_cast<int>(index); layout(); return 0; }
            switch (LOWORD(w)) {
            case NAV_CONNECTION: case NAV_CLIENTS: case NAV_SETTINGS: view::page = LOWORD(w) - NAV_CONNECTION; layout(); break;
            case NAV_GUIDE: view::page = 3; layout(); break;
            case GUIDE_CAD: case GUIDE_MCP: guide::stage = LOWORD(w) == GUIDE_CAD ? 0 : 1; view::page = 3; layout(); break;
            case GUIDE_ACTION: view::page = guide::stage == 0 ? 3 : 1; if (guide::stage == 0) guide::stage = 1; layout(); break;
            case GUIDE_COPY_COMMAND: guide::copy(guide::command()); break;
            case GUIDE_COPY_ARGS: guide::copy(guide::argument_lines()); break;
            case GUIDE_PLUGIN_FOLDER: open_plugin_folder(); break;
            case CLIENT_SETUP: view::page = 3; guide::stage = 1; layout(); SetFocus(controls[NAV_GUIDE]); break;
            case TRAY_SHOW: show(); break;
            case CONNECT: case TRAY_CONNECT: connect_selected(); break;
            case DISCONNECT: request("disconnect"); break;
            case REFRESH: refresh(); break;
            case BROWSE: browse(); break;
            case CONFIGURE: request("configure", {{"workspace", utf8(text(controls[WORKSPACE]))}}); feedback(L"İstemci bağlantı klasörleri hazırlanıyor…"); break;
            case OPEN_FOLDER: { auto path = text(controls[WORKSPACE]); if (std::filesystem::is_directory(path)) ShellExecuteW(hwnd, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL); else feedback(L"Önce istemci ayarlarını hazırlayın."); break; }
            case OPEN_CODEX: case OPEN_CLAUDE: case OPEN_OPENCODE: { auto path = std::filesystem::path(text(controls[WORKSPACE])) / (LOWORD(w) == OPEN_CODEX ? L"codex" : LOWORD(w) == OPEN_CLAUDE ? L"claude" : L"opencode"); if (std::filesystem::is_directory(path)) ShellExecuteW(hwnd, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL); else feedback(L"Önce bağlantı dosyalarını hazırlayın.", true); break; }
            case HIDE_APP: ShowWindow(hwnd, SW_HIDE); break;
            case STARTUP: {
                if (custom_root) break;
                bool checked = SendMessageW(controls[STARTUP], BM_GETCHECK, 0, 0) == BST_CHECKED;
                desktop::set_startup(checked, exe); feedback(checked ? L"Windows açıldığında yalnız sistem tepsisinde başlayacak." : L"Windows açılışında otomatik başlama kapalı."); break;
            }
            case EXIT_APP: case TRAY_EXIT: exiting = true; KillTimer(hwnd, 1); stop_agent(); Shell_NotifyIconW(NIM_DELETE, &tray); DestroyWindow(hwnd); break;
            }
        } catch (...) { feedback(L"İşlem yapılamadı. Mevcut ayar veya dosya başka bir kuruluma ait olabilir."); try { if (!custom_root) SendMessageW(controls[STARTUP], BM_SETCHECK, desktop::startup_state(exe) == desktop::Startup::on ? BST_CHECKED : BST_UNCHECKED, 0); } catch (...) {} }
        return 0;
    }
    if (message == WM_DESTROY) { PostQuitMessage(0); return 0; }
    return DefWindowProcW(hwnd, message, w, l);
}
void build_controls() {
    auto add = [&](int id, const wchar_t *kind, const wchar_t *label, DWORD style) {
        controls[id] = CreateWindowExW(0, kind, label, WS_CHILD | style, 0, 0, 0, 0, window, reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)), instance, nullptr);
    };
    auto button = [&](int id, const wchar_t *label) { add(id, L"BUTTON", label, BS_OWNERDRAW | WS_TABSTOP); SetWindowSubclass(controls[id], view::hover_proc, 1, 0); };
    add(HEADER, L"STATIC", L"Autocad MCP", 0);
    add(CAD_STATUS, L"STATIC", L"Bağlantı denetleniyor", 0); add(CLIENT_STATUS, L"STATIC", L"AI istemcisi bekleniyor", 0);
    add(HOST_LABEL, L"STATIC", L"AutoCAD oturumu", 0);
    add(HOSTS, L"LISTBOX", L"AutoCAD oturumu", WS_TABSTOP | LBS_NOTIFY | LBS_HASSTRINGS | LBS_OWNERDRAWFIXED | LBS_NOINTEGRALHEIGHT | WS_VSCROLL);
    button(CONNECT, L"AutoCAD'e bağlan"); button(DISCONNECT, L"Bağlantıyı kes"); button(REFRESH, L"Yenile");
    add(CONFIG_LABEL, L"STATIC", L"Bağlantı klasörü", 0); add(WORKSPACE, L"EDIT", (state_root / L"workspace").c_str(), ES_AUTOHSCROLL | WS_TABSTOP);
    button(BROWSE, L"Klasör seç"); button(CONFIGURE, L"Bağlantı dosyalarını hazırla"); button(OPEN_FOLDER, L"Klasörü aç");
    button(OPEN_CODEX, L"Codex klasörünü aç"); button(OPEN_CLAUDE, L"Claude klasörünü aç"); button(OPEN_OPENCODE, L"OpenCode klasörünü aç");
    button(NAV_CONNECTION, L"Bağlantı"); button(NAV_CLIENTS, L"İstemciler"); button(NAV_SETTINGS, L"Ayarlar"); button(CLIENT_SETUP, L"MCP rehberi");
    button(NAV_GUIDE, L"Kurulum rehberi"); button(GUIDE_CAD, L"1. AutoCAD'i hazırla"); button(GUIDE_MCP, L"2. MCP'yi bağla");
    add(GUIDE_CLIENT, WC_COMBOBOXW, L"MCP istemcisi", CBS_DROPDOWNLIST | WS_TABSTOP | WS_VSCROLL);
    for (auto choice : {L"Codex masaüstü / IDE", L"Codex CLI", L"Claude Code", L"OpenCode 1.x", L"Diğer STDIO istemcisi"}) SendMessageW(controls[GUIDE_CLIENT], CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(choice));
    SendMessageW(controls[GUIDE_CLIENT], CB_SETCURSEL, 0, 0);
    button(GUIDE_PLUGIN_FOLDER, L"Eklenti klasörünü aç"); button(GUIDE_ACTION, L"MCP adımına geç"); button(GUIDE_COPY_COMMAND, L"Komutu kopyala"); button(GUIDE_COPY_ARGS, L"Argümanları kopyala");
    add(GUIDE_COMMAND_LABEL, L"STATIC", L"Komut", 0); add(GUIDE_COMMAND, L"EDIT", L"", ES_AUTOHSCROLL | ES_READONLY | WS_TABSTOP);
    add(GUIDE_ARGS_LABEL, L"STATIC", L"Argümanlar (her satır ayrı)", 0); add(GUIDE_ARGS, L"EDIT", L"", ES_MULTILINE | ES_AUTOVSCROLL | ES_AUTOHSCROLL | ES_READONLY | WS_TABSTOP | WS_VSCROLL);
    add(GUIDE_NOTE, L"STATIC", L"", SS_OWNERDRAW);
    for (int i = 0; i < 4; i++) { add(GUIDE_STEP1 + i * 2, L"STATIC", L"", SS_OWNERDRAW); add(GUIDE_STEP1 + i * 2 + 1, L"STATIC", L"", SS_OWNERDRAW); }
    add(STARTUP, L"BUTTON", L"Windows ile başlat", BS_AUTOCHECKBOX | WS_TABSTOP);
    add(HINT, L"STATIC", L"AutoCAD 2027'yi açın. Hazır olduğunda burada görünecek.", 0);
    add(FEEDBACK, L"STATIC", L"", 0); button(EXIT_APP, L"Tamamen kapat"); button(HIDE_APP, L"Tepsiye gizle");
    EnableWindow(controls[CONNECT], FALSE); EnableWindow(controls[DISCONNECT], FALSE);
    if (custom_root) EnableWindow(controls[STARTUP], FALSE);
    else { try { SendMessageW(controls[STARTUP], BM_SETCHECK, desktop::startup_state(exe) == desktop::Startup::on ? BST_CHECKED : BST_UNCHECKED, 0); } catch (...) { EnableWindow(controls[STARTUP], FALSE); feedback(L"Windows başlangıç ayarına erişilemedi.", true); } }
    fonts(); layout();
}
} // namespace

int WINAPI wWinMain(HINSTANCE module, HINSTANCE, PWSTR, int) {
    instance = module; CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    Gdiplus::GdiplusStartupInput graphics_input; ULONG_PTR graphics_token = 0;
    if (Gdiplus::GdiplusStartup(&graphics_token, &graphics_input, nullptr) != Gdiplus::Ok) { CoUninitialize(); return 2; }
    struct GraphicsLifetime { ULONG_PTR token; ~GraphicsLifetime() { Gdiplus::GdiplusShutdown(token); } } graphics{graphics_token};
    struct BrandLifetime { ~BrandLifetime() { branding::clear(); } } brand_lifetime;
    try {
        branding::load(module);
        SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        exe = desktop::executable(); state_root = desktop::local_appdata() / L"AutocadMCP" / L"desktop";
        server_root = exe.parent_path().parent_path() / L"server";
        int count = 0; auto args = CommandLineToArgvW(GetCommandLineW(), &count); std::wstring maintenance;
        for (int i = 1; i < count; i++) {
            std::wstring arg(args[i]);
            if (arg == L"--tray") tray_start = true;
            else if (arg == L"--maintenance-check" || arg == L"--remove-startup" || arg == L"--register-shortcut" || arg == L"--unregister-shortcut") maintenance = arg;
            else if ((arg == L"--state-root" || arg == L"--server-root" || arg == L"--hosts-root" || arg == L"--cad-root") && i + 1 < count) {
                std::filesystem::path value(args[++i]); desktop::require(value.is_absolute(), "Absolute desktop paths required");
                if (arg == L"--state-root") { state_root = value; custom_root = true; }
                if (arg == L"--server-root") server_root = value;
                if (arg == L"--hosts-root") hosts_root = value;
                if (arg == L"--cad-root") cad_root = value;
            } else { LocalFree(args); return 2; }
        }
        LocalFree(args);
        if (!maintenance.empty()) {
            if (desktop::running(state_root)) return 3;
            if (maintenance == L"--maintenance-check") return 0;
            desktop::require(!custom_root && hosts_root.empty() && cad_root.empty(), "Maintenance requires installed user paths");
            if (maintenance == L"--remove-startup") desktop::set_startup(false, exe);
            if (maintenance == L"--register-shortcut") desktop::shortcut(true, exe);
            if (maintenance == L"--unregister-shortcut") desktop::shortcut(false, exe);
            return 0;
        }
        auto name = desktop::mutex_name(state_root); bool exists = false; instance_mutex = desktop::private_mutex(name, exists);
        std::wstring class_name = L"AutocadMcpDesktop." + name.substr(name.rfind(L'-') + 1);
        if (exists) { if (!tray_start) { auto previous = FindWindowW(class_name.c_str(), nullptr); if (previous) { ShowWindow(previous, SW_RESTORE); SetForegroundWindow(previous); } } CloseHandle(instance_mutex); return 0; }
        WNDCLASSEXW cls{}; cls.cbSize = sizeof(cls); cls.hInstance = instance; cls.lpfnWndProc = procedure; cls.lpszClassName = class_name.c_str(); cls.hCursor = LoadCursorW(nullptr, IDC_ARROW); cls.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1); cls.hIcon = LoadIconW(instance, MAKEINTRESOURCEW(101));
        desktop::require(RegisterClassExW(&cls) != 0, "Window registration failed");
        window = CreateWindowExW(0, class_name.c_str(), L"Autocad MCP", WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN, CW_USEDEFAULT, CW_USEDEFAULT, 860, 748, nullptr, nullptr, instance, nullptr);
        desktop::require(window != nullptr, "Window unavailable");
        auto dpi = GetDpiForWindow(window); SetWindowPos(window, nullptr, 0, 0, MulDiv(860, dpi, 96), MulDiv(748, dpi, 96), SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
        build_controls(); taskbar_created = RegisterWindowMessageW(L"TaskbarCreated"); update_tray();
        if (!tray_start) ShowWindow(window, SW_SHOW);
        SetTimer(window, 1, 2500, nullptr);
        try { start_agent(); } catch (...) { feedback(L"Bağlantı yöneticisi başlatılamadı. Paketin tamamını kurduğunuzdan emin olun."); }
        MSG message{}; while (GetMessageW(&message, nullptr, 0, 0) > 0) { if (!IsDialogMessageW(window, &message)) { TranslateMessage(&message); DispatchMessageW(&message); } }
        stop_agent(); if (tray_icon) DestroyIcon(tray_icon); for (auto font : {regular_font, header_font, view::small_font, view::strong_font, view::title_font}) if (font) DeleteObject(font); CloseHandle(instance_mutex); CoUninitialize(); return 0;
    } catch (...) { if (instance_mutex) CloseHandle(instance_mutex); CoUninitialize(); return 2; }
}
