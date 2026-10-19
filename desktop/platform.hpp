#pragma once
#include <windows.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <sddl.h>
#include <shellapi.h>
#include <filesystem>
#include <string>
#include <stdexcept>
#include <vector>

namespace desktop {
inline void require(bool ok, const char *message) { if (!ok) throw std::runtime_error(message); }
inline std::wstring quote(const std::wstring &value) {
    std::wstring result = L"\""; unsigned slashes = 0;
    for (auto c : value) {
        if (c == L'\\') { slashes++; continue; }
        if (c == L'"') { result.append(slashes * 2 + 1, L'\\'); result += c; }
        else { result.append(slashes, L'\\'); result += c; }
        slashes = 0;
    }
    result.append(slashes * 2, L'\\'); return result + L"\"";
}
inline std::filesystem::path executable() { wchar_t value[32768]{}; auto n = GetModuleFileNameW(nullptr, value, 32768); require(n && n < 32768, "Executable path unavailable"); return value; }
inline std::filesystem::path local_appdata() { wchar_t value[32768]{}; auto n = GetEnvironmentVariableW(L"LOCALAPPDATA", value, 32768); require(n && n < 32768, "LOCALAPPDATA unavailable"); return value; }
inline std::wstring sid() {
    HANDLE token = nullptr; require(OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token), "Process identity unavailable");
    DWORD size = 0; GetTokenInformation(token, TokenUser, nullptr, 0, &size); std::vector<BYTE> bytes(size);
    BOOL ok = GetTokenInformation(token, TokenUser, bytes.data(), size, &size); CloseHandle(token); require(ok != FALSE, "Process identity unavailable");
    LPWSTR value = nullptr; require(ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER *>(bytes.data())->User.Sid, &value), "Process identity unavailable");
    std::wstring result(value); LocalFree(value); return result;
}
inline std::wstring mutex_name(const std::filesystem::path &root) {
    auto value = std::filesystem::absolute(root).lexically_normal().wstring();
    unsigned long long hash = 1469598103934665603ULL;
    for (auto c : value) { hash ^= static_cast<unsigned long long>(towlower(c)); hash *= 1099511628211ULL; }
    return L"Local\\AutocadMcpDesktop-" + sid() + L"-" + std::to_wstring(hash);
}
inline HANDLE private_mutex(const std::wstring &name, bool &exists) {
    const auto sddl = L"D:P(A;;GA;;;" + sid() + L")"; PSECURITY_DESCRIPTOR descriptor = nullptr;
    require(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &descriptor, nullptr), "Local mutex security unavailable");
    SECURITY_ATTRIBUTES attrs{sizeof(attrs), descriptor, FALSE};
    HANDLE mutex = CreateMutexW(&attrs, FALSE, name.c_str()); auto error = GetLastError(); LocalFree(descriptor);
    require(mutex != nullptr, "Local mutex unavailable"); exists = error == ERROR_ALREADY_EXISTS; return mutex;
}
inline bool running(const std::filesystem::path &root) { bool exists = false; HANDLE mutex = private_mutex(mutex_name(root), exists); CloseHandle(mutex); return exists; }

