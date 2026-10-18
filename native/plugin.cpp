#include "bridge.hpp"
#include "jobs.hpp"
#include <windows.h>
#include "rxregsvc.h"
#include "aced.h"
#include "acedads.h"
#include "acdocman.h"
#include "dbapserv.h"
#include "dbsymtb.h"
#include "dbents.h"
#include "dbsol3d.h"
#include "dbtrans.h"
#include "dbobjptr.h"
#include "acutmem.h"
#include "dbsymutl.h"
#include "adscodes.h"
#include <deque>
#include <future>
#include <map>
#include <memory>
#include <regex>
#include <set>

namespace {
using mcp::json;
struct Failure {
    std::string code, message;
};
void need(bool value, const char *code = "VALIDATION_FAILED", const char *message = "Invalid arguments") {
    if (!value)
        throw Failure{code, message};
}
void cad(Acad::ErrorStatus status) {
    if (status == Acad::eLockViolation || status == Acad::eLockChangeInProgress ||
        status == Acad::eLockConflict || status == Acad::eVetoed)
        throw Failure{"DOC_BUSY", "Document lock is unavailable"};
    need(status == Acad::eOk, "EXECUTION_FAILED", "AutoCAD API rejected operation");
}
std::wstring wide(const std::string &value) {
    if (value.empty())
        return {};
    int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                    static_cast<int>(value.size()), nullptr, 0);
    need(count > 0);
    std::wstring result(count, 0);
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
                        result.data(), count);
    return result;
}
std::string utf8(const wchar_t *value) {
    if (!value || !*value)
        return {};
    int count = WideCharToMultiByte(CP_UTF8, 0, value, -1, nullptr, 0, nullptr, nullptr);
    std::string result(count, 0);
    WideCharToMultiByte(CP_UTF8, 0, value, -1, result.data(), count, nullptr, nullptr);
    result.resize(count - 1);
    return result;
}
std::string text(const json &p, const char *field) {
    need(p.contains(field) && p.at(field).is_string());
    auto value = p.at(field).get<std::string>();
    need(!value.empty() && value.size() <= 4096);
    return value;
}
std::uint64_t number(const json &p, const char *field) {
    need(p.contains(field) && p.at(field).is_number_unsigned());
    auto value = p.at(field).get<std::uint64_t>();
    need(value <= 9007199254740991ULL);
    return value;
}
AcGePoint3d point(const json &p, const char *field, double factor = 1) {
    need(p.contains(field) && p.at(field).is_array() && p.at(field).size() == 3);
    const auto &a = p.at(field);
    for (const auto &n : a)
        need(n.is_number() && std::isfinite(n.get<double>() * factor));
    return {a[0].get<double>() * factor, a[1].get<double>() * factor, a[2].get<double>() * factor};
}
json xyz(const AcGePoint3d &p, double f = 1) {
    return json::array({p.x * f, p.y * f, p.z * f});
}
bool mutation(const std::string &method) {
    return method == "acad_create_line" || method == "acad_create_circle" || method == "acad_create_box" ||
           method == "acad_move_entities" || method == "acad_erase_entities" || method == "acad_save_copy";
}

struct DocState {
    std::string id;
    std::uint64_t epoch = 0, revision = 0;
    bool writing = false;
    std::set<std::string> boxes;
};
std::map<AcDbDatabase *, DocState> documents;
std::uint64_t next_epoch = 1;
bool test_pumping = false;
void changed(const AcDbDatabase *db) {
    auto it = documents.find(const_cast<AcDbDatabase *>(db));
    if (it != documents.end() && !it->second.writing) {
        it->second.revision++;
    }
}
class DatabaseWatcher : public AcDbDatabaseReactor {
  public:
    void objectAppended(const AcDbDatabase *db, const AcDbObject *) override {
        changed(db);
    }
    void objectModified(const AcDbDatabase *db, const AcDbObject *) override {
        changed(db);
    }
    void objectErased(const AcDbDatabase *db, const AcDbObject *, bool) override {
        changed(db);
    }
    void objectUnAppended(const AcDbDatabase *db, const AcDbObject *) override {
        changed(db);
    }
    void objectReAppended(const AcDbDatabase *db, const AcDbObject *) override {
        changed(db);
    }
    void headerSysVarChanged(const AcDbDatabase *db, const ACHAR *, bool success) override {
        if (success)
            changed(db);
    }
    void goodbye(const AcDbDatabase *db) override {
        documents.erase(const_cast<AcDbDatabase *>(db));
    }
} watcher;
DocState &state(AcDbDatabase *db) {
    auto it = documents.find(db);
    if (it == documents.end()) {
        DocState s;
        s.id = "doc-" + mcp::random_hex(16);
        s.epoch = next_epoch++;
        it = documents.emplace(db, std::move(s)).first;
        db->addReactor(&watcher);
    }
    return it->second;
}

std::unique_ptr<mcp::Runtime> runtime;
std::filesystem::path output_root;
std::unique_ptr<mcp::Jobs> jobs;
bool rollback_uncertain = false;
std::atomic<bool> *current_cancel = nullptr; // Only the CAD thread reads this pointer.
void check_cancel() {
    need(runtime && GetFileAttributesW(runtime->grant_file().c_str()) != INVALID_FILE_ATTRIBUTES,
         "IPC_AUTH_FAILED", "Pairing revoked before transaction commit");
    need(!current_cancel || !current_cancel->load(), "CANCELLED", "Transaction cancelled before commit");
}
#ifdef AUTOCAD_MCP_TESTING
std::string next_fault;
bool test_abort_uncertain = false;
void test_fault(const char *point) {
    if (next_fault != point)
        return;
    next_fault.clear();
    if (std::string(point).starts_with("delay")) {
        for (int i = 0; i < 100; ++i) {
            Sleep(10);
            if (std::string(point) == "delay_before_commit")
                check_cancel();
        }
    } else
        throw Failure{"EXECUTION_FAILED", "Synthetic fault injection"};
}
#else
void test_fault(const char *) {}
#endif
struct Cursor {
    std::string document, signature;
    std::uint64_t epoch, revision;
    std::size_t offset;
};
std::map<std::string, Cursor> cursors;
const std::vector<std::string> names = {
    "acad_list_instances",       "acad_get_status",     "acad_get_capabilities", "acad_list_documents",
    "acad_get_document_info",    "acad_query_entities", "acad_get_entity",       "acad_create_line",
    "acad_create_circle",        "acad_create_box",     "acad_move_entities",    "acad_erase_entities",
    "acad_get_operation_status", "acad_save_copy"};

json identity(AcDbDatabase *db) {
    auto &s = state(db);
    return {{"instanceId", runtime->instance()}, {"documentId", s.id}, {"documentEpoch", s.epoch}};
}
void include(json &result, const json &values) {
    for (auto it = values.begin(); it != values.end(); ++it)
        result[it.key()] = it.value();
}
std::string handle(AcDbObject *object) {
    AcDbHandle h;
    object->getAcDbHandle(h);
    wchar_t buffer[17]{};
    need(h.getIntoAsciiBuffer(buffer, 17), "EXECUTION_FAILED", "Handle unavailable");
    return utf8(buffer);
}
json ref(AcDbDatabase *db, AcDbObject *object) {
    auto v = identity(db);
    v.erase("instanceId");
    v["handle"] = handle(object);
    return v;
}
AcDbObjectId object_id(AcDbDatabase *db, const std::string &value) {
    need(std::regex_match(value, std::regex("[0-9a-fA-F]{1,16}")));
    AcDbObjectId id;
    need(db->getAcDbObjectId(id, false, AcDbHandle(wide(value).c_str())) == Acad::eOk, "TARGET_NOT_FOUND",
         "Entity not found");
    return id;
}

