#include "bridge.hpp"
#include <algorithm>
#include <chrono>
#include <fstream>
#include <set>
#include <stdexcept>
#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#include <sddl.h>
#include <wincrypt.h>
#else
#include <CommonCrypto/CommonHMAC.h>
#include <Security/SecRandom.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>
#include <fcntl.h>
#endif

namespace mcp {
namespace {
std::string hex(const unsigned char *bytes, std::size_t size) {
    constexpr char digits[] = "0123456789abcdef";
    std::string result;
    result.reserve(size * 2);
    for (std::size_t i = 0; i < size; ++i) {
        result += digits[bytes[i] >> 4];
        result += digits[bytes[i] & 15];
    }
    return result;
}
std::vector<unsigned char> from_hex(const std::string &s) {
    if (s.size() % 2)
        throw std::runtime_error("hex");
    std::vector<unsigned char> bytes;
    auto digit = [](char c) {
        if (c >= '0' && c <= '9')
            return c - '0';
        if (c >= 'a' && c <= 'f')
            return c - 'a' + 10;
        throw std::runtime_error("hex");
    };
    for (std::size_t i = 0; i < s.size(); i += 2)
        bytes.push_back(static_cast<unsigned char>(digit(s[i]) * 16 + digit(s[i + 1])));
    return bytes;
}
void check_value(const json &value, int depth) {
    if (depth > 8 || ((value.is_array() || value.is_object()) && value.size() > 1000))
        throw std::runtime_error("limits");
    if (value.is_string() && value.get_ref<const std::string &>().size() > 4096)
        throw std::runtime_error("string limit");
    if (value.is_number_float() && !std::isfinite(value.get<double>()))
        throw std::runtime_error("finite");
    if (value.is_structured())
        for (const auto &child : value)
            check_value(child, depth + 1);
}
#ifdef _WIN32
struct PrivateSecurity {
    PSECURITY_DESCRIPTOR descriptor = nullptr;
    SECURITY_ATTRIBUTES attributes{sizeof(SECURITY_ATTRIBUTES), nullptr, FALSE};
    PrivateSecurity() {
        HANDLE token;
        if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token))
            throw std::runtime_error("token");
        DWORD bytes = 0;
        GetTokenInformation(token, TokenUser, nullptr, 0, &bytes);
        std::vector<unsigned char> info(bytes);
        if (!GetTokenInformation(token, TokenUser, info.data(), bytes, &bytes)) {
            CloseHandle(token);
            throw std::runtime_error("token");
        }
        CloseHandle(token);
        LPWSTR sid = nullptr;
        if (!ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER *>(info.data())->User.Sid, &sid))
            throw std::runtime_error("sid");
        std::wstring sddl = L"D:P(A;OICI;GA;;;";
        sddl += sid;
        sddl += L")";
        LocalFree(sid);
        if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &descriptor,
                                                                  nullptr))
            throw std::runtime_error("acl");
        attributes.lpSecurityDescriptor = descriptor;
    }
    ~PrivateSecurity() {
        if (descriptor)
            LocalFree(descriptor);
    }
};
class Pipe {
  public:
    HANDLE handle = INVALID_HANDLE_VALUE;
    ~Pipe() {
        if (handle != INVALID_HANDLE_VALUE)
            CloseHandle(handle);
    }
    bool transfer(bool writing, void *data, DWORD size, DWORD &transferred, const std::atomic<bool> &stop) {
        OVERLAPPED ov{};
        ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        if (!ov.hEvent)
            return false;
        BOOL ok = writing ? WriteFile(handle, data, size, &transferred, &ov)
                          : ReadFile(handle, data, size, &transferred, &ov);
        if (!ok && GetLastError() == ERROR_IO_PENDING) {
            const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
            while (!stop && std::chrono::steady_clock::now() < deadline &&
                   WaitForSingleObject(ov.hEvent, 100) == WAIT_TIMEOUT) {
            }
            if (stop || WaitForSingleObject(ov.hEvent, 0) != WAIT_OBJECT_0) {
                CancelIoEx(handle, &ov);
                WaitForSingleObject(ov.hEvent, INFINITE);
                ok = FALSE;
            } else
                ok = GetOverlappedResult(handle, &ov, &transferred, FALSE);
        }
        CloseHandle(ov.hEvent);
        return ok != FALSE;
    }
    bool write(const std::string &text, const std::atomic<bool> &stop) {
        std::size_t pos = 0;
        while (pos < text.size()) {
            DWORD count = 0;
            if (!transfer(true, const_cast<char *>(text.data() + pos), static_cast<DWORD>(text.size() - pos),
                          count, stop) ||
                !count)
                return false;
            pos += count;
        }
        return true;
    }
    std::string read(const std::atomic<bool> &stop) {
        std::string result;
        char buffer[8192];
        for (;;) {
            DWORD count = 0;
            if (!transfer(false, buffer, sizeof(buffer), count, stop) || !count)
                throw std::runtime_error("read");
            result.append(buffer, count);
            if (result.size() > max_frame + 1)
                throw std::runtime_error("frame");
            const auto lf = result.find('\n');
            if (lf != std::string::npos) {
                if (lf != result.size() - 1)
                    throw std::runtime_error("extra frame");
                return result.substr(0, lf);
            }
        }
    }
};
#endif
} // namespace

