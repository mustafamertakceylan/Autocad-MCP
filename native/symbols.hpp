// Code-generated drawing symbols stored as named local blocks. Callers build a
// SymbolSpec in drawing units (proportions already multiplied by lettering
// height h); the engine never accepts caller geometry from the MCP client.
// The block name embeds a content hash and the definition carries a signature
// Xrecord, so a same-named block with different content is rejected, never reused.
struct SymbolPart {
    std::string kind; // line, polyline, circle, arc, fill, text, attribute
    std::vector<AcGePoint2d> points;
    bool closed = false;
    double radius = 0, startAngle = 0, endAngle = 0, height = 0;
    std::string text, tag, align = "left";
};
struct SymbolSpec {
    std::string id;
    int version = 1;
    std::vector<SymbolPart> parts;
};
constexpr const wchar_t *symbol_dictionary_key = L"AUTOCAD_MCP_SYMBOL";
json symbol_spec_json(const SymbolSpec &spec) {
    // Rounded to 1e-9 drawing units so the signature is stable across reads.
    auto r = [](double v) { return std::round(v * 1e9) / 1e9; };
    json parts = json::array();
    for (const auto &part : spec.parts) {
        json points = json::array();
        for (const auto &v : part.points) points.push_back(json::array({r(v.x), r(v.y)}));
        parts.push_back({{"kind", part.kind}, {"points", points}, {"closed", part.closed}, {"radius", r(part.radius)},
                         {"startAngle", r(part.startAngle)}, {"endAngle", r(part.endAngle)}, {"height", r(part.height)},
                         {"text", part.text}, {"tag", part.tag}, {"align", part.align}});
    }
    return {{"id", spec.id}, {"version", spec.version}, {"parts", parts}};
}
std::string symbol_hash(const std::string &value) {
    std::uint64_t hash = 14695981039346656037ULL; // FNV-1a: stable across builds, not a security boundary.
    for (unsigned char c : value) { hash ^= c; hash *= 1099511628211ULL; }
    char out[17]{};std::snprintf(out, sizeof out, "%016llx", static_cast<unsigned long long>(hash));
    return out;
}
std::string symbol_block_name(const SymbolSpec &spec) {
    need(std::regex_match(spec.id, std::regex("[A-Z][A-Z0-9-]{0,47}")) && spec.version > 0 && !spec.parts.empty() && spec.parts.size() <= 64);
    return "MCP-SYM-" + spec.id + "-V" + std::to_string(spec.version) + "-" + symbol_hash(symbol_spec_json(spec).dump()).substr(0, 12);
}
std::string symbol_signature(AcDbObject *record, Transaction &tx) {
    const auto dictionaryId = record->extensionDictionary();
    if (dictionaryId.isNull()) return {};
    auto dictionary = tx.get<AcDbDictionary>(dictionaryId);
    AcDbObjectId xrecordId;
    if (dictionary->getAt(symbol_dictionary_key, xrecordId) != Acad::eOk) return {};
    auto xrecord = tx.get<AcDbXrecord>(xrecordId);
    resbuf *raw = nullptr;
    cad(xrecord->rbChain(&raw));
    std::string value;
    for (auto item = raw; item; item = item->rbnext)
        if (item->restype == AcDb::kDxfXTextString && item->resval.rstring) value += utf8(item->resval.rstring);
    acutRelRb(raw);
    return value;
}
json symbol_info(AcDbObjectId blockId, Transaction &tx) {
    auto signature = symbol_signature(tx.get<AcDbBlockTableRecord>(blockId), tx);
    if (signature.empty()) return nullptr;
    auto spec = json::parse(signature, nullptr, false);
    if (!spec.is_object() || !spec.contains("id") || !spec.contains("version")) return nullptr;
    return {{"id", spec.at("id")}, {"version", spec.at("version")}};
}
std::unique_ptr<AcDbEntity> symbol_entity(AcDbDatabase *db, const SymbolPart &part, AcDbObjectId textStyle) {
    auto at = [](const AcGePoint2d &v) { return AcGePoint3d(v.x, v.y, 0); };
    auto finite = [](double v) { return std::isfinite(v); };
    for (const auto &v : part.points) need(finite(v.x) && finite(v.y), "EXECUTION_FAILED", "Invalid symbol geometry");
    std::unique_ptr<AcDbEntity> e;
    if (part.kind == "line") {
        need(part.points.size() == 2 && part.points[0] != part.points[1], "EXECUTION_FAILED", "Invalid symbol line");
        e = std::make_unique<AcDbLine>(at(part.points[0]), at(part.points[1]));
    } else if (part.kind == "polyline") {
        need(part.points.size() >= 2 && part.points.size() <= 64, "EXECUTION_FAILED", "Invalid symbol polyline");
        auto poly = std::make_unique<AcDbPolyline>(static_cast<unsigned int>(part.points.size()));
        for (std::size_t i = 0; i < part.points.size(); ++i) cad(poly->addVertexAt(static_cast<unsigned int>(i), part.points[i]));
        poly->setClosed(part.closed);e = std::move(poly);
    } else if (part.kind == "circle" || part.kind == "arc") {
        need(part.points.size() == 1 && part.radius > 0 && finite(part.radius), "EXECUTION_FAILED", "Invalid symbol circle");
        if (part.kind == "circle") e = std::make_unique<AcDbCircle>(at(part.points[0]), AcGeVector3d::kZAxis, part.radius);
        else e = std::make_unique<AcDbArc>(at(part.points[0]), AcGeVector3d::kZAxis, part.radius, part.startAngle, part.endAngle);
    } else if (part.kind == "fill") {
        // A 2D SOLID orders quadrilateral corners 0,1,3,2; triangles repeat the last point.
        need(part.points.size() == 3 || part.points.size() == 4, "EXECUTION_FAILED", "Filled symbol areas are triangles or quadrilaterals");
        const auto &v = part.points;
        e = v.size() == 3 ? std::make_unique<AcDbSolid>(at(v[0]), at(v[1]), at(v[2]))
                          : std::make_unique<AcDbSolid>(at(v[0]), at(v[1]), at(v[3]), at(v[2]));
    } else {
        need((part.kind == "text" || part.kind == "attribute") && part.points.size() == 1 && part.height > 0 && finite(part.height), "EXECUTION_FAILED", "Invalid symbol text");
        need(part.align == "left" || part.align == "center" || part.align == "right" || part.align == "middle", "EXECUTION_FAILED", "Invalid symbol text alignment");
        std::unique_ptr<AcDbText> t;
        if (part.kind == "attribute") {
            need(std::regex_match(part.tag, std::regex("[A-Z][A-Z0-9_]{0,31}")), "EXECUTION_FAILED", "Invalid symbol attribute tag");
            auto a = std::make_unique<AcDbAttributeDefinition>();
            cad(a->setTag(wide(part.tag).c_str()));cad(a->setPrompt(wide(part.tag).c_str()));a->setInvisible(false);a->setConstant(false);
            t = std::move(a);
        } else t = std::make_unique<AcDbText>();
        t->setDatabaseDefaults(db);cad(t->setTextStyle(textStyle));cad(t->setHeight(part.height));
        cad(t->setTextString(wide(part.text).c_str()));cad(t->setPosition(at(part.points[0])));
        if (part.align != "left") {
            cad(t->setHorizontalMode(part.align == "right" ? AcDb::kTextRight : part.align == "middle" ? AcDb::kTextMid : AcDb::kTextCenter));
            cad(t->setAlignmentPoint(at(part.points[0])));
        }
        e = std::move(t);
    }
    e->setDatabaseDefaults(db);
    // Symbol parts follow the inserting entity: layer 0 plus ByBlock properties.
    cad(e->setLayer(L"0"));AcCmColor byBlock;byBlock.setByBlock();cad(e->setColor(byBlock));
    cad(e->setLinetype(L"ByBlock"));cad(e->setLineWeight(AcDb::kLnWtByBlock));
    return e;
}
// Returns the block id; created reports whether this call added the definition.
AcDbObjectId ensure_symbol(AcDbDatabase *db, Transaction &tx, const SymbolSpec &spec, AcDbObjectId textStyle, bool &created) {
    const auto name = symbol_block_name(spec), signature = symbol_spec_json(spec).dump();
    created = false;
    auto table = tx.get<AcDbBlockTable>(db->blockTableId(), AcDb::kForWrite);
    AcDbObjectId existing;
    if (table->getAt(wide(name).c_str(), existing) == Acad::eOk) {
        auto record = tx.get<AcDbBlockTableRecord>(existing);
        need(!record->isFromExternalReference() && !record->isLayout() && symbol_signature(record, tx) == signature,
             "VALIDATION_FAILED", "A different block already uses the reserved symbol name");
        return existing;
    }
    auto record = std::make_unique<AcDbBlockTableRecord>();
    cad(record->setName(wide(name).c_str()));cad(record->setOrigin(AcGePoint3d::kOrigin));
    AcDbObjectId id;cad(table->add(id, record.get()));auto block = record.release();cad(tx.manager->addNewlyCreatedDBRObject(block, true));
    for (const auto &part : spec.parts) {
        auto e = symbol_entity(db, part, textStyle);AcDbObjectId partId;
        cad(block->appendAcDbEntity(partId, e.get()));cad(tx.manager->addNewlyCreatedDBRObject(e.release(), true));
    }
    cad(block->createExtensionDictionary());
    auto dictionary = tx.get<AcDbDictionary>(block->extensionDictionary(), AcDb::kForWrite);
    auto xrecord = std::make_unique<AcDbXrecord>();
    // Xrecord strings are chunked: one resbuf string stays well below DXF limits.
    resbuf *head = nullptr, *tail = nullptr;
    for (std::size_t offset = 0; offset < signature.size(); offset += 200) {
        auto item = acutNewRb(AcDb::kDxfXTextString);
        acutNewString(wide(signature.substr(offset, 200)).c_str(), item->resval.rstring);
        if (tail) tail->rbnext = item; else head = item;
        tail = item;
    }
    const auto status = xrecord->setFromRbChain(*head);acutRelRb(head);cad(status);
    AcDbObjectId xrecordId;cad(dictionary->setAt(symbol_dictionary_key, xrecord.get(), xrecordId));
    cad(tx.manager->addNewlyCreatedDBRObject(xrecord.release(), true));
    need(symbol_signature(block, tx) == signature, "VERIFICATION_FAILED", "Symbol signature differs before commit");
    created = true;
    return id;
}
