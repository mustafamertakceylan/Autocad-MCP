#pragma once
#include "bridge.hpp"
#include <algorithm>
#include <deque>
#include <future>
#include <map>

namespace mcp {
// No AutoCAD API may be called by this class. Status/cancel remain usable while
// the sole CAD thread is busy. Records live until the pairing is stopped.
struct Job {
    json request;
    std::string fingerprint;
    std::promise<json> response;
    std::shared_future<json> result = response.get_future().share();
    std::atomic<bool> cancelled{false};
    bool started = false, terminal = false;
    std::size_t charge = 0;
};
class Jobs {
    std::mutex mutex_;
    std::deque<std::shared_ptr<Job>> queue_;
    std::map<std::string, std::shared_ptr<Job>> records_;
    std::size_t bytes_ = 0;
    std::size_t capacity_, budget_;
    bool stopped_ = false;
    static std::string key(const json &p) {
        return std::to_string(p.at("documentEpoch").get<std::uint64_t>()) + ":" +
               p.at("operationId").get<std::string>();
    }
    static json identified(json value, const json &p) {
        for (const auto name : {"instanceId", "documentId", "documentEpoch", "operationId"})
            if (p.contains(name))
                value[name] = p.at(name);
        return value;
    }
    void finish_locked(const std::shared_ptr<Job> &job, json value) {
        if (job->terminal)
            return;
        value = identified(std::move(value), job->request.at("params"));
        if (value.dump().size() > max_body - 1024)
            value = identified(error("RESULT_TOO_LARGE", "Terminal result exceeds budget", nullptr),
                               job->request.at("params"));
        const auto charge = job->fingerprint.size() + value.dump().size() + 4096;
        if (job->charge) {
            bytes_ -= job->charge;
            bytes_ += charge;
            job->charge = charge;
        }
        job->response.set_value(std::move(value));
        job->terminal = true;
        // Keep only the small target for status checks; fingerprint is immutable.
        job->request = {{"params", identified(json::object(), job->request.at("params"))}};
    }

  public:
    explicit Jobs(std::size_t capacity = 10000, std::size_t budget = 64 * 1024 * 1024)
        : capacity_(capacity), budget_(budget) {}
    struct Admission {
        std::shared_ptr<Job> job;
        json rejection;
    };
    Admission submit(const json &request, bool mutation) {
        const auto fingerprint = request.dump();
        std::lock_guard lock(mutex_);
        if (mutation) {
            auto it = records_.find(key(request.at("params")));
            if (it != records_.end()) {
                if (it->second->fingerprint != fingerprint)
                    return {nullptr,
                            error("IDEMPOTENCY_CONFLICT", "Operation ID reused with different arguments")};
                return {it->second, {}};
            }
        }
        const auto charge = 2 * fingerprint.size() + max_body + 4096;
        if (stopped_ || queue_.size() >= 64 ||
            (mutation && (records_.size() >= capacity_ || bytes_ + charge > budget_)))
            return {nullptr, error("DOC_BUSY", "Queue or operation record budget reached")};
        auto job = std::make_shared<Job>();
        job->request = request;
        job->fingerprint = fingerprint;
        queue_.push_back(job);
        if (mutation) {
            try {
                records_.emplace(key(request.at("params")), job);
            } catch (...) {
                queue_.pop_back();
                throw;
            }
            job->charge = charge;
            bytes_ += charge;
        }
        return {job, {}};
    }
    std::shared_ptr<Job> take() {
        std::lock_guard lock(mutex_);
        if (queue_.empty())
            return nullptr;
        auto job = queue_.front();
        queue_.pop_front();
        job->started = true;
        return job;
    }
    void finish(const std::shared_ptr<Job> &job, json value) {
        std::lock_guard lock(mutex_);
        finish_locked(job, std::move(value));
    }
    json status(const json &p, bool cancel = false) {
        std::lock_guard lock(mutex_);
        auto it = records_.find(key(p));
        if (it == records_.end())
            return identified(error("TIMEOUT_UNKNOWN", "Operation effect is not known", nullptr), p);
        auto job = it->second;
        if (job->request.at("params").at("documentId") != p.at("documentId"))
            return error("VALIDATION_FAILED", "Operation target differs");
        if (job->terminal)
            return job->result.get();
        if (cancel) {
            job->cancelled = true;
            if (!job->started) {
                auto entry = std::find(queue_.begin(), queue_.end(), job);
                if (entry != queue_.end())
                    queue_.erase(entry);
                finish_locked(job, error("CANCELLED", "Cancelled before execution"));
                return job->result.get();
            }
        }
        return identified({{"status", job->started ? "running" : "queued"},
                           {"applied", job->started ? json(nullptr) : json(false)},
                           {"verified", nullptr},
                           {"cancelRequested", job->cancelled.load()}},
                          p);
    }
    bool reject_queued(const std::shared_ptr<Job> &job, json value) {
        std::lock_guard lock(mutex_);
        if (job->started || job->terminal)
            return false;
        auto entry = std::find(queue_.begin(), queue_.end(), job);
        if (entry != queue_.end())
            queue_.erase(entry);
        finish_locked(job, std::move(value));
        return true;
    }
    json timeout(const std::shared_ptr<Job> &job) {
        std::lock_guard lock(mutex_);
        if (job->terminal)
            return job->result.get();
        if (!job->started) {
            auto entry = std::find(queue_.begin(), queue_.end(), job);
            if (entry != queue_.end())
                queue_.erase(entry);
            finish_locked(job, error("DOC_BUSY", "Main thread did not accept operation"));
            return job->result.get();
        }
        return identified(error("TIMEOUT_UNKNOWN", "Operation is still running", nullptr),
                          job->request.at("params"));
    }
#ifdef AUTOCAD_MCP_TESTING
    void seal_records_for_test() {
        std::lock_guard lock(mutex_);
        capacity_ = records_.size();
    }
#endif
    void stop() {
        std::lock_guard lock(mutex_);
        stopped_ = true;
        for (auto &job : queue_)
            finish_locked(job, error("CANCELLED", "Bridge stopping before execution"));
        queue_.clear();
    }
};
} // namespace mcp