struct Transaction {
    AcDbDatabase *db;
    AcDbTransactionManager *manager;
    bool active = true;
    explicit Transaction(AcDbDatabase *p) : db(p), manager(p->transactionManager()) {
        need(manager && manager->startTransaction(), "EXECUTION_FAILED", "Cannot start transaction");
    }
    ~Transaction() {
        if (active) {
            if (manager->abortTransaction() != Acad::eOk)
                rollback_uncertain = true;
#ifdef AUTOCAD_MCP_TESTING
            if (test_abort_uncertain) {
                test_abort_uncertain = false;
                rollback_uncertain = true;
            }
#endif
        }
    }
    template <class T> T *get(AcDbObjectId id, AcDb::OpenMode mode = AcDb::kForRead) {
        T *value = nullptr;
        cad(manager->getObject(value, id, mode));
        need(value != nullptr, "TARGET_NOT_FOUND", "Entity unavailable");
        return value;
    }
    void commit() {
        cad(manager->endTransaction());
        active = false;
    }
};

#ifdef AUTOCAD_MCP_TESTING
std::unique_ptr<Transaction> synthetic_outer_transaction;
#endif

double drawing_metres(AcDbDatabase *db) {
    switch (static_cast<int>(db->insunits())) {
    case 1:
        return .0254;
    case 4:
        return .001;
    case 6:
        return 1;
    default:
        throw Failure{"UNITS_UNKNOWN", "Drawing unit conversion unavailable"};
    }
}
double unit_metres(const std::string &unit) {
    if (unit == "mm")
        return .001;
    if (unit == "m")
        return 1;
    if (unit == "inch")
        return .0254;
    throw Failure{"VALIDATION_FAILED", "Invalid length unit"};
}
double input_factor(AcDbDatabase *db, const json &p) {
    auto u = text(p, "lengthUnit");
    return u == "drawing_unit" ? 1 : unit_metres(u) / drawing_metres(db);
}
double output_factor(AcDbDatabase *db, const json &p) {
    auto u = p.value("lengthUnit", std::string("drawing_unit"));
    return u == "drawing_unit" ? 1 : drawing_metres(db) / unit_metres(u);
}

std::string layer_name(AcDbEntity *e) {
    auto raw = e->layer();
    auto name = utf8(raw);
    acutDelString(raw);
    return name;
}
std::string type(AcDbEntity *e) {
    if (e->isKindOf(AcDbLine::desc()))
        return "LINE";
    if (e->isKindOf(AcDbCircle::desc()))
        return "CIRCLE";
    if (e->isKindOf(AcDb3dSolid::desc()))
        return "3DSOLID";
    return "UNSUPPORTED";
}
json geometry(AcDbEntity *e, double f) {
    json result = {{"handle", handle(e)}, {"type", type(e)}, {"layer", layer_name(e)}};
    if (auto line = AcDbLine::cast(e)) {
        result["start"] = xyz(line->startPoint(), f);
        result["end"] = xyz(line->endPoint(), f);
        result["length"] = line->startPoint().distanceTo(line->endPoint()) * f;
    }
    if (auto circle = AcDbCircle::cast(e)) {
        result["center"] = xyz(circle->center(), f);
        result["radius"] = circle->radius() * f;
        result["normal"] = json::array({circle->normal().x, circle->normal().y, circle->normal().z});
    }
    AcDbExtents bounds;
    if (e->getGeomExtents(bounds) == Acad::eOk)
        result["extents"] = {{"min", xyz(bounds.minPoint(), f)}, {"max", xyz(bounds.maxPoint(), f)}};
    if (auto solid = AcDb3dSolid::cast(e)) {
        double volume = 0, mi[3]{}, pi[3]{}, pm[3]{}, rg[3]{};
        AcGePoint3d center;
        AcGeVector3d axes[3];
        AcDbExtents ext;
        cad(solid->getMassProp(volume, center, mi, pi, pm, axes, rg, ext));
        result["center"] = xyz(center, f);
        result["volume"] = volume * f * f * f;
        auto a = ext.minPoint(), b = ext.maxPoint();
        result["size"] = json::array({(b.x - a.x) * f, (b.y - a.y) * f, (b.z - a.z) * f});
        result["extents"] = {{"min", xyz(a, f)}, {"max", xyz(b, f)}};
    }
    return result;
}
void modelspace(AcDbDatabase *db, AcDbEntity *entity) {
    AcDbBlockTableRecord *record = nullptr;
    cad(acdbOpenObject(record, entity->ownerId(), AcDb::kForRead));
    bool ok = record->isLayout() && !record->isFromExternalReference() &&
              entity->ownerId() == acdbSymUtil()->blockModelSpaceId(db);
    record->close();
    need(ok, "UNSUPPORTED_ON_PLATFORM", "Only modelspace entities are supported");
}
void writable_entity(AcDbDatabase *db, AcDbEntity *e) {
    modelspace(db, e);
    need(type(e) != "UNSUPPORTED", "UNSUPPORTED_ON_PLATFORM", "Unsupported entity type");
    if (type(e) == "3DSOLID")
        need(state(db).boxes.contains(handle(e)), "UNSUPPORTED_ON_PLATFORM",
             "Only bridge-created box solids are editable in this phase");
    AcDbLayerTableRecord *layer = nullptr;
    cad(acdbOpenObject(layer, e->layerId(), AcDb::kForRead));
    bool locked = layer->isLocked();
    layer->close();
    need(!locked, "SECURITY_DENIED", "Layer is locked");
}

void validate(const std::string &method, const json &p) {
    need(runtime && GetFileAttributesW(runtime->grant_file().c_str()) != INVALID_FILE_ATTRIBUTES,
         "IPC_AUTH_FAILED", "Pairing revoked before CAD execution");
    static const std::map<std::string, std::set<std::string>> fields = {
        {"acad_get_status", {"instanceId"}},
        {"acad_get_capabilities", {"instanceId", "documentId", "documentEpoch"}},
        {"acad_list_documents", {"instanceId"}},
        {"acad_get_document_info", {"instanceId", "documentId", "documentEpoch"}},
        {"acad_query_entities",
         {"instanceId", "documentId", "documentEpoch", "coordinateSystem", "lengthUnit", "projection",
          "filter", "limit", "cursor"}},
        {"acad_get_entity",
         {"instanceId", "documentId", "documentEpoch", "coordinateSystem", "lengthUnit", "projection",
          "entityRef"}},
        {"acad_create_line",
         {"instanceId", "documentId", "documentEpoch", "expectedRevision", "operationId", "coordinateSystem",
          "lengthUnit", "start", "end", "layer"}},
        {"acad_create_circle",
         {"instanceId", "documentId", "documentEpoch", "expectedRevision", "operationId", "coordinateSystem",
          "lengthUnit", "center", "radius", "normal", "layer"}},
        {"acad_create_box",
         {"instanceId", "documentId", "documentEpoch", "expectedRevision", "operationId", "coordinateSystem",
          "lengthUnit", "center", "size", "layer"}},
        {"acad_move_entities",
         {"instanceId", "documentId", "documentEpoch", "expectedRevision", "operationId", "coordinateSystem",
          "lengthUnit", "targets", "delta"}},
        {"acad_erase_entities",
         {"instanceId", "documentId", "documentEpoch", "expectedRevision", "operationId", "targets"}},
        {"acad_get_operation_status", {"instanceId", "documentId", "documentEpoch", "operationId"}},
        {"acad_save_copy",
         {"instanceId", "documentId", "documentEpoch", "expectedRevision", "operationId", "outputRootId",
          "relativePath", "overwrite"}}};
    if (method == "acad_list_instances") {
        need(p.empty());
        return;
    }
    if (method == "bridge.test_done"
#ifdef AUTOCAD_MCP_TESTING
        || method == "bridge.test_action"
#endif
    ) {
        const std::size_t expected_size = method == "bridge.test_done" ? 1 : 2;
        need(GetEnvironmentVariableW(L"MCP_TEST_MODE", nullptr, 0) > 0 && p.size() == expected_size &&
                 text(p, "instanceId") == runtime->instance(),
             "SECURITY_DENIED", "Test control unavailable");
        return;
    }
    auto rule = fields.find(method);
    need(rule != fields.end());
    for (auto it = p.begin(); it != p.end(); ++it)
        need(rule->second.contains(it.key()));
    need(text(p, "instanceId") == runtime->instance(), "INSTANCE_NOT_FOUND", "Instance is not paired");
    if (method != "acad_get_status" && method != "acad_get_capabilities" && method != "acad_list_documents") {
        need(std::regex_match(text(p, "documentId"), std::regex("[A-Za-z0-9_-]{1,128}")));
        need(number(p, "documentEpoch") > 0);
    }
    if (method == "acad_get_capabilities")
        need(p.contains("documentId") == p.contains("documentEpoch"));
    if (mutation(method) || method == "acad_get_operation_status")
        need(std::regex_match(text(p, "operationId"), std::regex("[A-Za-z0-9_-]{1,128}")));
    if (mutation(method))
        number(p, "expectedRevision");
    if (method == "acad_get_entity" || method == "acad_query_entities" || method == "acad_create_line" ||
        method == "acad_create_circle" || method == "acad_create_box" || method == "acad_move_entities")
        need(text(p, "coordinateSystem") == "WCS");
    if (p.contains("projection")) {
        need(p.at("projection").is_array() && p.at("projection").size() > 0 &&
             p.at("projection").size() <= 11);
        std::set<std::string> found;
        for (auto &field : p.at("projection")) {
            need(field.is_string());
            auto f = field.get<std::string>();
            need(std::set<std::string>{"handle", "type", "layer", "start", "end", "center", "radius", "size",
                                       "extents", "volume"}
                     .contains(f) &&
                 found.insert(f).second);
        }
    }
}

