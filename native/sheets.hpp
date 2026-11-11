// Drawing sheets (ISO 5457 frame) and title blocks as code-generated signed
// symbol blocks. Included inside plugin.cpp after tolerances.hpp. Sizes are
// paper millimetres multiplied by 1/viewScale, like the drawing standard.
double sheet_paper_unit(AcDbDatabase *db, const json &p) {
    const double viewScale = p.contains("viewScale") ? annotation_number(p, "viewScale") : 1;
    need(viewScale > 0 && std::isfinite(viewScale), "VALIDATION_FAILED", "viewScale must be positive");
    const double mm = input_factor(db, json{{"lengthUnit", "mm"}}) / viewScale;need(mm > 0 && std::isfinite(mm), "VALIDATION_FAILED", "Invalid sheet unit");return mm;
}
// ISO 5457: trimmed sheet, frame with a 20 mm filing margin on the left and
// 10 mm elsewhere, centring marks from the trimmed edge to 5 mm inside the frame.
json create_drawing_sheet(AcDbDatabase *db, const json &p) {
    auto &s = state(db);need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before drawing sheet");
    const double f = input_factor(db, p), out = output_factor(db, p), mm = sheet_paper_unit(db, p);
    static const std::map<std::string, std::pair<double, double>> sizes = {{"A0", {1189, 841}}, {"A1", {841, 594}}, {"A2", {594, 420}}, {"A3", {420, 297}}, {"A4", {297, 210}}};
    const auto size = text(p, "size");need(sizes.contains(size), "VALIDATION_FAILED", "Sheet size must be A0-A4");
    const auto orientation = text(p, "orientation");need(orientation == "landscape" || orientation == "portrait");
    auto [w, h] = sizes.at(size);if (orientation == "portrait") std::swap(w, h);
    const auto origin = point(p, "origin", f);need(origin.z == 0);
    auto at = [&](double x, double y) { return AcGePoint3d(origin.x + x * mm, origin.y + y * mm, 0); };
    const double left = 20, margin = 10, mark = 5;
    Transaction tx(db);auto result = write_result(db, p);std::vector<AcDbObjectId> ids;std::vector<json> expected;
    s.writing = true;
    try {
        check_cancel();
        auto add = [&](std::unique_ptr<AcDbEntity> e, const char *layerKey) {
            e->setDatabaseDefaults(db);
            if (p.contains(layerKey)) cad(e->setLayer(wide(text(p, layerKey)).c_str()));else cad(e->setLayer(db->clayer()));
            unlocked_layer(e.get());const auto id = append_model(db, tx, std::move(e), result);
            ids.push_back(id);expected.push_back(geometry(tx.get<AcDbEntity>(id), out));
        };
        auto rectangle = [&](double x0, double y0, double x1, double y1) {
            auto poly = std::make_unique<AcDbPolyline>(4);const AcGePoint3d c[4] = {at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)};
            for (unsigned int i = 0; i < 4; ++i) cad(poly->addVertexAt(i, AcGePoint2d(c[i].x, c[i].y)));
            poly->setClosed(true);return poly;
        };
        add(rectangle(left, margin, w - margin, h - margin), "layer");
        // Centring marks on the middle of each side.
        add(std::make_unique<AcDbLine>(at(w / 2, 0), at(w / 2, margin + mark)), "layer");
        add(std::make_unique<AcDbLine>(at(w / 2, h), at(w / 2, h - margin - mark)), "layer");
        add(std::make_unique<AcDbLine>(at(0, h / 2), at(left + mark, h / 2)), "layer");
        add(std::make_unique<AcDbLine>(at(w, h / 2), at(w - margin - mark, h / 2)), "layer");
        if (p.contains("edgeLayer")) add(rectangle(0, 0, w, h), "edgeLayer");
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing = false;s.revision++;cursors.clear();
    } catch (...) {s.writing = false;throw;}
    result["revision"] = s.revision;
    result["sheet"] = {{"size", size}, {"orientation", orientation}, {"paperSizeMm", json::array({w, h})},
                       {"trimmed", {{"min", xyz(at(0, 0), out)}, {"max", xyz(at(w, h), out)}}},
                       {"frame", {{"min", xyz(at(left, margin), out)}, {"max", xyz(at(w - margin, h - margin), out)}}},
                       {"titleBlockCorner", xyz(at(w - margin, margin), out)}};
    result["basis"] = "ISO 5457 frame margins (20 mm filing edge, 10 mm others) and centring marks; grid reference system not drawn";
    verify_created(db, p, result, ids, expected, "drawing sheet");
    return result;
}