std::string random_hex(std::size_t size) {
    std::vector<unsigned char> bytes(size);
#ifdef _WIN32
    if (BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(size), BCRYPT_USE_SYSTEM_PREFERRED_RNG) < 0)
        throw std::runtime_error("random");
#else
    if (SecRandomCopyBytes(kSecRandomDefault, size, bytes.data()) != errSecSuccess)
        throw std::runtime_error("random");
#endif
    return hex(bytes.data(), size);
}
std::string base64(const std::string &value) {
    constexpr char chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result;
    unsigned acc = 0;
    int bits = 0;
    for (unsigned char c : value) {
        acc = (acc << 8) | c;
        bits += 8;
        while (bits >= 6) {
            bits -= 6;
            result += chars[(acc >> bits) & 63];
        }
    }
    if (bits)
        result += chars[(acc << (6 - bits)) & 63];
    while (result.size() % 4)
        result += '=';
    return result;
}
std::string unbase64(const std::string &value) {
    if (value.size() > ((max_body + 2) / 3) * 4 || value.size() % 4)
        throw std::runtime_error("base64");
    const std::string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result;
    unsigned acc = 0;
    int bits = 0;
    for (char c : value) {
        if (c == '=')
            break;
        auto digit = chars.find(c);
        if (digit == std::string::npos)
            throw std::runtime_error("base64");
        acc = (acc << 6) | static_cast<unsigned>(digit);
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            result += static_cast<char>((acc >> bits) & 255);
        }
    }
    if (base64(result) != value)
        throw std::runtime_error("base64");
    return result;
}
std::string mac(const std::string &key_hex, const std::string &direction, const std::string &nonce,
                const std::string &body) {
    auto key = from_hex(key_hex);
    const std::string message = direction + "\n" + nonce + "\n" + body;
    unsigned char digest[32]{};
#ifdef _WIN32
    BCRYPT_ALG_HANDLE alg = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    DWORD size = 0, actual = 0;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, nullptr, BCRYPT_ALG_HANDLE_HMAC_FLAG) < 0)
        throw std::runtime_error("hmac");
    if (BCryptGetProperty(alg, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&size), sizeof(size), &actual,
                          0) < 0) {
        BCryptCloseAlgorithmProvider(alg, 0);
        throw std::runtime_error("hmac");
    }
    std::vector<unsigned char> state(size);
    auto status =
        BCryptCreateHash(alg, &hash, state.data(), size, key.data(), static_cast<ULONG>(key.size()), 0);
    if (status >= 0)
        status = BCryptHashData(hash, reinterpret_cast<PUCHAR>(const_cast<char *>(message.data())),
                                static_cast<ULONG>(message.size()), 0);
    if (status >= 0)
        status = BCryptFinishHash(hash, digest, sizeof(digest), 0);
    if (hash)
        BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(alg, 0);
    if (status < 0)
        throw std::runtime_error("hmac");
#else
    CCHmac(kCCHmacAlgSHA256, key.data(), key.size(), message.data(), message.size(), digest);