struct DocumentContext {
    AcApDocument *doc = nullptr;
    AcApDocument *previous = nullptr;
    bool locked = false, switched = false;
    explicit DocumentContext(const json &p, bool writing = false) {
        std::unique_ptr<AcApDocumentIterator> iter(acDocManager->getDocumentIterator());
        for (; !iter->done(); iter->step()) {
            auto candidate = iter->document();
            if (state(candidate->database()).id == text(p, "documentId")) {
                doc = candidate;
                break;
            }
        }
        need(doc != nullptr, "DOC_NOT_FOUND", "Drawing is not open");
        need(state(doc->database()).epoch == number(p, "documentEpoch"), "STALE_DOCUMENT",
             "Drawing epoch changed");
        if (writing)
            need(!doc->isReadOnly(), "DOC_READ_ONLY", "Drawing is read only");
        previous = acDocManager->curDocument();
        if (acDocManager->isApplicationContext()) {
            const auto main_window = adsw_acadMainWnd();
            need(!main_window || IsWindowEnabled(main_window), "DOC_BUSY",
                 "AutoCAD has an active modal window");
            need(doc->isQuiescent() || test_pumping, "DOC_BUSY", "Drawing is busy");
            cad(acDocManager->lockDocument(doc, writing ? AcAp::kWrite : AcAp::kRead, nullptr, nullptr,
                                           false));
            locked = true;
            if (doc != previous) {
                auto result = acDocManager->setCurDocument(doc, AcAp::kNone, false);
                if (result != Acad::eOk) {
                    acDocManager->unlockDocument(doc);
                    locked = false;
                    cad(result);
                }
                switched = true;
            }
        } else
            need(doc == previous, "DOC_BUSY", "Target drawing is not available in this command context");
    }
    ~DocumentContext() {
        if (switched && previous)
            acDocManager->setCurDocument(previous, AcAp::kNone, false);
        if (locked)
            acDocManager->unlockDocument(doc);
    }
};

int dbmod() {
    resbuf value{};
    need(acedGetVar(L"DBMOD", &value) == RTNORM, "EXECUTION_FAILED", "Dirty state unavailable");
    return value.resval.rint;
}
json doc_info(AcApDocument *doc) {
    auto db = doc->database();
    auto result = identity(db);
    result["revision"] = state(db).revision;
    result["readOnly"] = doc->isReadOnly();
    result["insunits"] = static_cast<int>(db->insunits());
    result["dirty"] = doc == acDocManager->curDocument() ? json(dbmod() != 0) : json(nullptr);
    return result;
}

json project(json values, const json &p) {
    json output = json::object(), unavailable = json::array();
    auto fields = p.value("projection", json::array({"handle", "type", "layer"}));
    for (auto &field : fields) {
        auto key = field.get<std::string>();
        if (values.contains(key))
            output[key] = values.at(key);
        else
            unavailable.push_back(key);
    }
    output["unavailableFields"] = unavailable;
    return output;
}

AcDbObjectId iterator_id(AcDbBlockTableRecordIterator *it) {
    AcDbObjectId id;
    cad(it->getEntityId(id));
    return id;
}
json query(AcDbDatabase *db, const json &p) {
    auto &s = state(db);
    double f = output_factor(db, p);
    Transaction tx(db);
    auto record = tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db));
    if (p.contains("entityRef")) {
        const auto &er = p.at("entityRef");
        need(er.is_object() && er.size() == 3 && text(er, "documentId") == s.id &&
             number(er, "documentEpoch") == s.epoch);
        auto e = tx.get<AcDbEntity>(object_id(db, text(er, "handle")));
        modelspace(db, e);
        auto result = json{{"entity", project(geometry(e, f), p)},
                           {"revision", s.revision},
                           {"lengthUnit", p.value("lengthUnit", std::string("drawing_unit"))},
                           {"coordinateSystem", "WCS"}};
        tx.commit();
        return result;
    }
    need(p.contains("filter") && p.at("filter").is_object());
    const auto &filter = p.at("filter");
    need(filter.size() <= 2);
    for (auto it = filter.begin(); it != filter.end(); ++it)
        need((it.key() == "type" || it.key() == "layer") && it.value().is_string());
    const auto requested = filter.value("type", std::string());
    need(requested.empty() || requested == "LINE" || requested == "CIRCLE" || requested == "3DSOLID");
    const auto limit = p.contains("limit") ? number(p, "limit") : 100;
    need(limit >= 1 && limit <= 1000);
    json signature = p;
    signature.erase("cursor");
    const auto fingerprint = signature.dump();
    std::size_t offset = 0;
    if (p.contains("cursor")) {
        auto it = cursors.find(text(p, "cursor"));
        need(it != cursors.end() && it->second.document == s.id && it->second.epoch == s.epoch &&
                 it->second.revision == s.revision && it->second.signature == fingerprint,
             "STALE_CURSOR", "Query cursor expired");
        offset = it->second.offset;
    }
    AcDbBlockTableRecordIterator *raw = nullptr;
    cad(record->newIterator(raw));
    std::unique_ptr<AcDbBlockTableRecordIterator> iter(raw);
    std::size_t index = 0, scanned = 0, response_bytes = 2;
    json items = json::array();
    for (; !iter->done() && (index < offset || scanned < 10000); iter->step(), ++index) {
        if (index < offset)
            continue;
        scanned++;
        auto e = tx.get<AcDbEntity>(iterator_id(iter.get()));
        auto kind = type(e);
        if (kind == "UNSUPPORTED" || (!requested.empty() && kind != requested) ||
            (filter.contains("layer") && layer_name(e) != filter.at("layer").get<std::string>()))
            continue;
        auto candidate = project(geometry(e, f), p);
        const auto candidate_bytes = candidate.dump().size() + 1;
        if (response_bytes + candidate_bytes > 350000) {
            need(!items.empty(), "VALIDATION_FAILED", "Entity exceeds response budget");
            scanned--;
            break;
        }
        items.push_back(candidate);
        response_bytes += candidate_bytes;
        if (items.size() >= limit) {
            iter->step();
            index++;
            break;
        }
    }
    json cursor = nullptr;
    if (!iter->done()) {
        need(cursors.size() < 1000, "DOC_BUSY", "Cursor quota reached");
        auto key = mcp::random_hex(16);
        cursors[key] = {s.id, fingerprint, s.epoch, s.revision, index};
        cursor = key;
    }
    json result = {{"items", items},
                   {"scanned", scanned},
                   {"truncated", !cursor.is_null()},
                   {"cursor", cursor},
                   {"revision", s.revision},
                   {"lengthUnit", p.value("lengthUnit", std::string("drawing_unit"))},
                   {"coordinateSystem", "WCS"}};
    tx.commit();
    return result;
}

