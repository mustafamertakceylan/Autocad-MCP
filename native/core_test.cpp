#include "bridge.hpp"
#include <iostream>
#include <stdexcept>
int main() {
    using namespace mcp;
    auto require = [](bool ok) {
        if (!ok)
            throw std::runtime_error("core assertion");
    };
    for (const auto &value : std::vector<std::string>{"", "a", "ab", "abc", "a\nb", "UTF-8: çizgi"})
        require(unbase64(base64(value)) == value);
    for (const auto &value : std::vector<std::string>{"{\"x\":1,\"x\":2}", "{\"x\":1e400}", "[NaN]"}) {
        bool rejected = false;
        try {
            parse(value);
        } catch (...) {
            rejected = true;
        }
        require(rejected);
    }
    require(parse("{\"x\":[1,true,null]}").at("x").size() == 3);
    bool deep_rejected = false;
    try {
        parse(std::string(5000, '[') + "0" + std::string(5000, ']'));
    } catch (...) {
        deep_rejected = true;
    }
    require(deep_rejected);
    const auto key = std::string(64, '1');
    require(mac(key, "request", "n", "b") ==
            "3d8ba0be75f71c50cd186850757b5069149f49d9bf693aa25a0df49777356f2d");
    require(!secure_equal(mac(key, "request", "n", "b"), mac(key, "response", "n", "b")));
    require(random_hex(32).size() == 64);
    std::cout << "native protocol tests passed\n";
}
