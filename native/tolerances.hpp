// ISO geometrical tolerancing annotations: feature control frames with ISO
// 1101/5458/2692/10579 modifiers and an optional associated LEADER, datum
// feature symbols (ISO 5459) and general specification notes (ISO 22081,
// 2768-1, 8015, 10579, 14405-1). Every value comes from the request; written
// decimals are reproduced exactly. Symbols are gdt.shx/amgdt.shx glyphs that
// ship with AutoCAD. Modifier order, adjacent-indication placement and symbol
// proportions are pending verification against the full ISO texts.
std::string gdt_glyph(char c) {return std::string("{\\Fgdt;") + c + "}";}
// Braces are formatting codes in FCF and MText, so the amgdt { (Ⓔ) and } (Ⓡ) glyphs are escaped.
std::string amgdt_glyph(char c) {return std::string("{\\Famgdt;") + (c == '{' || c == '}' ? "\\" : "") + c + "}";}
void only_keys(const json &p, std::initializer_list<const char *> keys) {
    need(p.is_object());const std::set<std::string> known(keys.begin(), keys.end());
    for (auto it = p.begin(); it != p.end(); ++it) need(known.contains(it.key()));
}
bool flag(const json &p, const char *key) {
    if (!p.contains(key)) return false;
    need(p.at(key).is_boolean());return p.at(key).get<bool>();
}
// ISO 1101 Table 2: characteristic symbol and whether a datum is required,
// forbidden or optional. Concentricity and coaxiality share one symbol.
struct Characteristic {char glyph;int datum;}; // datum: -1 none, 0 optional, 1 required
Characteristic gdt_characteristic(const std::string &name) {
    static const std::map<std::string, Characteristic> values = {
        {"straightness", {'u', -1}}, {"flatness", {'c', -1}}, {"roundness", {'e', -1}}, {"cylindricity", {'g', -1}},
        {"line_profile", {'k', 0}}, {"surface_profile", {'d', 0}}, {"position", {'j', 0}},
        {"parallelism", {'f', 1}}, {"perpendicularity", {'b', 1}}, {"angularity", {'a', 1}},
        {"concentricity", {'r', 1}}, {"coaxiality", {'r', 1}}, {"symmetry", {'i', 1}},
        {"circular_runout", {'h', 1}}, {"total_runout", {'t', 1}}};
    auto it = values.find(name);need(it != values.end(), "VALIDATION_FAILED", "Unknown geometric characteristic");
    return it->second;
}
std::string datum_letter(const json &value) {
    need(value.is_string() && std::regex_match(value.get<std::string>(), std::regex("[A-Z]{1,2}")), "VALIDATION_FAILED", "Datum letters are one or two capitals");
    return value.get<std::string>();
}
// Tolerance compartment: zone shape, value, then modifiers in a fixed order.
std::string fcf_zone(const json &zone, wchar_t separator) {
    only_keys(zone, {"value", "shape", "combined", "offset", "constraint", "derived", "projected", "material", "reciprocity", "freeState"});
    std::string out;
    if (zone.contains("shape")) {
        const auto shape = text(zone, "shape");need(shape == "diameter" || shape == "spherical_diameter");
        out += (shape == "spherical_diameter" ? "S" : "") + gdt_glyph('n');
    }
    need(written_value(zone, "value") > 0, "VALIDATION_FAILED", "Tolerance value must be positive");
    out += written_text(zone, "value", separator);
    if (zone.contains("combined")) {const auto v = text(zone, "combined");need(v == "CZ" || v == "SZ" || v == "CZR" || v == "SIM");out += " " + v;}
    if (zone.contains("offset")) {
        need(written_value(zone, "offset", true) != 0, "VALIDATION_FAILED", "UZ offset must be nonzero");
        out += " UZ" + written_text(zone, "offset", separator, true);
    }
    if (zone.contains("constraint")) {const auto v = text(zone, "constraint");need(v == "OZ" || v == "VA");out += " " + v;}
    if (flag(zone, "derived")) out += " " + amgdt_glyph('!');
    if (zone.contains("projected")) {
        need(written_value(zone, "projected") > 0, "VALIDATION_FAILED", "Projected zone length must be positive");
        out += " " + gdt_glyph('p') + written_text(zone, "projected", separator);
    }
    if (zone.contains("material")) {const auto v = text(zone, "material");need(v == "MMR" || v == "LMR");out += " " + gdt_glyph(v == "MMR" ? 'm' : 'l');}
    if (flag(zone, "reciprocity")) {need(zone.contains("material"), "VALIDATION_FAILED", "Reciprocity requires MMR or LMR");out += amgdt_glyph('}');}
    if (flag(zone, "freeState")) out += " " + amgdt_glyph('@');
    return out;
}
// Datum compartment: one letter, or a common datum A-B, with ISO 5459 modifiers.
std::string fcf_datum(const json &datum) {
    if (datum.is_string()) return datum_letter(datum);
    only_keys(datum, {"letters", "modifiers", "material"});
    need(datum.contains("letters") && datum.at("letters").is_array() && !datum.at("letters").empty() && datum.at("letters").size() <= 3);
    std::string out;std::set<std::string> seen;
    for (const auto &letter : datum.at("letters")) {const auto v = datum_letter(letter);need(seen.insert(v).second);out += (out.empty() ? "" : "-") + v;}
    if (datum.contains("modifiers")) {
        const auto &modifiers = datum.at("modifiers");need(modifiers.is_array() && modifiers.size() <= 3);std::set<std::string> used;
        static const std::set<std::string> known = {"PD", "MD", "LD", "ACS", "ALS", "CF", "DV", "PT", "SL", "PL"};
        for (const auto &m : modifiers) {need(m.is_string() && known.contains(m.get<std::string>()) && used.insert(m.get<std::string>()).second);out += "[" + m.get<std::string>() + "]";}
    }
    if (datum.contains("material")) {const auto v = text(datum, "material");need(v == "MMR" || v == "LMR");out += gdt_glyph(v == "MMR" ? 'm' : 'l');}
    return out;
}
// AutoCAD FCF fields per line: symbol, tolerance 1, tolerance 2, datum 1-3.
std::string fcf_row(const json &row, wchar_t separator) {
    only_keys(row, {"characteristic", "zone", "datums"});
    const auto characteristic = gdt_characteristic(text(row, "characteristic"));
    need(row.contains("zone"));
    auto out = gdt_glyph(characteristic.glyph) + "%%v" + fcf_zone(row.at("zone"), separator) + "%%v";
    const auto datums = row.value("datums", json::array());need(datums.is_array() && datums.size() <= 3);
    need(characteristic.datum != -1 || datums.empty(), "VALIDATION_FAILED", "Form tolerances take no datum");
    need(characteristic.datum != 1 || !datums.empty(), "VALIDATION_FAILED", "This characteristic requires a datum");
    for (const auto &datum : datums) out += "%%v" + fcf_datum(datum);
    return out;
}
// The original single-line form, kept byte-for-byte for existing callers.
std::string legacy_fcf_text(const json &p) {
    const std::map<std::string,char> symbols={{"position",'j'},{"parallelism",'f'},{"perpendicularity",'b'},{"angularity",'a'},{"flatness",'c'},{"roundness",'e'},{"cylindricity",'g'},{"straightness",'u'},{"surface_profile",'d'},{"line_profile",'k'},{"circular_runout",'h'},{"total_runout",'t'}};
    auto characteristic=text(p,"characteristic");need(symbols.contains(characteristic));double tolerance=annotation_number(p,"tolerance");need(tolerance>0);
    if(p.contains("diameterZone"))need(p.at("diameterZone").is_boolean());auto condition=p.value("materialCondition",std::string("none"));need(condition=="none"||condition=="MMC"||condition=="LMC");
    std::string value=gdt_glyph(symbols.at(characteristic))+"%%v";
    if(p.value("diameterZone",false))value+=gdt_glyph('n');value+=json(tolerance).dump();if(condition!="none")value+=gdt_glyph(condition=="MMC"?'m':'l');value+="%%v";
    auto datums=p.value("datums",json::array());need(datums.is_array()&&datums.size()<=3);for(const auto &datum:datums){need(datum.is_string()&&std::regex_match(datum.get<std::string>(),std::regex("[A-Z]{1,3}")));value+="%%v"+datum.get<std::string>();}
    return value;
}
// Indications next to the frame: n×, UF, "between" (A↔B) and the feature scope.
std::string fcf_adjacent(const json &a) {
    only_keys(a, {"count", "unitedFeature", "between", "scope"});
    std::vector<std::string> parts;
    if (a.contains("count")) {
        need(a.at("count").is_number_unsigned() && a.at("count").get<std::uint64_t>() >= 2 && a.at("count").get<std::uint64_t>() <= 999);
        parts.push_back(std::to_string(a.at("count").get<std::uint64_t>()) + "×");
    }
    if (flag(a, "unitedFeature")) parts.push_back("UF");
    if (a.contains("between")) {
        const auto &b = a.at("between");only_keys(b, {"from", "to"});need(b.contains("from") && b.contains("to"));
        const auto from = datum_letter(b.at("from")), to = datum_letter(b.at("to"));need(from != to);
        parts.push_back(from + amgdt_glyph('#') + to);
    }
    if (a.contains("scope")) {const auto v = text(a, "scope");need(v == "ACS" || v == "LD" || v == "MD" || v == "PD");parts.push_back(v);}
    need(!parts.empty());std::string out;
    for (const auto &part : parts) out += (out.empty() ? "" : " ") + part;
    return out;
}
std::string id_handle(AcDbObjectId id) {
    if (id.isNull()) return {};
    wchar_t buffer[17]{};need(id.handle().getIntoAsciiBuffer(buffer, 17), "EXECUTION_FAILED", "Handle unavailable");
    return utf8(buffer);
}
// Frame outline from AutoCAD's own layout (row boxes); used only for placement.
struct FrameBox {AcGePoint3d min, max;};
FrameBox fcf_box(AcDbFcf *frame) {
    AcGePoint3dArray points;frame->getBoundingPoints(points);
    need(points.length() >= 2, "EXECUTION_FAILED", "Tolerance frame has no outline");
    FrameBox box{points[0], points[0]};
    for (int i = 1; i < points.length(); ++i) {
        box.min.x = std::min(box.min.x, points[i].x);box.min.y = std::min(box.min.y, points[i].y);
        box.max.x = std::max(box.max.x, points[i].x);box.max.y = std::max(box.max.y, points[i].y);
    }
    need(box.max.x - box.min.x > 1e-12 && box.max.y - box.min.y > 1e-12, "EXECUTION_FAILED", "Tolerance frame outline is empty");
    return box;
}
json fcf_layout(AcDbFcf *frame, double f) {
    AcGePoint3dArray points;frame->getBoundingPoints(points);json outline = json::array();
    for (int i = 0; i < points.length() && i < 64; ++i) outline.push_back(xyz(points[i], f));
    return {{"boundingPoints", outline}};
}
// Where a leader or datum triangle touches the feature. "surface": on the
// referenced curve. "axis": in line with the referenced dimension line, the
// ISO 1101/5459 way of addressing a median feature.
json check_attachment(AcDbDatabase *db, const json &attachment, const AcGePoint3d &tip, const AcGePoint3d &next, double tolerance) {
    only_keys(attachment, {"kind", "entityRef", "dimension"});
    const auto kind = text(attachment, "kind");
    if (kind == "free") {need(attachment.size() == 1);return {{"kind", "free"}};}
    auto &s = state(db);Transaction tx(db);json out;
    if (kind == "surface") {
        need(attachment.size() == 2 && attachment.contains("entityRef"));
        auto curve = planar_curve(db, tx, attachment.at("entityRef"));AcGePoint3d closest;cad(curve->getClosestPointTo(tip, closest));
        const double distance = closest.distanceTo(tip);
        need(distance <= tolerance, "VALIDATION_FAILED", "The terminator point is not on the referenced feature");
        out = {{"kind", "surface"}, {"entity", handle(curve)}, {"distance", distance}};
    } else {
        need(kind == "axis" && attachment.size() == 2 && attachment.contains("dimension"));
        const auto &er = attachment.at("dimension");
        need(er.is_object() && er.size() == 3 && text(er, "documentId") == s.id && number(er, "documentEpoch") == s.epoch);
        auto e = tx.get<AcDbEntity>(object_id(db, text(er, "handle")));modelspace(db, e);
        AcGePoint3d through;AcGeVector3d direction;
        if (auto linear = AcDbRotatedDimension::cast(e)) {through = linear->dimLinePoint();direction = AcGeVector3d(std::cos(linear->rotation()), std::sin(linear->rotation()), 0);}
        else if (auto aligned = AcDbAlignedDimension::cast(e)) {through = aligned->dimLinePoint();direction = aligned->xLine2Point() - aligned->xLine1Point();}
        else need(false, "UNSUPPORTED_ON_PLATFORM", "Axis attachment needs a linear or aligned dimension");
        need(direction.length() > 1e-12);
        const double distance = std::abs((tip - through).dotProduct(direction.normal().crossProduct(AcGeVector3d::kZAxis)));
        need(distance <= tolerance, "VALIDATION_FAILED", "For an axis or median feature the terminator must be in line with the dimension line");
        // The leader continues the dimension line direction from the terminator.
        need((next - tip).length() > 1e-12 && (next - tip).normal().crossProduct(direction.normal()).length() <= 1e-9, "VALIDATION_FAILED", "For an axis or median feature the leader must run along the dimension line");
        out = {{"kind", "axis"}, {"dimension", handle(e)}, {"distance", distance}};
    }
    tx.commit();return out;
}
double unit_tolerance(const json &p) {
    const auto unit = text(p, "lengthUnit");return unit == "m" ? 1e-9 : unit == "inch" ? 1e-6 / 25.4 : 1e-6;
}
void unlocked_layer(AcDbEntity *e) {
    AcDbLayerTableRecord *layer = nullptr;cad(acdbOpenObject(layer, e->layerId(), AcDb::kForRead));
    const bool locked = layer->isLocked();layer->close();need(!locked, "SECURITY_DENIED", "Layer is locked");
}
// Non-database entity: the frame text, style and size; placement happens later.
std::unique_ptr<AcDbFcf> make_fcf(AcDbDatabase *db, const std::string &value, const AcGePoint3d &position, AcDbObjectId style) {
    auto frame = std::make_unique<AcDbFcf>(wide(value).c_str(), position, AcGeVector3d::kZAxis, AcGeVector3d::kXAxis);
    frame->setDatabaseDefaults(db);frame->setDimensionStyle(style);return frame;
}
// Applies the frame size as a style override once the frame is database resident.
void size_fcf(AcDbFcf *frame, Transaction &tx, AcDbObjectId style, double height) {
    AcDbDimStyleTableRecord settings;cad(settings.copyFrom(tx.get<AcDbDimStyleTableRecord>(style)));
    cad(settings.setDimscale(1));cad(settings.setDimtxt(height));
    frame->setDimensionStyle(style);cad(frame->setDimstyleData(&settings));
}
AcDbObjectId append_model(AcDbDatabase *db, Transaction &tx, std::unique_ptr<AcDbEntity> entity, json &result) {
    auto model = tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db), AcDb::kForWrite);
    AcDbObjectId id;cad(model->appendAcDbEntity(id, entity.get()));auto raw = entity.release();
    cad(tx.manager->addNewlyCreatedDBRObject(raw, true));result["created"].push_back(ref(db, raw));return id;
}
void set_layer(AcDbDatabase *db, AcDbEntity *e, const json &p) {
    if (p.contains("layer")) cad(e->setLayer(wide(text(p, "layer")).c_str()));else cad(e->setLayer(db->clayer()));
    unlocked_layer(e);
}
json write_result(AcDbDatabase *db, const json &p) {
    auto result = identity(db);result["operationId"] = text(p, "operationId");result["status"] = "succeeded";result["applied"] = true;result["verified"] = false;
    result["error"] = nullptr;result["created"] = json::array();result["modified"] = json::array();result["erased"] = json::array();return result;
}
// Reads every created entity after commit and compares it with the pre-commit view.
void verify_created(AcDbDatabase *db, const json &p, json &result, const std::vector<AcDbObjectId> &ids, const std::vector<json> &expected, const char *what) {
    try {
        Transaction read(db);json items = json::array();
        for (std::size_t i = 0; i < ids.size(); ++i) {
            auto actual = geometry(read.get<AcDbEntity>(ids[i]), output_factor(db, p));auto compare = expected[i];
            actual.erase("extents");compare.erase("extents");need(same_geometry(compare, actual), "VERIFICATION_FAILED");items.push_back(actual);
        }
        read.commit();result["verified"] = true;
        result["observedGeometry"] = {{"items", items}, {"lengthUnit", p.at("lengthUnit")}, {"coordinateSystem", "WCS"}};
    } catch (...) {
        result["status"] = "failed";result["error"] = {{"code", "VERIFICATION_FAILED"}, {"message", std::string("Committed ") + what + " could not be verified"}, {"retryable", false}};
    }
}
json create_feature_control_frame(AcDbDatabase *db, const json &p) {
    auto &s = state(db);need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before tolerance frame");
    const double f = input_factor(db, p), out = output_factor(db, p), tolerance = unit_tolerance(p);
    const bool modern = p.contains("rows");std::string value;
    if (modern) {
        for (const auto *key : {"characteristic", "tolerance", "diameterZone", "materialCondition", "datums"}) need(!p.contains(key));
        const auto separator = text(p, "decimalSeparator");need(separator == "comma" || separator == "point");
        const auto &rows = p.at("rows");need(rows.is_array() && !rows.empty() && rows.size() <= 3);
        for (const auto &row : rows) value += (value.empty() ? "" : "\n") + fcf_row(row, separator == "comma" ? L',' : L'.');
    } else {
        for (const auto *key : {"decimalSeparator", "adjacent", "leader", "style"}) need(!p.contains(key));
        value = legacy_fcf_text(p);
    }
    const double height = annotation_number(p, "textHeight") * f;need(height > 0 && std::isfinite(height));
    const auto position = point(p, "position", f);need(position.z == 0);
    const auto style = p.contains("style") ? named_symbol(db->dimStyleTableId(), text(p, "style")) : db->dimstyle();
    const std::string adjacent = p.contains("adjacent") ? fcf_adjacent(p.at("adjacent")) : std::string();
    // Leader: first vertex on the feature, then bends; AutoCAD adds the joint at the frame end facing the last bend.
    std::vector<AcGePoint3d> vertices;std::string terminator, around = "none";double arrow = 0;json attachment;
    if (p.contains("leader")) {
        const auto &l = p.at("leader");only_keys(l, {"vertices", "terminator", "terminatorSize", "attachment", "allAround"});
        need(l.contains("vertices") && l.at("vertices").is_array() && l.at("vertices").size() >= 1 && l.at("vertices").size() <= 8);
        for (const auto &v : l.at("vertices")) {auto at = point(json{{"value", v}}, "value", f);need(at.z == 0 && (vertices.empty() || at.distanceTo(vertices.back()) > 1e-12));vertices.push_back(at);}
        terminator = text(l, "terminator");need(terminator == "arrow" || terminator == "dot");
        arrow = annotation_number(l, "terminatorSize") * f;need(arrow > 0 && std::isfinite(arrow));
        if (l.contains("allAround")) {around = text(l, "allAround");need(around == "none" || around == "all_around" || around == "all_over");}
        need(around == "none" || vertices.size() >= 2, "VALIDATION_FAILED", "All-around symbols sit on a leader bend; give a bend vertex");
        need(l.contains("attachment"));attachment = check_attachment(db, l.at("attachment"), vertices.front(), vertices.size() > 1 ? vertices[1] : position, tolerance / out);
    }
    Transaction tx(db);auto result = write_result(db, p);
    std::vector<AcDbObjectId> ids;std::vector<json> expected;
    s.writing = true;
    try {
        check_cancel();
        auto made = make_fcf(db, value, position, style);set_layer(db, made.get(), p);
        const auto frameId = append_model(db, tx, std::move(made), result);
        auto frame = tx.get<AcDbFcf>(frameId, AcDb::kForWrite);size_fcf(frame, tx, style, height);
        auto g = geometry(frame, out);
        AcString stored;cad(frame->text(stored));
        need(utf8(stored.kACharPtr()) == value, "VERIFICATION_FAILED", "Tolerance frame text differs before commit");
        ids.push_back(frameId);expected.push_back(g);
        const auto box = fcf_box(frame);result["frame"] = fcf_layout(frame, out);
        if (!adjacent.empty()) {
            // Adjacent indications sit above the frame, left aligned.
            auto mt = std::make_unique<AcDbMText>();mt->setDatabaseDefaults(db);
            AcDbObjectId textStyle;{AcDbDimStyleTableRecord *record = tx.get<AcDbDimStyleTableRecord>(style);textStyle = record->dimtxsty();}
            if (!textStyle.isNull()) cad(mt->setTextStyle(textStyle));
            cad(mt->setTextHeight(height));cad(mt->setAttachment(AcDbMText::kBottomLeft));
            cad(mt->setLocation(AcGePoint3d(box.min.x, box.max.y + height * 0.5, 0)));mt->setContents(wide(adjacent).c_str());
            set_layer(db, mt.get(), p);const auto id = append_model(db, tx, std::move(mt), result);
            auto readback = geometry(tx.get<AcDbEntity>(id), out);AcString raw;cad(tx.get<AcDbMText>(id)->contents(raw));
            need(utf8(raw.kACharPtr()) == adjacent, "VERIFICATION_FAILED", "Adjacent indication differs before commit");
            ids.push_back(id);expected.push_back(readback);result["adjacent"] = {{"formattedText", adjacent}};
        }
        if (!vertices.empty()) {
            auto leader = std::make_unique<AcDbLeader>();leader->setDatabaseDefaults(db);
            for (const auto &v : vertices) need(leader->appendVertex(v), "EXECUTION_FAILED", "Leader vertex rejected");
            // Placeholder joint: attaching the frame moves the last vertex onto the frame.
            need(leader->appendVertex(position), "EXECUTION_FAILED", "Leader vertex rejected");
            leader->setDimensionStyle(style);cad(leader->setDimasz(arrow));cad(leader->setDimscale(1));
            if (terminator == "dot") {AcDbObjectId dot;cad(AcDmUtil::getArrowId(L"_DOT", dot, db), "Arrow block");cad(leader->setDimldrblk(dot));}
            set_layer(db, leader.get(), p);const auto leaderId = append_model(db, tx, std::move(leader), result);
            auto l = tx.get<AcDbLeader>(leaderId, AcDb::kForWrite);
            cad(l->attachAnnotation(frameId), "Leader annotation");cad(l->evaluateLeader(), "Leader evaluation");
            auto readback = geometry(l, out);
            need(readback.value("annotation", std::string()) == id_handle(frameId), "VERIFICATION_FAILED", "Leader is not associated with the frame");
            const auto &observed = readback.at("vertices");need(observed.size() >= 2, "VERIFICATION_FAILED", "Leader vertices missing");
            need(annotation_close(observed[0], xyz(vertices.front(), out), tolerance), "VERIFICATION_FAILED", "Leader terminator point moved before commit");
            need(readback.at("terminator") == terminator, "VERIFICATION_FAILED", "Leader terminator differs before commit");
            need(observed.size() == vertices.size() + 1, "VERIFICATION_FAILED", "Leader vertices differ before commit");
            for (std::size_t i = 1; i < vertices.size(); ++i) need(annotation_close(observed[i], xyz(vertices[i], out), tolerance), "VERIFICATION_FAILED", "Leader bend moved before commit");
            // The joint is the middle of the first row's left or right end, and the leader must not cross the frame.
            const auto joint = point(json{{"value", observed.back()}}, "value", 1 / out), bend = vertices.back();
            const bool left = std::abs(joint.x - box.min.x) <= tolerance / out, right = std::abs(joint.x - box.max.x) <= tolerance / out;
            need((left || right) && std::abs(joint.y - frame->location().y) <= tolerance / out, "VERIFICATION_FAILED", "Leader does not join the frame end");
            need(left ? bend.x <= box.min.x : bend.x >= box.max.x, "VALIDATION_FAILED", "The leader would cross the frame; place the frame beyond the last bend");
            ids.push_back(leaderId);expected.push_back(readback);result["leader"] = {{"attachment", attachment}, {"requestedVertices", json::array()}};
            for (const auto &v : vertices) result["leader"]["requestedVertices"].push_back(xyz(v, out));
            if (around != "none") {
                // Circle(s) on the bend between leader and reference line (ISO 1101 all around / all over).
                const auto bend = vertices.back();const double r = height * 0.5;
                for (int ring = 0; ring < (around == "all_over" ? 2 : 1); ++ring) {
                    auto c = std::make_unique<AcDbCircle>(bend, AcGeVector3d::kZAxis, r * (1 + 0.5 * ring));c->setDatabaseDefaults(db);set_layer(db, c.get(), p);
                    const auto id = append_model(db, tx, std::move(c), result);ids.push_back(id);expected.push_back(geometry(tx.get<AcDbEntity>(id), out));
                }
                result["leader"]["allAround"] = around;
            }
        }
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing = false;s.revision++;cursors.clear();
    } catch (...) {s.writing = false;throw;}
    result["revision"] = s.revision;result["formattedText"] = value;
    result["basis"] = "ISO 1101/5458/2692/10579 symbols from gdt.shx/amgdt.shx; modifier order and adjacent placement pending full-text verification";
    verify_created(db, p, result, ids, expected, "tolerance frame");
    return result;
}
// ISO 5459 datum feature: letter in a square frame joined by a straight leader
// to a filled or open datum triangle on the feature. The leader and triangle
// are a native MLEADER without content; the frame is a code-generated block
// with a DATUM attribute inserted at the leader end in the same transaction
// (MLEADER block content is laid out by AutoCAD and drifted from the joint).
SymbolSpec datum_frame_symbol(double h, const std::string &side) {
    const double a = 2 * h;AcGePoint2d low;
    if (side == "bottom") low = {-h, 0};else if (side == "top") low = {-h, -a};else if (side == "left") low = {0, -h};else low = {-a, -h};
    SymbolSpec spec{"DATUM-" + std::string(1, static_cast<char>(std::toupper(side[0]))), 1, {}};
    SymbolPart frame{"polyline", {low, {low.x + a, low.y}, {low.x + a, low.y + a}, {low.x, low.y + a}}};frame.closed = true;spec.parts.push_back(frame);
    SymbolPart letter{"attribute", {{low.x + h, low.y + h}}};letter.height = h;letter.text = "A";letter.tag = "DATUM";letter.align = "middle";spec.parts.push_back(letter);
    return spec;
}
json create_datum_feature(AcDbDatabase *db, const json &p) {
    const double f = input_factor(db, p), out = output_factor(db, p), tolerance = unit_tolerance(p);
    const auto letter = datum_letter(p.at("letter"));
    const auto triangle = text(p, "triangle");need(triangle == "filled" || triangle == "open");
    need(p.contains("vertices") && p.at("vertices").is_array() && p.at("vertices").size() == 2);
    const auto tip = point(json{{"value", p.at("vertices")[0]}}, "value", f), joint = point(json{{"value", p.at("vertices")[1]}}, "value", f);
    need(tip.z == 0 && joint.z == 0 && tip.distanceTo(joint) > 1e-12);
    const double h = annotation_number(p, "textHeight") * f;need(h > 0 && std::isfinite(h));
    // The frame joins the leader on the edge that faces the triangle.
    const auto d = joint - tip;const std::string side = std::abs(d.y) >= std::abs(d.x) ? (d.y > 0 ? "bottom" : "top") : (d.x > 0 ? "left" : "right");
    need(p.contains("attachment"));const auto attachment = check_attachment(db, p.at("attachment"), tip, joint, tolerance / out);
    const auto spec = datum_frame_symbol(h, side);
    const auto style = p.contains("style") ? named_symbol(db->textStyleTableId(), text(p, "style")) : db->textstyle();
    json leader = p;
    for (const auto *key : {"letter", "triangle", "textHeight", "attachment", "style", "triangleSize"}) leader.erase(key);
    leader["terminator"] = triangle == "filled" ? "datum_filled" : "datum_open";leader["terminatorSize"] = p.at("triangleSize");
    leader["landingLength"] = 0;leader["landingDirection"] = "right";leader["content"] = {{"kind", "none"}};
    auto insert = [&](Transaction &tx, json &result, std::vector<AcDbObjectId> &ids, std::vector<json> &expected) {
        bool defined = false;const auto blockId = ensure_symbol(db, tx, spec, style, defined);
        auto reference = std::make_unique<AcDbBlockReference>(joint, blockId);reference->setDatabaseDefaults(db);set_layer(db, reference.get(), p);
        const auto id = append_model(db, tx, std::move(reference), result);auto inserted = tx.get<AcDbBlockReference>(id, AcDb::kForWrite);
        auto record = tx.get<AcDbBlockTableRecord>(blockId);AcDbBlockTableRecordIterator *raw = nullptr;cad(record->newIterator(raw));
        std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);
        for (; !it->done(); it->step()) {
            auto definition = AcDbAttributeDefinition::cast(tx.get<AcDbEntity>(iterator_id(it.get())));
            if (!definition) continue;
            auto a = std::make_unique<AcDbAttribute>();cad(a->setAttributeFromBlock(definition, inserted->blockTransform()));cad(a->setTextString(wide(letter).c_str()));
            AcDbObjectId attributeId;cad(inserted->appendAttribute(attributeId, a.get()));
            // Middle-aligned text computes its position on close; do it now so the pre-commit view is final.
            cad(a->adjustAlignment(db), "Datum letter alignment");cad(tx.manager->addNewlyCreatedDBRObject(a.release(), true));
        }
        auto g = geometry(inserted, out);
        need(g.value("attributes", json::object()).value("DATUM", std::string()) == letter && annotation_close(g.at("position"), xyz(joint, out), tolerance),
             "VERIFICATION_FAILED", "Datum letter frame differs before commit");
        ids.push_back(id);expected.push_back(g);
        result["datum"] = {{"letter", letter}, {"triangle", triangle}, {"frameSide", side}, {"attachment", attachment}, {"frameBlock", symbol_block_name(spec)},
                           {"basis", "ISO 5459 datum feature indicator; frame and triangle proportions pending full-text verification"}};
    };
    return create_leader(db, leader, nullptr, true, insert);
}
// General specification near the title block, only for what the user selects.
std::string general_specification_line(const json &item, wchar_t separator, json &frameRow) {
    const auto kind = text(item, "kind");
    if (kind == "iso8015") {only_keys(item, {"kind"});return "ISO 8015";}
    if (kind == "iso2768") {only_keys(item, {"kind", "class"});const auto c = text(item, "class");need(c == "f" || c == "m" || c == "c" || c == "v");return "ISO 2768-" + c;}
    if (kind == "iso14405_envelope") {only_keys(item, {"kind"});return "ISO 14405 " + amgdt_glyph('{');}
    if (kind == "iso22081_size") {
        only_keys(item, {"kind", "deviation"});need(written_value(item, "deviation") > 0, "VALIDATION_FAILED", "General size deviation must be positive");
        return "ISO 22081 ±" + written_text(item, "deviation", separator);
    }
    if (kind == "iso22081_geometrical") {
        only_keys(item, {"kind", "tolerance", "datums"});
        frameRow = {{"characteristic", "surface_profile"}, {"zone", {{"value", item.at("tolerance")}}}, {"datums", item.value("datums", json::array())}};
        return "ISO 22081";
    }
    need(kind == "iso10579");only_keys(item, {"kind", "restraint"});
    std::string line = "ISO 10579-NR";
    if (item.contains("restraint")) {
        auto value = text(item, "restraint");need(value.size() <= 256 && value.find("%<") == std::string::npos);
        line += "\\P";for (unsigned char c : value) {need(c >= 32);if (c == '\\' || c == '{' || c == '}') line += '\\';line += static_cast<char>(c);}
    }
    return line;
}
json create_general_specification(AcDbDatabase *db, const json &p) {
    auto &s = state(db);need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before general specification");
    const double f = input_factor(db, p), out = output_factor(db, p);
    const auto separator = text(p, "decimalSeparator");need(separator == "comma" || separator == "point");const wchar_t sep = separator == "comma" ? L',' : L'.';
    need(p.contains("items") && p.at("items").is_array() && !p.at("items").empty() && p.at("items").size() <= 6);
    std::string contents;json frameRow;std::set<std::string> kinds;
    for (const auto &item : p.at("items")) {
        need(item.is_object() && kinds.insert(text(item, "kind")).second, "VALIDATION_FAILED", "Each general specification kind appears once");
        json row;const auto line = general_specification_line(item, sep, row);
        if (!row.is_null()) frameRow = row;
        contents += (contents.empty() ? "" : "\\P") + line;
    }
    // The ISO 22081 geometrical specification frame is placed on its own row below the note.
    need(frameRow.is_null() || kinds.contains("iso22081_geometrical"));
    const std::string frameText = frameRow.is_null() ? std::string() : fcf_row(frameRow, sep);
    const double h = annotation_number(p, "textHeight") * f;need(h > 0 && std::isfinite(h));
    const auto position = point(p, "position", f);need(position.z == 0);
    const auto textStyle = p.contains("style") ? named_symbol(db->textStyleTableId(), text(p, "style")) : db->textstyle();
    const auto frameStyle = p.contains("frameStyle") ? named_symbol(db->dimStyleTableId(), text(p, "frameStyle")) : db->dimstyle();
    Transaction tx(db);auto result = write_result(db, p);std::vector<AcDbObjectId> ids;std::vector<json> expected;
    s.writing = true;
    try {
        check_cancel();
        auto mt = std::make_unique<AcDbMText>();mt->setDatabaseDefaults(db);cad(mt->setTextStyle(textStyle));cad(mt->setTextHeight(h));
        cad(mt->setAttachment(AcDbMText::kTopLeft));cad(mt->setLocation(position));mt->setContents(wide(contents).c_str());set_layer(db, mt.get(), p);
        const auto noteId = append_model(db, tx, std::move(mt), result);auto note = tx.get<AcDbMText>(noteId);
        AcString raw;cad(note->contents(raw));need(utf8(raw.kACharPtr()) == contents, "VERIFICATION_FAILED", "General specification text differs before commit");
        ids.push_back(noteId);expected.push_back(geometry(note, out));
        if (!frameText.empty()) {
            AcDbExtents bounds;cad(note->getGeomExtents(bounds));
            auto made = make_fcf(db, frameText, AcGePoint3d(position.x, bounds.minPoint().y, 0), frameStyle);set_layer(db, made.get(), p);
            const auto frameId = append_model(db, tx, std::move(made), result);auto frame = tx.get<AcDbFcf>(frameId, AcDb::kForWrite);size_fcf(frame, tx, frameStyle, h);
            // Move the frame so its top-left corner sits half a text height below the note.
            const auto box = fcf_box(frame);
            frame->setLocation(frame->location() + AcGeVector3d(position.x - box.min.x, bounds.minPoint().y - h * 0.5 - box.max.y, 0));
            AcString stored;cad(frame->text(stored));need(utf8(stored.kACharPtr()) == frameText, "VERIFICATION_FAILED", "General specification frame differs before commit");
            ids.push_back(frameId);expected.push_back(geometry(frame, out));result["frame"] = fcf_layout(frame, out);
        }
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing = false;s.revision++;cursors.clear();
    } catch (...) {s.writing = false;throw;}
    result["revision"] = s.revision;result["formattedText"] = contents;if (!frameText.empty()) result["frameText"] = frameText;
    result["basis"] = "User-selected general specification references; indication layout pending full-text verification";
    verify_created(db, p, result, ids, expected, "general specification");
    return result;
}