bool close_point(const json &actual, const json &expected, double tolerance) {
    if (!actual.is_array() || !expected.is_array() || actual.size() != 3 || expected.size() != 3)
        return false;
    for (int i = 0; i < 3; ++i)
        if (!actual[i].is_number() || !expected[i].is_number() || !std::isfinite(actual[i].get<double>()) ||
            std::abs(actual[i].get<double>() - expected[i].get<double>()) > tolerance)
            return false;
    return true;
}
bool verify_geometry(const std::string &method, const json &p, const json &before, const json &after) {
    auto unit = p.value("lengthUnit", std::string("drawing_unit"));
    const double tolerance = unit == "m" ? 1e-9 : unit == "inch" ? 1e-6 / 25.4 : 1e-6;
    if (method == "acad_create_line")
        return close_point(after[0].at("start"), p.at("start"), tolerance) &&
               close_point(after[0].at("end"), p.at("end"), tolerance);
    if (method == "acad_create_circle")
        return close_point(after[0].at("center"), p.at("center"), tolerance) &&
               std::abs(after[0].at("radius").get<double>() - p.at("radius").get<double>()) <= tolerance;
    if (method == "acad_create_box") {
        const auto &size = p.at("size");
        double expected = size[0].get<double>() * size[1].get<double>() * size[2].get<double>();
        return close_point(after[0].at("center"), p.at("center"), tolerance) &&
               close_point(after[0].at("size"), size, tolerance) && std::isfinite(expected) &&
               std::abs(after[0].at("volume").get<double>() - expected) <=
                   std::max(1e-12, std::abs(expected) * 1e-8);
    }
    if (method == "acad_move_entities") {
        if (before.size() != after.size())
            return false;
        for (std::size_t i = 0; i < before.size(); ++i) {
            for (const auto &field : {"start", "end", "center"}) {
                if (!before[i].contains(field))
                    continue;
                auto expected = before[i].at(field);
                for (int a = 0; a < 3; ++a)
                    expected[a] = expected[a].get<double>() + p.at("delta")[a].get<double>();
                if (!close_point(after[i].at(field), expected, tolerance))
                    return false;
            }
        }
    }
    return true;
}
json mutate(AcDbDatabase *db, const std::string &method, const json &p) {
    auto &s = state(db);
    need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before operation");
    const double f = method == "acad_erase_entities" ? 1 : input_factor(db, p);
    Transaction tx(db);
    auto model = tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db), AcDb::kForWrite);
    std::vector<AcDbEntity *> selected;
    json before = json::array();
    if (method == "acad_move_entities" || method == "acad_erase_entities") {
        need(p.contains("targets") && p.at("targets").is_array() && !p.at("targets").empty() &&
             p.at("targets").size() <= 100);
        std::set<std::string> unique;
        for (const auto &er : p.at("targets")) {
            need(er.is_object() && er.size() == 3 && text(er, "documentId") == s.id &&
                 number(er, "documentEpoch") == s.epoch);
            auto id = object_id(db, text(er, "handle"));
            auto entity = tx.get<AcDbEntity>(id, AcDb::kForWrite);
            writable_entity(db, entity);
            need(unique.insert(handle(entity)).second);
            selected.push_back(entity);
        }
    }
    if (method == "acad_move_entities")
        for (auto e : selected)
            before.push_back(geometry(e, output_factor(db, p)));
    std::unique_ptr<AcDbEntity> created;
    if (method == "acad_create_line") {
        auto a = point(p, "start", f), b = point(p, "end", f);
        need(a.distanceTo(b) > 0);
        created = std::make_unique<AcDbLine>(a, b);
    }
    if (method == "acad_create_circle") {
        auto c = point(p, "center", f);
        need(p.contains("radius") && p.at("radius").is_number());
        double radius = p.at("radius").get<double>() * f;
        need(std::isfinite(radius) && radius > 0);
        if (p.contains("normal"))
            need(point(p, "normal") == AcGePoint3d(0, 0, 1));
        created = std::make_unique<AcDbCircle>(c, AcGeVector3d::kZAxis, radius);
    }
    if (method == "acad_create_box") {
        auto center = point(p, "center", f), size = point(p, "size", f);
        need(size.x >= 1e-6 && size.y >= 1e-6 && size.z >= 1e-6);
        auto box = std::make_unique<AcDb3dSolid>();
        cad(box->createBox(size.x, size.y, size.z));
        cad(box->transformBy(AcGeMatrix3d::translation(center - AcGePoint3d::kOrigin)));
        created = std::move(box);
    }
    json result = {{"operationId", text(p, "operationId")},
                   {"status", "succeeded"},
                   {"applied", true},
                   {"verified", false},
                   {"created", json::array()},
                   {"modified", json::array()},
                   {"erased", json::array()},
                   {"observedGeometry", nullptr},
                   {"error", nullptr}};
    include(result, identity(db));
    std::vector<AcDbObjectId> verify;
    std::vector<std::string> new_boxes;
    check_cancel();
    s.writing = true;
    try {
        if (created) {
            created->setDatabaseDefaults(db);
            if (p.contains("layer"))
                cad(created->setLayer(wide(text(p, "layer")).c_str()));
            else
                cad(created->setLayer(db->clayer()));
            AcDbLayerTableRecord *layer = nullptr;
            cad(acdbOpenObject(layer, created->layerId(), AcDb::kForRead));
            bool locked = layer->isLocked();
            layer->close();
            need(!locked, "SECURITY_DENIED", "Layer is locked");
            AcDbObjectId id;
            cad(model->appendAcDbEntity(id, created.get()));
            auto entity = created.release();
            cad(tx.manager->addNewlyCreatedDBRObject(entity, true));
            result["created"].push_back(ref(db, entity));
            verify.push_back(id);
            if (method == "acad_create_box")
                new_boxes.push_back(handle(entity));
        } else {
            auto delta = method == "acad_move_entities" ? point(p, "delta", f) : AcGePoint3d::kOrigin;
            for (auto entity : selected) {
                check_cancel();
                auto er = ref(db, entity);
                if (method == "acad_move_entities") {
                    cad(entity->transformBy(AcGeMatrix3d::translation(delta - AcGePoint3d::kOrigin)));
                    result["modified"].push_back(er);
                } else {
                    cad(entity->erase());
                    result["erased"].push_back(er);
                }
                verify.push_back(entity->objectId());
            }
        }
#ifdef AUTOCAD_MCP_TESTING
        if (next_fault == "abort_unconfirmed") {
            next_fault.clear();
            test_abort_uncertain = true;
            throw Failure{"EXECUTION_FAILED", "Synthetic unconfirmed rollback"};
        }
#endif
        test_fault("abort_before_commit");
        test_fault("delay_before_commit");
        check_cancel();
        tx.commit();
        s.writing = false;
        s.revision++;
        for (auto &h : new_boxes)
            s.boxes.insert(h);
        cursors.clear();
    } catch (...) {
        s.writing = false;
        if (!tx.active) {
            result["status"] = "failed";
            result["verified"] = false;
            result["revision"] = s.revision;
            result["error"] = {{"code", "VERIFICATION_FAILED"},
                               {"message", "Changes committed; post-commit bookkeeping failed"},
                               {"retryable", false}};
            return result;
        }
        throw;
    }
    result["revision"] = s.revision;
    try {
        test_fault("verify_after_commit");
        test_fault("delay_after_commit");
        Transaction read(db);
        json values = json::array();
        const double out = method == "acad_erase_entities" ? 1 : output_factor(db, p);
        for (auto id : verify) {
            AcDbEntity *entity = nullptr;
            cad(read.manager->getObject(entity, id, AcDb::kForRead, method == "acad_erase_entities"));
            need(entity != nullptr, "VERIFICATION_FAILED", "Entity unavailable after commit");
            if (method == "acad_erase_entities")
                need(entity->isErased(), "VERIFICATION_FAILED", "Entity was not erased");
            else
                values.push_back(geometry(entity, out));
        }
        read.commit();
        need(verify_geometry(method, p, before, values), "VERIFICATION_FAILED",
             "Measured geometry differs from requested result");
        result["verified"] = true;
        result["observedGeometry"] = {
            {"items", values},
            {"lengthUnit", p.value("lengthUnit", std::string("drawing_unit"))},
            {"volumeUnit", p.value("lengthUnit", std::string("drawing_unit")) + "^3"},
            {"coordinateSystem", "WCS"}};
    } catch (...) {
        result["status"] = "failed";
        result["verified"] = false;
        result["error"] = {{"code", "VERIFICATION_FAILED"},
                           {"message", "Committed changes could not be verified"},
                           {"retryable", false}};
    }
    return result;
}

