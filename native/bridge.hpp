#pragma once
#include "json.hpp"
#include <atomic>
#include <filesystem>
#include <functional>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace mcp {
using json = nlohmann::json;
constexpr std::size_t max_frame = 1024 * 1024;
constexpr std::size_t max_body = 512 * 1024;
std::string random_hex(std::size_t bytes);
std::string base64(const std::string &bytes);
std::string unbase64(const std::string &bytes);
std::string mac(const std::string &key_hex, const std::string &direction, const std::string &nonce,
                const std::string &body);
bool secure_equal(const std::string &a, const std::string &b);
json parse(const std::string &text);
json error(const std::string &code, const std::string &message, json applied = false);

class Runtime {
  public:
    Runtime(std::filesystem::path root, std::function<json(const json &)> handler,
            std::vector<std::string> operations);
    ~Runtime();
    Runtime(const Runtime &) = delete;
    Runtime &operator=(const Runtime &) = delete;
    const std::string &instance() const {
        return instance_;
    }
    const std::filesystem::path &grant_file() const {
        return grant_file_;
    }
    void stop();

  private:
    void run();
    std::function<json(const json &)> handler_;
    std::filesystem::path directory_, grant_file_;
    std::string instance_, endpoint_, secret_;
    std::int64_t expires_at_ = 0;
    std::vector<std::string> operations_;
    std::atomic<bool> stopping_{false};
    std::thread thread_;
};
} // namespace mcp