#endif
    return hex(digest, sizeof(digest));
}
bool secure_equal(const std::string &a, const std::string &b) {
    if (a.size() != b.size())
        return false;
    unsigned diff = 0;
    for (std::size_t i = 0; i < a.size(); ++i)
        diff |= static_cast<unsigned char>(a[i]) ^ static_cast<unsigned char>(b[i]);
    return diff == 0;
}
json parse(const std::string &text) {
    if (text.size() > max_body)
        throw std::runtime_error("body limit");
    std::vector<std::set<std::string>> keys;
    auto result = json::parse(text, [&](int depth, json::parse_event_t event, json &value) {
        if (depth > 8)
            throw std::runtime_error("depth limit");
        if (event == json::parse_event_t::object_start)
            keys.emplace_back();
        if (event == json::parse_event_t::key && !keys.back().insert(value.get<std::string>()).second)
            throw std::runtime_error("duplicate key");
        if (event == json::parse_event_t::object_end)
            keys.pop_back();
        return true;
    });
    check_value(result, 0);
    return result;
}
json error(const std::string &code, const std::string &message, json applied) {
    return {{"status", applied.is_null() ? "unknown" : "failed"},
            {"applied", applied},
            {"verified", nullptr},
            {"error",
             {{"code", code},
              {"message", message},
              {"retryable", false},
              {"scope", "operation"},
              {"details", json::object()}}}};
}

Runtime::Runtime(std::filesystem::path root, std::function<json(const json &)> handler,
                 std::vector<std::string> operations)
    : handler_(std::move(handler)), operations_(std::move(operations)) {
#ifndef _WIN32
    throw std::runtime_error("Native Mac transport is not implemented; no pairing is issued");
#endif
    instance_ = "inst-" + random_hex(16);
    secret_ = random_hex(32);
    std::filesystem::create_directories(root);
    directory_ = root / instance_;
#ifdef _WIN32
    PrivateSecurity security;
    if (!CreateDirectoryW(directory_.c_str(), &security.attributes))
        throw std::runtime_error("runtime directory");
    endpoint_ = "\\\\.\\pipe\\autocad-mcp-" + instance_;
#else
    if (::mkdir(directory_.c_str(), 0700) != 0)
        throw std::runtime_error("runtime directory");
    endpoint_ = (directory_ / "bridge.sock").string();
#endif
    grant_file_ = directory_ / "pairing.json";
    const auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
                         std::chrono::system_clock::now().time_since_epoch())
                         .count();
    expires_at_ = now + 24 * 60 * 60 * 1000;
    const auto content =
        json{{"bridgeVersion", "0.1.0"}, {"instanceId", instance_}, {"endpoint", endpoint_},
             {"secret", secret_},        {"backend", "objectarx"},  {"expiresAt", expires_at_},
             {"operations", operations_}}
            .dump();
#ifdef _WIN32
    HANDLE file = CreateFileW(grant_file_.c_str(), GENERIC_WRITE, 0, &security.attributes, CREATE_NEW,
                              FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE)
        throw std::runtime_error("pairing file");
    DWORD count = 0;
    const auto ok = WriteFile(file, content.data(), static_cast<DWORD>(content.size()), &count, nullptr);
    CloseHandle(file);
    if (!ok || count != content.size())
        throw std::runtime_error("pairing write");
#else
    int fd = ::open(grant_file_.c_str(), O_WRONLY | O_CREAT | O_EXCL, 0600);
    if (fd < 0)
        throw std::runtime_error("pairing file");
    const auto count = ::write(fd, content.data(), content.size());
    ::close(fd);
    if (count != static_cast<ssize_t>(content.size()))
        throw std::runtime_error("pairing write");