struct Handles {
    std::vector<HANDLE> values;
    ~Handles() {
        for (auto h : values)
            CloseHandle(h);
    }
};
void pin_directories(const std::filesystem::path &directory, Handles &handles) {
    auto path = directory;
    for (;;) {
        auto h =
            CreateFileW(path.c_str(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
                        OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
        need(h != INVALID_HANDLE_VALUE, "OUTPUT_PATH_DENIED", "Cannot pin output directory");
        handles.values.push_back(h);
        FILE_ATTRIBUTE_TAG_INFO info{};
        need(GetFileInformationByHandleEx(h, FileAttributeTagInfo, &info, sizeof(info)) &&
                 !(info.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT),
             "OUTPUT_PATH_DENIED", "Reparse output path rejected");
        if (path == path.root_path())
            break;
        auto parent = path.parent_path();
        need(parent != path, "OUTPUT_PATH_DENIED", "Invalid output root");
        path = parent;
    }
}
std::size_t entity_count(AcDbDatabase *db) {
    Transaction tx(db);
    auto record = tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db));
    AcDbBlockTableRecordIterator *raw = nullptr;
    cad(record->newIterator(raw));
    std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);
    std::size_t count = 0;
    for (; !it->done(); it->step())
        count++;
    tx.commit();
    return count;
}
json snapshot_geometry(AcDbDatabase *db) {
    Transaction tx(db);
    auto record = tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db));
    AcDbBlockTableRecordIterator *raw = nullptr;
    cad(record->newIterator(raw));
    std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);
    json values = json::array();
    std::size_t scanned = 0;
    for (; !it->done(); it->step()) {
        need(++scanned <= 10000, "DOC_BUSY", "Snapshot verification scan limit reached");
        auto e = tx.get<AcDbEntity>(iterator_id(it.get()));
        if (type(e) == "UNSUPPORTED")
            continue;
        auto value = geometry(e, 1);
        value.erase("handle");
        values.push_back(std::move(value));
    }
    tx.commit();
    return values;
}
bool same_geometry(const json &a, const json &b) {
    if (a.is_number() && b.is_number()) {
        const double x = a.get<double>(), y = b.get<double>();
        return std::isfinite(x) && std::isfinite(y) &&
               std::abs(x - y) <= std::max(1e-12, std::max(std::abs(x), std::abs(y)) * 1e-8);
    }
    if (a.type() != b.type() || a.size() != b.size())
        return false;
    if (a.is_object()) {
        for (auto it = a.begin(); it != a.end(); ++it)
            if (!b.contains(it.key()) || !same_geometry(it.value(), b.at(it.key())))
                return false;
        return true;
    }
    if (a.is_array()) {
        for (std::size_t i = 0; i < a.size(); ++i)
            if (!same_geometry(a[i], b[i]))
                return false;
        return true;
    }
    return a == b;
}
json save_copy(AcDbDatabase *db, const json &p) {
    auto &s = state(db);
    need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before save");
    need(text(p, "outputRootId") == "test-output", "OUTPUT_PATH_DENIED", "Output root not granted");
    need(p.contains("overwrite") && p.at("overwrite") == false);
    const auto name = text(p, "relativePath");
    need(name.size() <= 255 && name.find_first_of("/\\:") == std::string::npos && name != "." &&
             name != ".." && name.back() != '.' && name.back() != ' ',
         "OUTPUT_PATH_DENIED", "Phase 2 accepts a flat DWG filename only");
    need(name.find_first_of("*?\"<>|") == std::string::npos &&
             !std::regex_search(
                 name, std::regex("^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])([.]|$)", std::regex::icase)) &&
             std::none_of(name.begin(), name.end(), [](unsigned char c) { return c < 32; }),
         "OUTPUT_PATH_DENIED", "Invalid output filename");
    auto destination = output_root / wide(name);
    need(_wcsicmp(destination.extension().c_str(), L".dwg") == 0, "OUTPUT_PATH_DENIED",
         "DWG extension required");
    Handles pinned;
    pin_directories(output_root, pinned);
    need(GetFileAttributesW(destination.c_str()) == INVALID_FILE_ATTRIBUTES, "FILE_EXISTS",
         "Output file already exists");
    const auto original_name = std::wstring(acDocManager->curDocument()->fileName());
    const auto original_units = db->insunits();
    const auto original_dirty = dbmod();
    const auto count = entity_count(db);
    const auto original_geometry = snapshot_geometry(db);
    auto staging = output_root / (L"staging-" + wide(mcp::random_hex(16)));
    need(CreateDirectoryW(staging.c_str(), nullptr) != FALSE, "OUTPUT_PATH_DENIED",
         "Cannot create staging directory");
    auto temporary = staging / L"drawing.dwg";
    bool published = false;
    json result;
    try {
        AcDbDatabase *raw = nullptr;
        cad(db->wblock(raw));
        std::unique_ptr<AcDbDatabase> copy(raw);
        need(copy != nullptr, "EXECUTION_FAILED", "Snapshot creation failed");
        cad(copy->saveAs(temporary.c_str(), false));
        copy.reset();
#ifdef AUTOCAD_MCP_TESTING
        if (next_fault == "source_side_effect") {
            next_fault.clear();
            cad(db->setInsunits(static_cast<AcDb::UnitsValue>(6)));
        }
#endif
        AcDbDatabase reopened(false, true);
        test_fault("reopen_failure");
        cad(reopened.readDwgFile(temporary.c_str(), AcDbDatabase::kForReadAndAllShare, false));
        cad(reopened.closeInput(true));
        need(entity_count(&reopened) == count && reopened.insunits() == original_units, "VERIFICATION_FAILED",
             "DWG snapshot differs");
        need(same_geometry(original_geometry, snapshot_geometry(&reopened)), "VERIFICATION_FAILED",
             "Reopened geometry differs from source");
        need(std::wstring(acDocManager->curDocument()->fileName()) == original_name &&
                 dbmod() == original_dirty && db->insunits() == original_units,
             "PARTIAL_APPLY", "Source state changed during snapshot; no output was published");
        result = {{"operationId", text(p, "operationId")},
                  {"status", "succeeded"},
                  {"applied", true},
                  {"verified", true},
                  {"created", json::array()},
                  {"modified", json::array()},
                  {"erased", json::array()},
                  {"observedGeometry", nullptr},
                  {"revision", s.revision},
                  {"error", nullptr},
                  {"output", {{"outputRootId", "test-output"}, {"relativePath", name}}},
                  {"verification",
                   {{"modelspaceEntityCount", count},
                    {"supportedGeometryCount", original_geometry.size()},
                    {"scope", "LINE/CIRCLE/3DSOLID modelspace geometry, count and INSUNITS"},
                    {"otherDrawingDataVerified", false}}}};
        include(result, identity(db));
        check_cancel();
        // Prepare the response before publishing, so allocation failures cannot hide a written file.
        if (!MoveFileExW(temporary.c_str(), destination.c_str(), MOVEFILE_WRITE_THROUGH)) {
            auto code = GetLastError();
            throw Failure{code == ERROR_ALREADY_EXISTS || code == ERROR_FILE_EXISTS ? "FILE_EXISTS"
                                                                                    : "OUTPUT_PATH_DENIED",
                          "Output publication failed"};
        }
        published = true;
        test_fault("delay_after_publish");
    } catch (...) {
        std::error_code ignored;
        if (!published)
            std::filesystem::remove(temporary, ignored);
        std::filesystem::remove(staging, ignored);
        if (published) {
            result["status"] = "partial";
            result["verified"] = false;
            result["error"] = {{"code", "PARTIAL_APPLY"},
                               {"message", "Output was published before failure"},
                               {"retryable", false}};
            return result;
        }
        if (std::wstring(acDocManager->curDocument()->fileName()) != original_name ||
            dbmod() != original_dirty || db->insunits() != original_units)
            throw Failure{"PARTIAL_APPLY", "Source state changed before output publication"};
        throw;
    }
    std::error_code ignored;
    std::filesystem::remove(staging, ignored);
    return result;
}

