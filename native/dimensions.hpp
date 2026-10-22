// Dimension series (chain/baseline) and ISO 15786-style hole callouts. Series
// members are ordinary measured linear dimensions; callouts are leaders whose
// text comes from typed hole data, optionally checked against a real circle.
json create_dimension_series(AcDbDatabase *db, const json &p) {
    auto &s = state(db);need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before dimension series");
    const double f = input_factor(db, p), out = output_factor(db, p);
    const auto mode = text(p, "mode");need(mode == "chain" || mode == "baseline");
    need(p.contains("points") && p.at("points").is_array() && p.at("points").size() >= 2 && p.at("points").size() <= 33);
    const double rotation = annotation_number(p, "rotation"), spacing = annotation_number(p, "spacing", 0);
    need(mode == "chain" ? !p.contains("spacing") : spacing > 0 && std::isfinite(spacing));
    std::vector<AcGePoint3d> points;
    for (const auto &value : p.at("points")) {auto v = point(json{{"value", value}}, "value");need(v.z == 0);points.push_back(v);}
    auto line = point(p, "linePoint");need(line.z == 0);
    // Baseline lines step away from the measured points on the dimension-line side.
    const AcGeVector3d normal(-std::sin(rotation), std::cos(rotation), 0);
    const double side = (line - points[0]).dotProduct(normal) >= 0 ? 1 : -1;
    std::vector<json> requests;
    for (std::size_t i = 1; i < points.size(); ++i) {
        json sub = {{"kind", "linear"}, {"rotation", rotation}, {"lengthUnit", p.at("lengthUnit")}, {"coordinateSystem", "WCS"},
                    {"start", xyz(mode == "chain" ? points[i - 1] : points[0])}, {"end", xyz(points[i])},
                    {"linePoint", xyz(mode == "chain" ? line : line + normal * (side * spacing * static_cast<double>(i - 1)))}};
        for (const auto *key : {"textHeight", "arrowSize", "precision", "style", "layer"}) if (p.contains(key)) sub[key] = p.at(key);
        requests.push_back(sub);
    }
    Transaction tx(db);auto model = tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db), AcDb::kForWrite);
    auto result = identity(db);result["operationId"] = text(p, "operationId");result["status"] = "succeeded";result["applied"] = true;result["verified"] = false;result["error"] = nullptr;
    result["created"] = json::array();result["modified"] = json::array();result["erased"] = json::array();std::vector<AcDbObjectId> ids;
    s.writing = true;
    try {
        for (const auto &sub : requests) {
            check_cancel();auto e = make_annotation(db, "acad_create_dimension", sub, f);e->setDatabaseDefaults(db);configure_annotation(e.get(), db, sub, f);
            if (sub.contains("layer")) cad(e->setLayer(wide(text(sub, "layer")).c_str()));else cad(e->setLayer(db->clayer()));
            {AcDbLayerTableRecord *layer = nullptr;cad(acdbOpenObject(layer, e->layerId(), AcDb::kForRead));bool locked = layer->isLocked();layer->close();need(!locked, "SECURITY_DENIED", "Layer is locked");}
            AcDbObjectId id;cad(model->appendAcDbEntity(id, e.get()));auto raw = e.release();cad(tx.manager->addNewlyCreatedDBRObject(raw, true));
            cad(AcDbDimension::cast(raw)->recomputeDimBlock(true));result["created"].push_back(ref(db, raw));ids.push_back(id);
        }
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing = false;s.revision++;cursors.clear();
    } catch (...) {s.writing = false;throw;}
    result["revision"] = s.revision;
    try {
        Transaction read(db);json items = json::array();const auto unit = text(p, "lengthUnit");
        const double tolerance = unit == "m" ? 1e-9 : unit == "inch" ? 1e-6 / 25.4 : 1e-6;
        for (std::size_t i = 0; i < ids.size(); ++i) {
            auto g = geometry(read.get<AcDbEntity>(ids[i]), out);
            need(verify_annotation("acad_create_dimension", requests[i], json::array({g}), tolerance), "VERIFICATION_FAILED");items.push_back(g);
        }
        read.commit();result["verified"] = true;
        result["observedGeometry"] = {{"items", items}, {"lengthUnit", p.at("lengthUnit")}, {"coordinateSystem", "WCS"}};
    } catch (...) {
        result["status"] = "failed";result["error"] = {{"code", "VERIFICATION_FAILED"}, {"message", "Committed dimension series could not be verified"}, {"retryable", false}};
    }
    return result;
}