constexpr auto startup_key = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
constexpr auto startup_name = L"AutocadMcpDesktop";
inline std::wstring startup_command(const std::filesystem::path &exe) { return quote(exe.wstring()) + L" --tray"; }
enum class Startup { off, on, conflict };
inline Startup startup_state(const std::filesystem::path &exe, const std::wstring &key = startup_key) {
    HKEY handle = nullptr; auto code = RegOpenKeyExW(HKEY_CURRENT_USER, key.c_str(), 0, KEY_QUERY_VALUE, &handle);
    if (code == ERROR_FILE_NOT_FOUND) return Startup::off;
    require(code == ERROR_SUCCESS, "Startup setting unavailable");
    wchar_t data[32768]{}; DWORD size = sizeof(data), type = 0;
    code = RegQueryValueExW(handle, startup_name, nullptr, &type, reinterpret_cast<BYTE *>(data), &size); RegCloseKey(handle);
    if (code == ERROR_FILE_NOT_FOUND) return Startup::off;
    require(code == ERROR_SUCCESS && type == REG_SZ && size >= sizeof(wchar_t) && data[(size / sizeof(wchar_t)) - 1] == 0, "Invalid startup setting");
    int count = 0; auto args = CommandLineToArgvW(data, &count);
    bool own = args && count == 2 && CompareStringOrdinal(args[0], -1, exe.c_str(), -1, TRUE) == CSTR_EQUAL && wcscmp(args[1], L"--tray") == 0;
    if (args) LocalFree(args); return own ? Startup::on : Startup::conflict;
}
inline void set_startup(bool enabled, const std::filesystem::path &exe, const std::wstring &key = startup_key) {
    auto state = startup_state(exe, key); require(state != Startup::conflict, "Startup setting belongs to another installation");
    if ((!enabled && state == Startup::off) || (enabled && state == Startup::on)) return;
    HKEY handle = nullptr;
    require(RegCreateKeyExW(HKEY_CURRENT_USER, key.c_str(), 0, nullptr, 0, KEY_QUERY_VALUE | KEY_SET_VALUE, nullptr, &handle, nullptr) == ERROR_SUCCESS, "Startup setting unavailable");
    auto command = startup_command(exe);
    auto code = enabled ? RegSetValueExW(handle, startup_name, 0, REG_SZ, reinterpret_cast<const BYTE *>(command.c_str()), static_cast<DWORD>((command.size() + 1) * sizeof(wchar_t))) : RegDeleteValueW(handle, startup_name);
    RegCloseKey(handle); require(code == ERROR_SUCCESS, "Startup setting was not changed");
}
inline std::filesystem::path shortcut_path() {
    PWSTR folder = nullptr; require(SUCCEEDED(SHGetKnownFolderPath(FOLDERID_Programs, 0, nullptr, &folder)), "Start menu unavailable");
    std::filesystem::path result = std::filesystem::path(folder) / L"Autocad MCP.lnk"; CoTaskMemFree(folder); return result;
}
inline void shortcut(bool install, const std::filesystem::path &exe) {
    auto file = shortcut_path(); IShellLinkW *link = nullptr; IPersistFile *persist = nullptr;
    require(SUCCEEDED(CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&link))), "Shortcut unavailable");
    auto done = [&]() { if (persist) persist->Release(); link->Release(); };
    try {
        require(SUCCEEDED(link->QueryInterface(IID_PPV_ARGS(&persist))), "Shortcut unavailable");
        auto attrs = GetFileAttributesW(file.c_str());
        if (attrs != INVALID_FILE_ATTRIBUTES) {
            require(!(attrs & FILE_ATTRIBUTE_REPARSE_POINT), "Linked shortcut is not managed");
            require(SUCCEEDED(persist->Load(file.c_str(), STGM_READ)), "Existing shortcut is not managed");
            wchar_t target[32768]{}, args[32768]{}; link->GetPath(target, 32768, nullptr, SLGP_RAWPATH); link->GetArguments(args, 32768);
            require(CompareStringOrdinal(target, -1, exe.c_str(), -1, TRUE) == CSTR_EQUAL && args[0] == 0, "Existing shortcut is not managed");
            if (!install) require(DeleteFileW(file.c_str()) != FALSE, "Shortcut could not be removed");
            done(); return;
        }
        if (install) {
            require(SUCCEEDED(link->SetPath(exe.c_str())) && SUCCEEDED(link->SetWorkingDirectory(exe.parent_path().c_str())) && SUCCEEDED(link->SetDescription(L"AutoCAD MCP bağlantı durumu ve sistem tepsisi")), "Shortcut unavailable");
            require(SUCCEEDED(persist->Save(file.c_str(), TRUE)), "Shortcut could not be saved");
        }
        done();
    } catch (...) { done(); throw; }
}
} // namespace desktop