#ifdef AUTOCAD_MCP_TESTING
class SyntheticVeto : public AcApDocManagerReactor {
  public:
    bool enabled = false;
    void documentLockModeChanged(AcApDocument *, AcAp::DocLockMode, AcAp::DocLockMode next, AcAp::DocLockMode,
                                 const ACHAR *) override {
        if (enabled && (next & AcAp::kWrite))
            veto();
    }
} synthetic_veto;
bool veto_registered = false;
HWND test_dispatcher = nullptr;
std::atomic<bool> synthetic_modal_active{false};
INT_PTR CALLBACK synthetic_dialog(HWND dialog, UINT msg, WPARAM, LPARAM) {
    if (msg == WM_INITDIALOG) {
        synthetic_modal_active = true;
        SetTimer(dialog, 1, 1200, nullptr);
        return TRUE;
    }
    if (msg == WM_TIMER) {
        KillTimer(dialog, 1);
        EndDialog(dialog, 0);
        return TRUE;
    }
    return FALSE;
}
void open_synthetic_modal() {
    struct Template {
        DLGTEMPLATE dialog;
        WORD menu, cls, title;
    } data{};
    data.dialog.style = WS_POPUP | WS_CAPTION | WS_SYSMENU | DS_MODALFRAME;
    data.dialog.cx = 180;
    data.dialog.cy = 50;
    DialogBoxIndirectParamW(GetModuleHandleW(nullptr), &data.dialog, adsw_acadMainWnd(), synthetic_dialog, 0);
    synthetic_modal_active = false;
}
// Fixed actions for our synthetic desktop acceptance process. No raw commands or paths
// can be supplied by the caller; this code is excluded from normal builds.
json desktop_test_action(const json &p) {
    need(acDocManager->isApplicationContext(), "DOC_BUSY", "Test action needs application context");
    const auto root = runtime->grant_file().parent_path().parent_path().parent_path();
    need(root.parent_path().filename() == L"desktop-runs", "SECURITY_DENIED", "Not a desktop test session");
    auto find_document = [&](const wchar_t *name) -> AcApDocument * {
        const auto expected = (root / name).lexically_normal().wstring();
        auto iter = acDocManager->getDocumentIterator();
        for (; !iter->done(); iter->step()) {
            auto doc = iter->document();
            if (_wcsicmp(std::filesystem::path(doc->fileName()).lexically_normal().c_str(),
                         expected.c_str()) == 0)
                return doc;
        }
        return nullptr;
    };
    auto primary = find_document(L"primary.dwg");
    need(primary != nullptr, "SECURITY_DENIED", "Synthetic primary drawing is not open");
    const auto action = text(p, "action");
    const std::set<std::string> faults = {"abort_before_commit", "delay_before_commit", "verify_after_commit",
                                          "delay_after_commit",  "reopen_failure",      "delay_after_publish",
                                          "abort_unconfirmed",   "source_side_effect"};
    if (faults.contains(action)) {
        next_fault = action;
        return {{"armed", true}};
    }
    if (action == "quit" || action == "restart" || action == "assert_owned") {
        // A user may open another file while the visible test window is left open.
        // Never let synthetic cleanup close an unrelated drawing in that process.
        auto iter = acDocManager->getDocumentIterator();
        for (; !iter->done(); iter->step()) {
            const auto path = std::filesystem::path(iter->document()->fileName()).lexically_normal();
            const bool ours = _wcsicmp(path.c_str(), (root / L"primary.dwg").c_str()) == 0 ||
                              _wcsicmp(path.c_str(), (root / L"secondary.dwg").c_str()) == 0;
            need(ours, "SECURITY_DENIED", "Unrelated drawing is open; synthetic cleanup is refused");
        }
    }
    if (action == "begin_outer_transaction" || action == "end_outer_transaction") {
        auto target = identity(primary->database());
        DocumentContext context(target, true);
        if (action == "begin_outer_transaction") {
            need(!synthetic_outer_transaction);
            synthetic_outer_transaction = std::make_unique<Transaction>(primary->database());
        } else
            synthetic_outer_transaction.reset();
        return {{"open", synthetic_outer_transaction != nullptr}};
    }
    if (action == "restore_units") {
        auto target = identity(primary->database());
        DocumentContext context(target, true);
        cad(primary->database()->setInsunits(static_cast<AcDb::UnitsValue>(4)));
        return {{"restored", true}};
    }
    if (action == "assert_owned")
        return {{"owned", true}};
    if (action == "seal_records") {
        jobs->seal_records_for_test();
        return {{"sealed", true}};
    }
    if (action == "modal") {
        need(SetTimer(test_dispatcher, 42, 50, nullptr) != 0);
        return {{"queued", true}};
    }
    if (action == "veto_on" || action == "veto_off") {
        if (!veto_registered) {
            acDocManager->addReactor(&synthetic_veto);
            veto_registered = true;
        }
        synthetic_veto.enabled = action == "veto_on";
        return {{"enabled", synthetic_veto.enabled}};
    }
    if (action == "seed_arc" || action == "external_edit") {
        auto target = identity(primary->database());
        DocumentContext context(target, true);
        auto db = primary->database();
        Transaction tx(db);
        auto model = tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db), AcDb::kForWrite);
        std::unique_ptr<AcDbEntity> entity;
        if (action == "seed_arc")
            entity = std::make_unique<AcDbArc>(AcGePoint3d(20, 20, 0), AcGeVector3d::kZAxis, 10, 0, 1);
        else
            entity = std::make_unique<AcDbLine>(AcGePoint3d(5, 5, 0), AcGePoint3d(15, 5, 0));
        entity->setDatabaseDefaults(db);
        AcDbObjectId id;
        cad(model->appendAcDbEntity(id, entity.get()));
        auto raw = entity.release();
        cad(tx.manager->addNewlyCreatedDBRObject(raw, true));
        auto er = ref(db, raw);
        tx.commit();
        return {{"entityRef", er}};
    }
    if (action == "open_secondary" || action == "open_readonly") {
        need(find_document(L"secondary.dwg") == nullptr);
        const auto path = (root / L"secondary.dwg").wstring();
        if (action == "open_readonly") {
            AcApDocManager::DocOpenParams params{};
            params.mpwszFileName = path.c_str();
            params.mnInitialViewType = AcApDocManager::DocOpenParams::kDefaultView;
            params.mnFlags = AcApDocManager::DocOpenParams::kRequireReadOnly |
                             AcApDocManager::DocOpenParams::kFileNameArgIsUnicode;
            cad(acDocManager->appContextOpenDocument(&params));
        } else
            cad(acDocManager->appContextOpenDocument(path.c_str()));
        auto secondary = find_document(L"secondary.dwg");
        need(secondary != nullptr, "EXECUTION_FAILED", "Synthetic secondary did not open");
        return doc_info(secondary);
    }
    if (action == "activate_primary" || action == "activate_secondary") {
        auto target = action == "activate_primary" ? primary : find_document(L"secondary.dwg");
        need(target != nullptr, "DOC_NOT_FOUND", "Synthetic drawing is closed");
        cad(acDocManager->activateDocument(target));
        return identity(target->database());
    }
    if (action == "context") {
        resbuf value{};
        need(acedGetVar(L"CMDACTIVE", &value) == RTNORM);
        json result = {{"commandActive", value.resval.rint}, {"primaryQuiescent", primary->isQuiescent()}};
        if (auto active = acDocManager->mdiActiveDocument())
            result["active"] = identity(active->database());
        if (auto current = acDocManager->curDocument())
            result["current"] = identity(current->database());
        return result;
    }
    if (action == "begin_line" || action == "cancel_line" || action == "undo_primary" || action == "quit" ||
        action == "restart") {
        need(acDocManager->mdiActiveDocument() == primary, "SECURITY_DENIED",
             "Synthetic primary must be active");
        if (action != "cancel_line")
            need(primary->isQuiescent(), "DOC_BUSY", "Test drawing is busy");
        const wchar_t *command = action == "begin_line"     ? L"_.LINE\n"
                                 : action == "cancel_line"  ? L"\x03\x03"
                                 : action == "undo_primary" ? L"_.UNDO\n1\n"
                                 : action == "restart"      ? L"MCPSTOP\nMCPSTART\n"
                                                            : L"MCPSTOP\n_.QUIT\n_N\n";
        cad(acDocManager->sendStringToExecute(primary, command, true, false, false));
        return {{"queued", true}};
    }
    if (action == "close_secondary") {
        auto secondary = find_document(L"secondary.dwg");
        need(secondary != nullptr, "DOC_NOT_FOUND", "Synthetic secondary is not open");
        cad(acDocManager->appContextCloseDocument(secondary));
        return {{"closed", true}};
    }
    if (action == "lock_layer" || action == "unlock_layer") {
        auto target = identity(primary->database());
        DocumentContext context(target, true);
        auto db = primary->database();
        Transaction tx(db);
        auto layers = tx.get<AcDbLayerTable>(db->layerTableId(), AcDb::kForWrite);
        AcDbObjectId id;
        if (layers->getAt(L"MCP_LOCKED", id) != Acad::eOk) {
            auto record = std::make_unique<AcDbLayerTableRecord>();
            cad(record->setName(L"MCP_LOCKED"));
            cad(layers->add(id, record.get()));
            auto raw = record.release();
            cad(tx.manager->addNewlyCreatedDBRObject(raw, true));
        }
        tx.get<AcDbLayerTableRecord>(id, AcDb::kForWrite)->setIsLocked(action == "lock_layer");
        tx.commit();
        return {{"locked", action == "lock_layer"}};
    }
    throw Failure{"VALIDATION_FAILED", "Unknown synthetic test action"};
}
#endif