std::string callout_number(const json &p, const char *key, wchar_t separator) {
    need(written_value(p, key) > 0, "VALIDATION_FAILED", "Callout sizes must be positive");
    return written_text(p, key, separator);
}
// Builds the callout as MText: \P separates lines, gdt.shx supplies the
// counterbore (v) and countersink (w) symbols; depth follows the size after "×".
std::string hole_callout_text(const json &hole, wchar_t separator) {
    need(hole.is_object());
    for (auto it = hole.begin(); it != hole.end(); ++it)
        need(std::set<std::string>{"count", "diameter", "fit", "depth", "thread", "counterbore", "countersink"}.contains(it.key()));
    std::string first;
    if (hole.contains("count")) {need(hole.at("count").is_number_unsigned() && hole.at("count").get<std::uint64_t>() >= 2 && hole.at("count").get<std::uint64_t>() <= 999);first = std::to_string(hole.at("count").get<std::uint64_t>()) + "× ";}
    if (hole.contains("thread")) {
        const auto &thread = hole.at("thread");need(thread.is_object());
        for (auto it = thread.begin(); it != thread.end(); ++it) need(it.key() == "designation" || it.key() == "depth");
        // Metric ISO thread designation, e.g. M10, M10x1,25, M10-6H.
        const auto designation = text(thread, "designation");need(std::regex_match(designation, std::regex("M[0-9]{1,3}([.,][0-9]{1,2})?(x[0-9]{1,2}([.,][0-9]{1,2})?)?(-[0-9][A-Hfgh]{1,2})?(-LH)?")));
        first += designation;if (thread.contains("depth")) first += "×" + callout_number(thread, "depth", separator);
        need(!hole.contains("counterbore") && !hole.contains("countersink"), "VALIDATION_FAILED", "Threaded callouts take the tap drill as diameter only");
        if (hole.contains("diameter")) {first += " / %%c" + callout_number(hole, "diameter", separator);if (hole.contains("depth")) first += "×" + callout_number(hole, "depth", separator);}
        need(!hole.contains("fit"));
        return first;
    }
    first += "%%c" + callout_number(hole, "diameter", separator);
    if (hole.contains("fit")) {need(std::regex_match(text(hole, "fit"), std::regex("[A-Z]{1,2}(01|[0-9]|1[0-8])")));first += text(hole, "fit");}
    if (hole.contains("depth")) first += "×" + callout_number(hole, "depth", separator);
    need(!(hole.contains("counterbore") && hole.contains("countersink")), "VALIDATION_FAILED", "Choose counterbore or countersink");
    if (hole.contains("counterbore")) {
        const auto &bore = hole.at("counterbore");need(bore.is_object() && bore.size() == 2);
        need(written_value(bore, "diameter") > written_value(hole, "diameter"), "VALIDATION_FAILED", "Counterbore must be wider than the hole");
        first += "\\P{\\Fgdt;v}%%c" + callout_number(bore, "diameter", separator) + "×" + callout_number(bore, "depth", separator);
    }
    if (hole.contains("countersink")) {
        const auto &sink = hole.at("countersink");need(sink.is_object() && sink.size() == 2);
        need(written_value(sink, "diameter") > written_value(hole, "diameter"), "VALIDATION_FAILED", "Countersink must be wider than the hole");
        const double angle = written_value(sink, "angle");need(angle > 0 && angle < 180);
        first += "\\P{\\Fgdt;w}%%c" + callout_number(sink, "diameter", separator) + "×" + callout_number(sink, "angle", separator) + "%%d";
    }
    return first;
}
json create_hole_callout(AcDbDatabase *db, const json &p) {
    const auto separator = text(p, "decimalSeparator");need(separator == "comma" || separator == "point");
    need(p.contains("hole"));const auto &hole = p.at("hole");
    const auto formatted = hole_callout_text(hole, separator == "comma" ? L',' : L'.');
    if (p.contains("circle")) {
        // The noted size must match the real geometry, so a callout cannot hide a wrong hole.
        need(hole.contains("diameter"), "VALIDATION_FAILED", "A circle check needs the hole diameter");
        const auto &er = p.at("circle");auto &s = state(db);
        need(er.is_object() && er.size() == 3 && text(er, "documentId") == s.id && number(er, "documentEpoch") == s.epoch);
        Transaction tx(db);auto circle = AcDbCircle::cast(tx.get<AcDbEntity>(object_id(db, text(er, "handle"))));need(circle != nullptr, "UNSUPPORTED_ON_PLATFORM", "Callout check needs a CIRCLE");
        modelspace(db, circle);const double actual = circle->diameter() * output_factor(db, p), noted = written_value(hole, "diameter");tx.commit();
        const auto unit = text(p, "lengthUnit");const double tolerance = unit == "m" ? 1e-9 : unit == "inch" ? 1e-6 / 25.4 : 1e-6;
        need(std::abs(actual - noted) <= tolerance, "VALIDATION_FAILED", "Callout diameter differs from the referenced circle");
    }
    json leader = p;
    for (const auto *key : {"hole", "decimalSeparator", "circle", "textHeight", "style"}) leader.erase(key);
    leader["content"] = {{"kind", "text"}, {"text", "callout"}, {"height", p.at("textHeight")}, {"placement", "above"}};
    if (p.contains("style")) leader["content"]["style"] = p.at("style");
    auto result = create_leader(db, leader, &formatted);
    result["callout"] = {{"formattedText", formatted}, {"basis", "ISO 15786 simplified hole indication; layout pending full-text verification"}};
    return result;
}
