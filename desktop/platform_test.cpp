#include "platform.hpp"
#include "bridge.hpp"
#include <iostream>
int main() {
    const auto unique = mcp::random_hex(16);
    const auto key = L"Software\\AutocadMCP\\Tests\\" + std::wstring(unique.begin(), unique.end());
    // Only this process's new synthetic key; never the real Windows Run key.
    HKEY created = nullptr; DWORD disposition = 0;
    desktop::require(RegCreateKeyExW(HKEY_CURRENT_USER, key.c_str(), 0, nullptr, 0, KEY_ALL_ACCESS, nullptr, &created, &disposition) == ERROR_SUCCESS && disposition == REG_CREATED_NEW_KEY, "Synthetic key must be new"); RegCloseKey(created);
    try {
        const auto exe = desktop::executable().parent_path() / L"örnek boşluk" / L"AutocadMcpDesktop.exe";
        desktop::require(desktop::startup_state(exe, key) == desktop::Startup::off, "Default off");
        desktop::set_startup(true, exe, key); desktop::require(desktop::startup_state(exe, key) == desktop::Startup::on, "Enable startup");
        auto alternate = exe.wstring(); for (auto &c : alternate) if (c >= L'a' && c <= L'z') c -= 32;
        desktop::require(desktop::startup_state(alternate, key) == desktop::Startup::on, "Windows path case does not break ownership");
        desktop::set_startup(true, exe, key); desktop::require(desktop::startup_state(exe, key) == desktop::Startup::on, "Idempotent enable");
        desktop::set_startup(false, exe, key); desktop::require(desktop::startup_state(exe, key) == desktop::Startup::off, "Disable startup");
        desktop::set_startup(true, exe, key); bool denied = false;
        try { desktop::set_startup(false, exe.parent_path() / L"other.exe", key); } catch (...) { denied = true; }
        desktop::require(denied && desktop::startup_state(exe, key) == desktop::Startup::on, "Preserve foreign registration");
        desktop::require(desktop::quote(L"C:\\a b\\") == L"\"C:\\a b\\\\\"", "Windows path quoting");
        desktop::require(desktop::mutex_name(exe) == desktop::mutex_name(exe) && desktop::mutex_name(exe) != desktop::mutex_name(exe.parent_path()), "Stable single-instance identity");
        RegDeleteTreeW(HKEY_CURRENT_USER, key.c_str()); std::cout << "desktop platform: 8 checks passed\n"; return 0;
    } catch (...) { RegDeleteTreeW(HKEY_CURRENT_USER, key.c_str()); throw; }
}
