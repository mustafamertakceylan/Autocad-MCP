#include "bridge.hpp"
#include "jobs.hpp"
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
    require(error("PARTIAL_APPLY", "Known effect", true)["status"] == "partial");
    auto request = json{
        {"method", "acad_create_line"},
        {"params",
         {{"instanceId", "inst-1"}, {"documentId", "doc-1"}, {"documentEpoch", 1}, {"operationId", "op-1"}}}};
    Jobs jobs(1);
    auto first = jobs.submit(request, true);
    require(first.job != nullptr);
    auto same = jobs.submit(request, true);
    require(same.job == first.job);
    auto changed = request;
    changed["params"]["extra"] = true;
    require(jobs.submit(changed, true).rejection["error"]["code"] == "IDEMPOTENCY_CONFLICT");
    auto another = request;
    another["params"]["operationId"] = "op-2";
    require(jobs.submit(another, true).rejection["error"]["code"] == "DOC_BUSY");
    require(jobs.status(request["params"])["status"] == "queued");
    auto next = jobs.take();
    require(next == first.job);
    require(jobs.status(request["params"], true)["status"] == "running" && next->cancelled);
    require(jobs.status(request["params"])["applied"].is_null());
    jobs.finish(next, error("CANCELLED", "Test rollback"));
    require(first.job->result.get()["status"] == "cancelled");
    require(jobs.submit(request, true).job->result.get() == jobs.status(request["params"]));
    Jobs queued;
    auto pending = queued.submit(request, true).job;
    require(queued.status(request["params"], true)["applied"] == false);
    require(queued.take() == nullptr);
    require(queued.submit(request, true).job == pending);
    Jobs timeout;
    auto timed = timeout.submit(request, true).job;
    require(timeout.timeout(timed)["error"]["code"] == "DOC_BUSY");
    require(timeout.take() == nullptr);
    Jobs byte_limited(10000, 1024);
    require(byte_limited.submit(request, true).rejection["error"]["code"] == "DOC_BUSY");
    Jobs parallel;
    std::vector<std::future<std::shared_ptr<Job>>> submitted;
    for (int i = 0; i < 16; ++i)
        submitted.push_back(
            std::async(std::launch::async, [&] { return parallel.submit(request, true).job; }));
    auto unique = submitted.front().get();
    for (std::size_t i = 1; i < submitted.size(); ++i)
        require(submitted[i].get() == unique);
    require(parallel.take() == unique && parallel.take() == nullptr);
    parallel.finish(unique, {{"status", "succeeded"}, {"applied", true}});
    parallel.stop();
    require(parallel.submit(request, true).job == unique);
    require(parallel.submit(another, true).rejection["error"]["code"] == "DOC_BUSY");
    std::cout << "native protocol tests passed\n";
}