// Title block layout "education_122x31": 122.38 x 30.60 mm, the user's template
// (scale, checked by, programme, number, name, ID number, date, title and two
// institution lines) with a projection symbol on its left. Every value is an
// attribute filled only from the request; unknown fields stay empty.
struct TitleField {const char *key, *tag;double right;}; // right: cell edge in mm from the block corner
const std::vector<TitleField> &title_fields() {
    static const std::vector<TitleField> fields = {{"title", "TITLE", -49.7172}, {"institution", "INSTITUTION", 0}, {"department", "DEPARTMENT", 0},
        {"scale", "SCALE", -110.9077}, {"checkedBy", "CHECKED_BY", -73.1924}, {"programme", "PROGRAMME", -49.7172}, {"number", "NUMBER", -49.7172},
        {"name", "NAME", -18.7501}, {"idNumber", "ID_NUMBER", 0}, {"date", "DATE", 0}};
    return fields;
}
SymbolSpec title_block_symbol(double u, double h, double titleHeight, int thick, int thin, const std::string &projection, const std::string &style) {
    SymbolSpec spec{"TITLE-EDU122X31", 1, {}};spec.style = style;
    // Columns and rows (mm) from the lower-right corner of the block.
    const double A = -122.3809, B = -110.9077, C = -73.1924, D = -49.7172, E = -18.7501, F = 0;
    const double r1 = 5.3542, r2 = 10.7083, r3 = 16.0625, top = 30.5952, pad = 1.3;
    auto v = [&](double x, double y) { return AcGePoint2d(x * u, y * u); };
    auto line = [&](double x0, double y0, double x1, double y1, int weight) {
        SymbolPart part{"line", {v(x0, y0), v(x1, y1)}};part.lineweight = weight;spec.parts.push_back(part);
    };
    for (double y : {0.0, r3, top}) line(A, y, F, y, thick);
    line(A, 0, A, top, thick);line(B, 0, B, r3, thick);line(C, 0, C, r3, thick);line(D, 0, D, top, thick);line(E, r1, E, r3, thick);line(F, 0, F, top, thick);
    line(C, r1, F, r1, thin);line(C, r2, F, r2, thin);
    // ISO 5456-2 projection symbol: truncated cone front view and end view.
    const double x0 = -154.7128, cone = 12.2470, gap = 1.3132, R = 6.1190, r = 3.0595, cy = 8.4542;
    const bool first = projection == "first_angle";
    const double trapezoid = first ? x0 : x0 + 2 * R + gap, cx = first ? x0 + cone + gap + R : x0 + R;
    SymbolPart outline{"polyline", {v(trapezoid, cy - r), v(trapezoid + cone, cy - R), v(trapezoid + cone, cy + R), v(trapezoid, cy + r)}};
    outline.closed = true;outline.lineweight = thick;spec.parts.push_back(outline);
    for (double radius : {R, r}) {SymbolPart c{"circle", {v(cx, cy)}};c.radius = radius * u;c.lineweight = thick;spec.parts.push_back(c);}
    line(x0 - 1.3277, cy, x0 + 2 * R + gap + cone + 2.4989, cy, thin);line(cx, 0, cx, cy + R + 2.4194, thin);
    // Labels and attributes, left aligned and vertically centred in their rows.
    auto baseline = [&](double y0, double y1, double height) { return (y0 + (y1 - y0 - height) / 2) * u; };
    auto label = [&](double x, double y0, double y1, const std::string &value) {
        SymbolPart t{"text", {AcGePoint2d((x + pad) * u, baseline(y0, y1, h))}};t.height = h * u;t.text = value;spec.parts.push_back(t);
    };
    auto field = [&](const char *tag, double x, double y, double height) {
        SymbolPart a{"attribute", {AcGePoint2d(x * u, y)}};a.height = height * u;a.tag = tag;spec.parts.push_back(a);
    };
    label(A, r2, r3, "Scale");label(B, r2, r3, "Checked by");label(C, r2, r3, "Programme");label(C, 0, r1, "No:");
    label(D, r2, r3, "Name & Surname");label(E, r2, r3, "ID no");label(D, 0, r1, "Date :");
    field("SCALE", A + pad, baseline(r1, r2, h), h);field("CHECKED_BY", B + pad, baseline(r1, r2, h), h);
    field("PROGRAMME", C + pad, baseline(r1, r2, h), h);field("NUMBER", C + pad + 2.8 * h, baseline(0, r1, h), h);
    field("NAME", D + pad, baseline(r1, r2, h), h);field("ID_NUMBER", E + pad, baseline(r1, r2, h), h);
    field("DATE", D + pad + 4.0 * h, baseline(0, r1, h), h);
    field("TITLE", A + 2 * pad, baseline(r3, top, titleHeight), titleHeight);
    field("INSTITUTION", D + pad, (top - 2.5 - h) * u, h);field("DEPARTMENT", D + pad, (top - 2.5 - 2.8 * h) * u, h);
    return spec;
}
json create_title_block(AcDbDatabase *db, const json &p) {
    auto &s = state(db);need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before title block");
    const double f = input_factor(db, p), out = output_factor(db, p), mm = sheet_paper_unit(db, p), tolerance = unit_tolerance(p);
    need(text(p, "layout") == "education_122x31", "VALIDATION_FAILED", "Unknown title block layout");
    const auto projection = text(p, "projectionSymbol");need(projection == "first_angle" || projection == "third_angle", "VALIDATION_FAILED", "projectionSymbol must be first_angle or third_angle");
    const double group = annotation_number(p, "lineGroup", 0.5);need(group == 0.35 || group == 0.5 || group == 0.7, "VALIDATION_FAILED", "lineGroup must be 0.35, 0.5 or 0.7");
    const int thick = static_cast<int>(std::lround(group * 100)), thin = group == 0.35 ? 18 : group == 0.5 ? 25 : 35;
    const double h = annotation_number(p, "textHeight", 2.5), titleHeight = annotation_number(p, "titleHeight", 5);
    need(h > 0 && h <= 3.5 && titleHeight > 0 && titleHeight <= 7, "VALIDATION_FAILED", "Title block text heights must fit their cells");
    const auto corner = point(p, "corner", f);need(corner.z == 0, "VALIDATION_FAILED", "corner must lie in the XY plane");
    const auto styleName = p.contains("style") ? text(p, "style") : symbol_name(db->textstyle());
    const auto style = named_symbol(db->textStyleTableId(), styleName);
    json values = json::object();const auto fields = p.value("fields", json::object());need(fields.is_object(), "VALIDATION_FAILED", "fields must be an object");
    std::set<std::string> known;for (const auto &field : title_fields()) known.insert(field.key);
    for (auto it = fields.begin(); it != fields.end(); ++it) need(known.contains(it.key()), "VALIDATION_FAILED", "Unknown title block field");
    for (const auto &field : title_fields()) {
        std::string value = fields.contains(field.key) ? text(fields, field.key) : std::string();
        need(value.size() <= 128 && value.find("%<") == std::string::npos, "VALIDATION_FAILED", "Title block values are plain text up to 128 bytes");for (unsigned char c : value) need(c >= 32, "VALIDATION_FAILED", "Title block values cannot contain control characters");
        values[field.tag] = value;
    }
    const auto spec = title_block_symbol(mm, h, titleHeight, thick, thin, projection, styleName);
    Transaction tx(db);auto result = write_result(db, p);std::vector<AcDbObjectId> ids;std::vector<json> expected;
    s.writing = true;
    try {
        check_cancel();bool defined = false;const auto blockId = ensure_symbol(db, tx, spec, style, defined);
        auto reference = std::make_unique<AcDbBlockReference>(corner, blockId);reference->setDatabaseDefaults(db);set_layer(db, reference.get(), p);
        const auto id = append_model(db, tx, std::move(reference), result);auto inserted = tx.get<AcDbBlockReference>(id, AcDb::kForWrite);
        auto record = tx.get<AcDbBlockTableRecord>(blockId);AcDbBlockTableRecordIterator *raw = nullptr;cad(record->newIterator(raw));
        std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);
        for (; !it->done(); it->step()) {
            auto definition = AcDbAttributeDefinition::cast(tx.get<AcDbEntity>(iterator_id(it.get())));
            if (!definition) continue;
            AcString tag;cad(definition->tag(tag));
            auto a = std::make_unique<AcDbAttribute>();cad(a->setAttributeFromBlock(definition, inserted->blockTransform()));
            cad(a->setTextString(wide(values.at(utf8(tag.kACharPtr())).get<std::string>()).c_str()));
            AcDbObjectId attributeId;cad(inserted->appendAttribute(attributeId, a.get()));
            cad(a->adjustAlignment(db), "Title block field alignment");auto placed = a.get();cad(tx.manager->addNewlyCreatedDBRObject(a.release(), true));
            // A value must stay inside its cell; nothing is shortened or squeezed silently.
            const auto key = utf8(tag.kACharPtr());AcDbExtents box;
            if (!values.at(key).get<std::string>().empty() && placed->getGeomExtents(box) == Acad::eOk)
                for (const auto &field : title_fields())
                    if (key == field.tag && box.maxPoint().x > corner.x + (field.right - 0.5) * mm)
                        throw Failure{"VALIDATION_FAILED", "Title block field " + std::string(field.key) + " does not fit its cell; shorten it or lower textHeight"};
        }
        auto g = geometry(inserted, out);
        need(g.value("attributes", json::object()) == values && annotation_close(g.at("position"), xyz(corner, out), tolerance),
             "VERIFICATION_FAILED", "Title block differs before commit");
        ids.push_back(id);expected.push_back(g);result["titleBlock"] = {{"layout", "education_122x31"}, {"blockName", symbol_block_name(spec)}, {"definitionCreated", defined},
            {"projection", projection}, {"fields", values},
            {"bounds", {{"min", xyz(AcGePoint3d(corner.x - 154.7128 * mm, corner.y, 0), out)}, {"max", xyz(AcGePoint3d(corner.x, corner.y + 30.5952 * mm, 0), out)}}}};
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing = false;s.revision++;cursors.clear();
    } catch (...) {s.writing = false;throw;}
    result["revision"] = s.revision;
    result["basis"] = "User-supplied education title block layout; ISO 5456-2 projection symbol; values only from the request, unknown fields empty";
    verify_created(db, p, result, ids, expected, "title block");
    return result;
}