#endif
    thread_ = std::thread([this] { run(); });
}
Runtime::~Runtime() {
    stop();
}
void Runtime::stop() {
    stopping_ = true;
    if (thread_.joinable())
        thread_.join();
    std::fill(secret_.begin(), secret_.end(), '\0');
    std::error_code ignored;
    std::filesystem::remove(grant_file_, ignored); /* Revoke only the file created by this runtime. */
}
void Runtime::run() {
#ifdef _WIN32
    PrivateSecurity security;
    while (!stopping_) {
        Pipe pipe;
        const std::wstring endpoint(endpoint_.begin(), endpoint_.end());
        pipe.handle = CreateNamedPipeW(
            endpoint.c_str(), PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS, 1, 65536, 65536, 0,
            &security.attributes);
        if (pipe.handle == INVALID_HANDLE_VALUE)
            return;
        OVERLAPPED ov{};
        ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        if (!ov.hEvent)
            return;
        BOOL connected = ConnectNamedPipe(pipe.handle, &ov);
        DWORD err = connected ? ERROR_SUCCESS : GetLastError();
        if (!connected && err == ERROR_IO_PENDING) {
            while (!stopping_ && WaitForSingleObject(ov.hEvent, 100) == WAIT_TIMEOUT) {
            }
            if (stopping_) {
                CancelIoEx(pipe.handle, &ov);
                WaitForSingleObject(ov.hEvent, INFINITE);
            } else {
                DWORD ignored;
                connected = GetOverlappedResult(pipe.handle, &ov, &ignored, FALSE);
            }
        } else if (err == ERROR_PIPE_CONNECTED)
            connected = TRUE;
        CloseHandle(ov.hEvent);
        if (stopping_)
            break;
        if (!connected)
            continue;
        try {
            const auto nonce = random_hex(32);
            if (!pipe.write(
                    json{{"nonce", nonce}, {"instanceId", instance_}, {"bridgeVersion", "0.1.0"}}.dump() +
                        "\n",
                    stopping_))
                continue;
            std::set<std::string> envelope_keys;
            const auto packet =
                json::parse(pipe.read(stopping_), [&](int depth, json::parse_event_t event, json &value) {
                    if (depth > 1 || (event == json::parse_event_t::object_start && depth != 0) ||
                        event == json::parse_event_t::array_start)
                        throw std::runtime_error("envelope depth");
                    if (event == json::parse_event_t::key &&
                        !envelope_keys.insert(value.get<std::string>()).second)
                        throw std::runtime_error("envelope duplicate");
                    return true;
                });
            if (!packet.is_object() || packet.size() != 3 || packet.at("nonce") != nonce ||
                !packet.at("body").is_string() || !packet.at("mac").is_string())
                continue;
            const auto body = packet.at("body").get<std::string>();
            if (!secure_equal(mac(secret_, "request", nonce, body), packet.at("mac").get<std::string>()))
                continue;
            json result;
            try {
                const auto request = parse(unbase64(body));
                if (request.at("jsonrpc") != "2.0" || request.at("id") != 1 ||
                    !request.at("method").is_string() || !request.at("params").is_object())
                    throw std::runtime_error("request");
                const auto method = request.at("method").get<std::string>();
                const auto current = std::chrono::duration_cast<std::chrono::milliseconds>(
                                         std::chrono::system_clock::now().time_since_epoch())
                                         .count();
                if (current >= expires_at_)
                    result = error("IPC_AUTH_FAILED", "Pairing expired");
                else if (std::find(operations_.begin(), operations_.end(), method) == operations_.end())
                    result = error("SECURITY_DENIED", "Operation not granted");
                else
                    result = handler_(request);
            } catch (...) {
                result = error("VALIDATION_FAILED", "Invalid bridge request");
            }
            auto reply_json = json{{"jsonrpc", "2.0"}, {"id", 1}, {"result", result}}.dump();
            if (reply_json.size() > max_body)
                reply_json =
                    json{{"jsonrpc", "2.0"},
                         {"id", 1},
                         {"result", error("RESULT_TOO_LARGE", "Result exceeds body budget", nullptr)}}
                        .dump();
            const auto reply = base64(reply_json);
            const auto response =
                json{{"nonce", nonce}, {"body", reply}, {"mac", mac(secret_, "response", nonce, reply)}}
                    .dump();
            if (response.size() <= max_frame && pipe.write(response + "\n", stopping_)) {
                // DisconnectNamedPipe discards unread bytes. Wait for the peer to
                // consume the signed reply and close (bounded by read timeout).
                try {
                    pipe.read(stopping_);
                } catch (...) {
                }
            }
        } catch (...) { /* Reject malformed or unauthenticated peers without exposing drawing data. */
        }
        DisconnectNamedPipe(pipe.handle);
    }
#else
    // Shared protocol/crypto compile target; native Mac socket serving awaits Mac verification.
    while (!stopping_)
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
#endif
}
} // namespace mcp