json execute(const json &request) {
    auto method = request.at("method").get<std::string>();
    const auto &p = request.at("params");
    try {
        validate(method, p);
#ifdef AUTOCAD_MCP_TESTING
        if (method == "bridge.test_action")
            return desktop_test_action(p);
#endif
        if (method == "acad_list_instances")
            return {{"instances",
                     json::array({{{"instanceId", runtime->instance()}, {"backend", "objectarx"}}})}};
        if (method == "acad_get_status")
            return {{"instanceId", runtime->instance()},
                    {"backend", "objectarx"},
                    {"simulation", false},
                    {"connected", true},
                    {"bridgeVersion", "0.1.0"},
                    {"autocadVersion", "2027"},
                    {"platform", "windows"},
                    {"architecture", "x64"}};
        if (method == "acad_list_documents") {
            json result = json::array();
            std::unique_ptr<AcApDocumentIterator> iter(acDocManager->getDocumentIterator());
            for (; !iter->done(); iter->step())
                result.push_back(doc_info(iter->document()));
            return {{"documents", result}};
        }
        if (method == "acad_get_capabilities") {
            if (p.contains("documentId")) {
                DocumentContext context(p);
            }
            json result = json::array();
            for (auto &n : names)
                result.push_back({{"name", n}, {"supported", true}, {"experimental", true}});
            return {
                {"operations", result},
                {"backend", "objectarx"},
                {"simulation", false},
                {"limits",
                 {{"maxFrame", mcp::max_frame},
                  {"maxBody", mcp::max_body},
                  {"queryLimit", 1000},
                  {"maxTargets", 100},
                  {"concurrentCalls", 1},
                  {"flatOutputFilenameOnly", true}}},
                {"outputRoots", json::array({{{"id", "test-output"}, {"scope", "private session output"}}})}};
        }
        if (mutation(method))
            need(!rollback_uncertain, "DOC_BUSY",
                 "An earlier rollback could not be confirmed; restart pairing before writing");
        bool write_context = mutation(method) && method != "acad_save_copy";
#ifdef AUTOCAD_MCP_TESTING
        // The normal snapshot holds a read lock. Only the synthetic side-effect
        // fixture takes a write lock so its deliberate source mutation can occur.
        if (method == "acad_save_copy" && next_fault == "source_side_effect")
            write_context = true;
#endif
        DocumentContext context(p, write_context);
        auto db = context.doc->database();
        if (mutation(method))
            need(db->transactionManager() && db->transactionManager()->numActiveTransactions() == 0,
                 "DOC_BUSY", "Another database transaction is active");
        if (method == "acad_get_document_info")
            return doc_info(context.doc);
        if (method == "acad_get_entity" || method == "acad_query_entities")
            return query(db, p);
        need(!context.doc->isReadOnly(), "DOC_READ_ONLY", "Drawing is read only");
        json result;
        try {
            result = method == "acad_save_copy" ? save_copy(db, p) : mutate(db, method, p);
        } catch (const Failure &e) {
            result = mcp::error(e.code, e.message, e.code == "PARTIAL_APPLY");
            if (e.code == "PARTIAL_APPLY")
                result["verified"] = false;
            include(result, identity(db));
            result["operationId"] = text(p, "operationId");
            result["revision"] = state(db).revision;
        } catch (...) {
            result = mcp::error("EXECUTION_FAILED", "AutoCAD operation failed");
            include(result, identity(db));
            result["operationId"] = text(p, "operationId");
        }
        if (rollback_uncertain && mutation(method)) {
            auto uncertain = mcp::error("TIMEOUT_UNKNOWN",
                                        "Rollback could not be confirmed; writes are quarantined", nullptr);
            include(uncertain, identity(db));
            uncertain["operationId"] = text(p, "operationId");
            return uncertain;
        }
        return result;
    } catch (const Failure &e) {
        return mcp::error(e.code, e.message);
    } catch (...) {
        return mcp::error("VALIDATION_FAILED", "Malformed operation");
    }
}

