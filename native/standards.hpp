// ISO drawing profile: one atomic setup of lettering, line types, layers and a
// dimension style. Every numeric choice below is listed in the returned
// "basis" so a reviewer can trace it; values not yet checked against the full
// ISO text are reported as pending rather than presented as certified.
struct StandardLayer {
    const char *suffix, *linetype, *usage;
    int color;
    bool thick, lettering;
};
const std::vector<StandardLayer> &iso_layers() {
    // ISO 128-2 line types for mechanical drawings: 01.2 thick continuous,
    // 01.1 thin continuous, 02.1 thin dashed, 04.1 thin long-dash dotted,
    // 05.1 thin long-dash double-dotted. Colours are display aids only.
    static const std::vector<StandardLayer> layers = {
        {"VISIBLE", "Continuous", "01.2 visible edges and outlines", 7, true, false},
        {"THIN", "Continuous", "01.1 projection, short centre, fold and leader lines", 8, false, false},
        {"HIDDEN", "DASHED", "02.1 hidden edges and outlines", 3, false, false},
        {"CENTER", "LONGDASH-DOT", "04.1 centre and symmetry lines, pitch circles", 1, false, false},
        {"CUTTING-PLANE", "LONGDASH-DOT", "04.1 cutting planes (thick ends are drawn separately)", 1, false, false},
        {"PHANTOM", "LONGDASH-DDOT", "05.1 adjacent parts, extreme positions, initial outlines", 6, false, false},
        {"DIMENSION", "Continuous", "01.1 dimension, extension and leader lines", 4, false, false},
        {"HATCH", "Continuous", "01.1 hatching", 8, false, false},
        {"TEXT", "Continuous", "lettering stroke width h/10 (ISO 3098 type B)", 2, false, true},
        {"SYMBOL", "Continuous", "graphical symbols drawn with the lettering stroke width", 5, false, true}};
    return layers;
}
std::string width_code(double mm) {
    char out[8]{};std::snprintf(out, sizeof out, "%03d", static_cast<int>(std::lround(mm * 100)));
    return out;
}
json setup_drawing_standard(AcDbDatabase *db, const json &p) {
    auto &s = state(db);
    need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before standard setup");
    need(text(p, "standard") == "ISO");
    const double thick = annotation_number(p, "lineGroup"), h = annotation_number(p, "textHeight"), viewScale = annotation_number(p, "viewScale", 1);
    // ISO 128-2 line groups pair a thick width with a thin width of half of it.
    const std::map<double, int> groups = {{0.25, 13}, {0.35, 18}, {0.5, 25}, {0.7, 35}, {1.0, 50}};
    const std::set<double> heights = {1.8, 2.5, 3.5, 5, 7, 10, 14, 20};
    need(groups.contains(thick) && heights.contains(h) && viewScale > 0 && std::isfinite(viewScale));
    const double thin = groups.at(thick) / 100.0;
    const int thickWeight = static_cast<int>(std::lround(thick * 100)), thinWeight = groups.at(thick), letterWeight = static_cast<int>(std::lround(h * 10));
    const auto separator = text(p, "decimalSeparator");need(separator == "comma" || separator == "point");
    const auto precision = number(p, "precision");need(precision <= 4);
    const auto prefix = p.value("prefix", std::string("ISO"));need(std::regex_match(prefix, std::regex("[A-Z][A-Z0-9]{0,11}")));
    // Model-space sizes: paper millimetres divided by the view scale, in drawing units.
    const double mm = input_factor(db, json{{"lengthUnit", "mm"}}) / viewScale;need(mm > 0 && std::isfinite(mm));
    AcString fontPath;
    need(acdbHostApplicationServices()->findFile(fontPath, L"isocp.shx", db, AcDbHostApplicationServices::kFontFile) == Acad::eOk,
         "UNSUPPORTED_ON_PLATFORM", "AutoCAD font isocp.shx is not available");

    const auto textStyleName = prefix + "-ISO3098", dimStyleName = prefix + "-ISO129";
    // ISO 128-2 elements in multiples of the line width d: dash 12d, gap 3d,
    // long dash 24d, dot. Identical to AutoCAD's acadiso.lin ACAD_ISO02/04/05W100
    // (defined for d = 1 mm). Lengths are paper millimetres; PSLTSCALE=1 keeps
    // them constant through scaled viewports.
    const std::vector<std::pair<std::string, std::vector<double>>> patterns = {
        {"DASHED", {12, -3}}, {"LONGDASH-DOT", {24, -3, 0, -3}}, {"LONGDASH-DDOT", {24, -3, 0, -3, 0, -3}}};
    std::map<std::string, std::string> linetypeNames;
    for (const auto &[kind, dashes] : patterns) linetypeNames[kind] = prefix + "-" + kind + "-W" + width_code(thin);

    Transaction tx(db);
    std::vector<std::string> collisions;
    auto taken = [&](AcDbObjectId tableId, const std::string &name) {
        if (tx.get<AcDbSymbolTable>(tableId)->has(wide(name).c_str())) collisions.push_back(name);
    };
    taken(db->textStyleTableId(), textStyleName);taken(db->dimStyleTableId(), dimStyleName);
    for (const auto &[kind, name] : linetypeNames) taken(db->linetypeTableId(), name);
    for (const auto &layer : iso_layers()) taken(db->layerTableId(), prefix + "-" + layer.suffix);
    if (!collisions.empty()) {
        std::string list;for (const auto &n : collisions) list += (list.empty() ? "" : ", ") + n;
        throw Failure{"VALIDATION_FAILED", "Standard profile names already exist: " + list};
    }
    auto result = identity(db);result["operationId"] = text(p, "operationId");result["status"] = "succeeded";result["applied"] = true;result["verified"] = false;result["error"] = nullptr;
    std::vector<std::pair<AcDbObjectId, json>> expected;
    std::optional<bool> psltscaleBefore;
    auto add = [&](AcDbObjectId tableId, AcDbSymbolTableRecord *raw) {
        std::unique_ptr<AcDbSymbolTableRecord> record(raw);auto value = style_record(record.get());// Recorded before insertion for the read-back comparison.
        auto table = tx.get<AcDbSymbolTable>(tableId, AcDb::kForWrite);AcDbObjectId id;
        cad(table->add(id, record.get()), "Add style record");cad(tx.manager->addNewlyCreatedDBRObject(record.release(), true));
        expected.push_back({id, value});return id;
    };
    s.writing = true;
    try {
        check_cancel();
        auto textStyle = std::make_unique<AcDbTextStyleTableRecord>();cad(textStyle->setName(wide(textStyleName).c_str()));
        cad(textStyle->setFileName(L"isocp.shx"));cad(textStyle->setXScale(1));cad(textStyle->setTextSize(0));cad(textStyle->setObliquingAngle(0));
        const auto textStyleId = add(db->textStyleTableId(), textStyle.release());
        std::map<std::string, AcDbObjectId> linetypeIds = {{"Continuous", named_symbol(db->linetypeTableId(), "Continuous")}};
        for (const auto &[kind, dashes] : patterns) {
            auto linetype = std::make_unique<AcDbLinetypeTableRecord>();cad(linetype->setName(wide(linetypeNames.at(kind)).c_str()));
            cad(linetype->setNumDashes(static_cast<int>(dashes.size())));double total = 0;
            for (std::size_t i = 0; i < dashes.size(); ++i) {cad(linetype->setDashLengthAt(static_cast<int>(i), dashes[i] * thin));total += std::abs(dashes[i] * thin);}
            cad(linetype->setPatternLength(total));
            cad(linetype->setComments(wide("ISO 128-2 " + kind + " d=" + width_code(thin)).c_str()), "Linetype comment");
            linetypeIds[kind] = add(db->linetypeTableId(), linetype.release());
        }
        json layers = json::array();
        auto layerTable = tx.get<AcDbLayerTable>(db->layerTableId(), AcDb::kForWrite);
        for (const auto &spec : iso_layers()) {
            auto layer = std::make_unique<AcDbLayerTableRecord>();const auto name = prefix + "-" + spec.suffix;cad(layer->setName(wide(name).c_str()));
            AcCmColor aci;aci.setColorIndex(static_cast<Adesk::UInt16>(spec.color));layer->setColor(aci);
            const int weight = spec.lettering ? letterWeight : spec.thick ? thickWeight : thinWeight;
            cad(layer->setLineWeight(static_cast<AcDb::LineWeight>(weight)));cad(layer->setLinetypeObjectId(linetypeIds.at(spec.linetype)));
            layer->setIsLocked(false);layer->setIsOff(false);cad(layer->setIsFrozen(false));
            AcDbObjectId id;cad(layerTable->add(id, layer.get()), "Add layer");auto added = layer.release();cad(tx.manager->addNewlyCreatedDBRObject(added, true));
            // The description is stored as xdata, so it needs a database-resident layer.
            cad(added->setDescription(wide(spec.usage).c_str()), "Layer description");
            json value = {{"name", name}, {"colorIndex", spec.color}, {"lineweight", weight},
                          {"linetype", spec.linetype == std::string("Continuous") ? std::string("Continuous") : linetypeNames.at(spec.linetype)}};
            layers.push_back(value);expected.push_back({id, value});
        }
        // Proportions h, 0.25h and 0.5h follow AutoCAD's ISO-25 dimension style
        // (secondary source, pending check against ISO 129-1).
        auto dim = std::make_unique<AcDbDimStyleTableRecord>();cad(dim->setName(wide(dimStyleName).c_str()));
        const double height = h * mm;
        cad(dim->setDimtxsty(textStyleId));cad(dim->setDimtxt(height));cad(dim->setDimasz(height));cad(dim->setDimgap(height * 0.25));
        cad(dim->setDimexo(height * 0.25));cad(dim->setDimexe(height * 0.5));cad(dim->setDimtad(1));cad(dim->setDimjust(0));
        cad(dim->setDimtih(false));cad(dim->setDimtoh(false));cad(dim->setDimtofl(true));cad(dim->setDimlunit(2));
        cad(dim->setDimdec(static_cast<int>(precision)));cad(dim->setDimtdec(static_cast<int>(precision)));
        // Preserve requested display precision and trailing zeros; tolerances are specified separately.
        cad(dim->setDimzin(0));cad(dim->setDimtzin(0));
        cad(dim->setDimdsep(separator == "comma" ? L',' : L'.'));cad(dim->setDimscale(1));
        cad(dim->setDimlfac(1 / input_factor(db, json{{"lengthUnit", "mm"}})));cad(dim->setDimtol(false));cad(dim->setDimlim(false));
        add(db->dimStyleTableId(), dim.release());
        test_fault("abort_before_commit");check_cancel();
        // Header variables are outside the object transaction; set last and restore on failure.
        psltscaleBefore = db->psltscale();cad(db->setPsltscale(true));
        tx.commit();s.writing = false;s.revision++;cursors.clear();
        result["created"] = {{"textStyle", textStyleName}, {"dimensionStyle", dimStyleName}, {"linetypes", json::array()}, {"layers", layers}};
        for (const auto &[kind, name] : linetypeNames) result["created"]["linetypes"].push_back(name);
    } catch (...) {
        if (tx.active && psltscaleBefore.has_value()) db->setPsltscale(*psltscaleBefore);
        s.writing = false;throw;
    }
    result["revision"] = s.revision;
    result["profile"] = {{"standard", "ISO"}, {"lineGroup", {{"thickMm", thick}, {"thinMm", thin}}}, {"textHeightMm", h}, {"letteringStrokeMm", h / 10},
                         {"viewScale", viewScale}, {"decimalSeparator", separator}, {"precision", precision}, {"linetypePatternUnit", "paper_mm"},
                         {"basis", json::array({"ISO 128-2:2022 line types and widths (element lengths cross-checked with AutoCAD acadiso.lin)",
                                                "ISO 3098 type B lettering via AutoCAD isocp.shx", "Dimension proportions from AutoCAD ISO-25 style"})},
                         {"verification", "pending_full_text"}};
    try {
        Transaction read(db);
        for (const auto &[id, value] : expected) {
            auto record = read.get<AcDbSymbolTableRecord>(id);
            if (auto layer = AcDbLayerTableRecord::cast(record)) {
                auto actual = layer_record(layer);
                need(actual.at("name") == value.at("name") && actual.at("colorIndex") == value.at("colorIndex") &&
                     actual.at("lineweight") == value.at("lineweight") && actual.at("linetype") == value.at("linetype"), "VERIFICATION_FAILED");
            } else need(same_geometry(style_record(record), value), "VERIFICATION_FAILED");
        }
        auto dim = read.get<AcDbDimStyleTableRecord>(named_symbol(db->dimStyleTableId(), dimStyleName));
        need(dim->dimtad() == 1 && dim->dimdsep() == (separator == "comma" ? L',' : L'.') && dim->dimdec() == static_cast<int>(precision) && db->psltscale(), "VERIFICATION_FAILED");
        read.commit();result["verified"] = true;
    } catch (...) {
        result["status"] = "failed";result["error"] = {{"code", "VERIFICATION_FAILED"}, {"message", "Standard profile committed but verification failed"}, {"retryable", false}};
    }
    return result;
}