HWND dispatcher = nullptr, main_window = nullptr;
std::atomic<bool> shutdown = false, test_done = false;
DWORD main_thread = 0;
void *application_id = nullptr;
bool application_locked = false, context_posted = false, draining = false;
void release_application_if_idle() {
    if (application_locked && !runtime && !context_posted) {
        acrxUnlockApplication(application_id);
        application_locked = false;
    }
}
void drain(void *) {
    if (GetCurrentThreadId() != main_thread || draining)
        return;
    struct Guard {
        Guard() {
            draining = true;
        }
        ~Guard() {
            draining = false;
            current_cancel = nullptr;
        }
    } guard;
    for (;;) {
        auto job = jobs->take();
        if (!job)
            break;
        current_cancel = &job->cancelled;
        if (job->request.value("method", std::string()) == "bridge.test_done") {
            try {
                validate("bridge.test_done", job->request.at("params"));
                test_done = true;
                jobs->finish(job, {{"stopped", true}});
            } catch (...) {
                jobs->finish(job, mcp::error("SECURITY_DENIED", "Test control unavailable"));
            }
        } else
            jobs->finish(job, execute(job->request));
        current_cancel = nullptr;
    }
}
void context_drain(void *) {
    context_posted = false;
    drain(nullptr);
    release_application_if_idle();
}
LRESULT CALLBACK window_proc(HWND window, UINT message, WPARAM w, LPARAM l) {
#ifdef AUTOCAD_MCP_TESTING
    if (message == WM_TIMER && w == 42) {
        KillTimer(window, 42);
        open_synthetic_modal();
        return 0;
    }
#endif
    if (message == WM_APP + 41) {
        if (acDocManager->isApplicationContext())
            drain(nullptr);
        else if (!context_posted) {
            context_posted = true;
            if (acDocManager->beginExecuteInApplicationContext(context_drain, nullptr) != Acad::eOk)
                context_posted = false;
        }
        return 0;
    }
    return DefWindowProcW(window, message, w, l);
}
json schedule(const json &request) {
    std::shared_ptr<mcp::Job> admitted;
    try {
        const auto method = request.at("method").get<std::string>();
        const auto &p = request.at("params");
#ifdef AUTOCAD_MCP_TESTING
        if (method == "bridge.test_probe") {
            need(p.size() == 1 && GetEnvironmentVariableW(L"MCP_TEST_MODE", nullptr, 0) > 0,
                 "SECURITY_DENIED");
            return {{"modalActive", synthetic_modal_active.load()},
                    {"mainEnabled", !main_window || IsWindowEnabled(main_window) != FALSE}};
        }
#endif
        if (method == "acad_get_operation_status" || method == "bridge.cancel") {
            need(p.size() == 4 && number(p, "documentEpoch") > 0);
            text(p, "documentId");
            text(p, "operationId");
            text(p, "instanceId");
            return jobs->status(p, method == "bridge.cancel");
        }
        if (mutation(method)) {
            // Validate record keys without calling AutoCAD on an IPC worker.
            need(number(p, "documentEpoch") > 0);
            need(std::regex_match(text(p, "operationId"), std::regex("[A-Za-z0-9_-]{1,128}")));
            need(std::regex_match(text(p, "documentId"), std::regex("[A-Za-z0-9_-]{1,128}")));
        }
        auto admission = jobs->submit(request, mutation(method));
        if (!admission.job)
            return admission.rejection;
        auto job = admission.job;
        admitted = job;
        if (main_window && !IsWindowEnabled(main_window))
            jobs->reject_queued(job, mcp::error("DOC_BUSY", "AutoCAD has an active modal window"));
        if (dispatcher)
            PostMessageW(dispatcher, WM_APP + 41, 0, 0);
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(8);
        while (!shutdown && std::chrono::steady_clock::now() < deadline) {
            if (job->result.wait_for(std::chrono::milliseconds(50)) == std::future_status::ready)
                return job->result.get();
        }
        return jobs->timeout(job);
    } catch (...) {
        if (admitted)
            return mcp::error("TIMEOUT_UNKNOWN", "Admitted operation result unavailable", nullptr);
        return mcp::error("VALIDATION_FAILED", "Malformed scheduler request");
    }
}
std::filesystem::path env_path(const wchar_t *key) {
    wchar_t path[32768]{};
    auto count = GetEnvironmentVariableW(key, path, 32768);
    need(count > 0 && count < 32768, "SECURITY_DENIED", "Local test directory is not configured");
    return std::filesystem::path(path);
}
void stop();
void start() {
    if (runtime) {
        acutPrintf(L"\nAutocad MCP is already started.\n");
        return;
    }
    try {
        main_thread = GetCurrentThreadId();
        main_window = adsw_acadMainWnd();
        rollback_uncertain = false;
        jobs = std::make_unique<mcp::Jobs>();
        shutdown = false;
        test_done = false;
        auto root = env_path(L"MCP_RUNTIME_DIR");
        need(root.is_absolute());
        // Keep DLL code resident while a worker or asynchronous CAD callback can use it.
        if (!application_locked) {
            need(acrxLockApplication(application_id), "EXECUTION_FAILED", "Cannot guard plugin lifetime");
            application_locked = true;
        }
        WNDCLASSW cls{};
        cls.lpfnWndProc = window_proc;
        cls.lpszClassName = L"AutocadMcpDispatcher";
        cls.hInstance = GetModuleHandleW(nullptr);
        need(RegisterClassW(&cls) != 0, "EXECUTION_FAILED", "Cannot register dispatcher class");
        dispatcher = CreateWindowW(cls.lpszClassName, L"", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr,
                                   cls.hInstance, nullptr);
        need(dispatcher != nullptr, "EXECUTION_FAILED", "Cannot create main thread dispatcher");
#ifdef AUTOCAD_MCP_TESTING
        test_dispatcher = dispatcher;
#endif
        auto allowed = names;
        if (GetEnvironmentVariableW(L"MCP_TEST_MODE", nullptr, 0) > 0)
            allowed.push_back("bridge.test_done");
#ifdef AUTOCAD_MCP_TESTING
        if (GetEnvironmentVariableW(L"MCP_TEST_MODE", nullptr, 0) > 0)
            allowed.insert(allowed.end(), {"bridge.test_action", "bridge.test_probe"});
#endif
        runtime = std::make_unique<mcp::Runtime>(root, schedule, allowed);
        output_root = runtime->grant_file().parent_path() / "output";
        std::filesystem::create_directory(output_root);
        acutPrintf(L"\nAutocad MCP started. Pairing file: %ls\n", runtime->grant_file().c_str());
    } catch (...) {
        stop();
        acutPrintf(L"\nAutocad MCP start failed. Check local runtime directory.\n");
    }
}
void stop() {
    shutdown = true;
    if (jobs)
        jobs->stop();
    runtime.reset();
#ifdef AUTOCAD_MCP_TESTING
    synthetic_outer_transaction.reset();
    if (veto_registered) {
        acDocManager->removeReactor(&synthetic_veto);
        veto_registered = false;
    }
    synthetic_veto.enabled = false;
    next_fault.clear();
#endif
    if (dispatcher) {
        DestroyWindow(dispatcher);
        dispatcher = nullptr;
    }
    UnregisterClassW(L"AutocadMcpDispatcher", GetModuleHandleW(nullptr));
    for (auto &[db, s] : documents)
        db->removeReactor(&watcher);
    documents.clear();
    jobs.reset();
    cursors.clear();
    release_application_if_idle();
    acutPrintf(L"\nAutocad MCP stopped.\n");
}
void pump() {
    if (!runtime || GetEnvironmentVariableW(L"MCP_TEST_MODE", nullptr, 0) == 0) {
        acutPrintf(L"\nTest pump unavailable.\n");
        return;
    }
    test_done = false;
    test_pumping = true;
    auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(120);
    while (!test_done && std::chrono::steady_clock::now() < deadline) {
        MSG message{};
        while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        Sleep(10);
    }
    test_pumping = false;
    acutPrintf(L"\nMCP test pump ended.\n");
}
} // namespace

extern "C" AcRx::AppRetCode __declspec(dllexport) acrxEntryPoint(AcRx::AppMsgCode code, void *packet) {
    if (code == AcRx::kInitAppMsg) {
        application_id = packet;
        acrxUnlockApplication(packet);
        acrxRegisterAppMDIAware(packet);
        acedRegCmds->addCommand(L"AUTOCADMCP", L"MCPSTART", L"MCPSTART", ACRX_CMD_MODAL, start);
        acedRegCmds->addCommand(L"AUTOCADMCP", L"MCPSTOP", L"MCPSTOP", ACRX_CMD_MODAL, stop);
        acedRegCmds->addCommand(L"AUTOCADMCP", L"MCPPUMP", L"MCPPUMP",
                                ACRX_CMD_SESSION | ACRX_CMD_NO_UNDO_MARKER, pump);
    }
    if (code == AcRx::kUnloadAppMsg) {
        stop();
        acedRegCmds->removeGroup(L"AUTOCADMCP");
    }
    return AcRx::kRetOK;
}
