// Native MLEADER: one straight leader line, an ISO terminator (filled arrow,
// dot or none), optional horizontal reference line (landing) and plain text or
// local block content. Requested vertices are enforced and read back.
std::string leader_terminator(AcDbObjectId arrow) {
    if (arrow.isNull()) return "arrow";
    // Built-in arrowheads live in the block table under their global names.
    auto name = symbol_name(arrow);
    std::transform(name.begin(), name.end(), name.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
    return name == "_DOT" ? "dot" : name == "_NONE" ? "none" : "other:" + name;
}
json leader_geometry(AcDbEntity *e, double f) {
    auto ml = AcDbMLeader::cast(e);
    if (!ml) return json::object();
    AcArray<int> lines;cad(ml->getLeaderLineIndexes(lines));
    json vertices = json::array();
    if (lines.length() == 1) {
        int count = 0;cad(ml->numVertices(lines[0], count));need(count <= 64, "DOC_BUSY", "Leader vertex query limit reached");
        for (int i = 0; i < count; ++i) {AcGePoint3d v;cad(ml->getVertex(lines[0], i, v));vertices.push_back(xyz(v, f));}
    }
    AcArray<int> leaders;cad(ml->getLeaderIndexes(leaders));
    double landing = 0;std::string direction = "none";
    if (ml->enableDogleg() && leaders.length() == 1) {
        cad(ml->doglegLength(leaders[0], landing));AcGeVector3d dir;cad(ml->getDoglegDirection(leaders[0], dir));
        direction = dir.x > 0.5 ? "right" : dir.x < -0.5 ? "left" : "other";
    }
    json connection = nullptr;
    // Text joins at its attachment point. Base-connected blocks join at their
    // insertion point; connectionPoint() would report the block extents instead.
    if (ml->enableDogleg() && leaders.length() == 1 && ml->contentType() == AcDbMLeaderStyle::kMTextContent) {
        AcGeVector3d dir;cad(ml->getDoglegDirection(leaders[0], dir));AcGePoint3d at;
        if (ml->connectionPoint(-dir, at) == Acad::eOk) connection = xyz(at, f);
    } else if (ml->contentType() == AcDbMLeaderStyle::kBlockContent && ml->blockConnectionType() == AcDbMLeaderStyle::kConnectBase) {
        AcGePoint3d at;cad(ml->getBlockPosition(at));connection = xyz(at, f);
    }
    json out = {{"vertices", vertices}, {"leaderLineCount", lines.length()}, {"contentConnection", connection}, {"terminator", leader_terminator(ml->arrowSymbolId())},
                {"terminatorSize", ml->arrowSize() * f}, {"landingLength", ml->enableLanding() ? landing * f : 0}, {"landingDirection", direction}};
    const auto kind = ml->contentType();
    if (kind == AcDbMLeaderStyle::kMTextContent) {
        std::unique_ptr<AcDbMText> mt(ml->mtext());need(mt != nullptr, "EXECUTION_FAILED", "Leader text unavailable");
        AcString value;cad(mt->text(value));AcGePoint3d at;cad(ml->getTextLocation(at));
        out["contentKind"] = "text";out["text"] = annotation_newlines(utf8(value.kACharPtr()));out["textHeight"] = ml->textHeight() * f;
        out["position"] = xyz(at, f);out["style"] = symbol_name(ml->textStyleId());
    } else if (kind == AcDbMLeaderStyle::kBlockContent) {
        AcGePoint3d at;cad(ml->getBlockPosition(at));const auto scale = ml->blockScale();
        out["contentKind"] = "block";out["blockName"] = symbol_name(ml->blockContentId());out["position"] = xyz(at, f);
        out["scale"] = json::array({scale.sx, scale.sy, scale.sz});
        Transaction read(e->database());auto record = read.get<AcDbBlockTableRecord>(ml->blockContentId());
        AcDbBlockTableRecordIterator *raw = nullptr;cad(record->newIterator(raw));std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);
        json attributes = json::object();
        for (; !it->done(); it->step()) {
            need(attributes.size() < 32, "DOC_BUSY", "Leader attribute query limit reached");
            auto definition = AcDbAttributeDefinition::cast(read.get<AcDbEntity>(iterator_id(it.get())));
            if (!definition || definition->isConstant()) continue;
            ACHAR *value = nullptr;AcString tag;cad(definition->tag(tag));
            if (ml->getBlockAttributeValue(definition->objectId(), value) == Acad::eOk && value) {attributes[utf8(tag.kACharPtr())] = utf8(value);acutDelString(value);}
        }
        auto symbol = symbol_info(ml->blockContentId(), read);read.commit();out["attributes"] = attributes;
        if (!symbol.is_null()) out["symbol"] = symbol;
    } else out["contentKind"] = "none";
    return out;
}
json create_leader(AcDbDatabase *db, const json &p) {
    auto &s = state(db);need(s.revision == number(p, "expectedRevision"), "STALE_REVISION", "Drawing changed before leader creation");
    const double f = input_factor(db, p), out = output_factor(db, p);
    need(p.contains("vertices") && p.at("vertices").is_array() && p.at("vertices").size() >= 2 && p.at("vertices").size() <= 16);
    std::vector<AcGePoint3d> vertices;
    for (const auto &value : p.at("vertices")) {
        auto v = point(json{{"value", value}}, "value", f);need(v.z == 0 && (vertices.empty() || v.distanceTo(vertices.back()) > 1e-12));vertices.push_back(v);
    }
    const auto terminator = text(p, "terminator");need(terminator == "arrow" || terminator == "dot" || terminator == "none");
    const double size = annotation_number(p, "terminatorSize") * f, landing = annotation_number(p, "landingLength") * f;
    need(size > 0 && std::isfinite(size) && landing >= 0 && std::isfinite(landing));
    const auto side = text(p, "landingDirection");need(side == "left" || side == "right");
    const AcGeVector3d direction = side == "right" ? AcGeVector3d::kXAxis : -AcGeVector3d::kXAxis;
    const auto landingEnd = vertices.back() + direction * landing;
    need(p.contains("content") && p.at("content").is_object());const auto &content = p.at("content");const auto kind = text(content, "kind");
    Transaction tx(db);
    auto ml = std::make_unique<AcDbMLeader>();ml->setDatabaseDefaults(db);
    cad(ml->setMLeaderStyle(db->mleaderstyle()));cad(ml->setEnableAnnotationScale(false));
    cad(ml->setLeaderLineType(AcDbMLeaderStyle::kStraightLeader));cad(ml->setArrowSize(size));
    json expectedText = nullptr, expectedAttributes = json::object();AcDbObjectId blockId;
    if (kind == "none") {
        for (auto it = content.begin(); it != content.end(); ++it) need(it.key() == "kind");
        cad(ml->setContentType(AcDbMLeaderStyle::kNoneContent));
    } else if (kind == "text") {
        for (auto it = content.begin(); it != content.end(); ++it) need(std::set<std::string>{"kind", "text", "height", "style", "placement"}.contains(it.key()));
        const auto value = annotation_plain(content, true), placement = text(content, "placement");need(placement == "above" || placement == "after");
        const double height = annotation_number(content, "height") * f;need(height > 0 && std::isfinite(height));
        std::string escaped;for (char c : value) {if (c == '\n') escaped += "\\P";else {if (c == '\\' || c == '{' || c == '}') escaped += '\\';escaped += c;}}
        const auto style = content.contains("style") ? named_symbol(db->textStyleTableId(), text(content, "style")) : db->textstyle();
        AcDbMText mt;mt.setDatabaseDefaults(db);cad(mt.setTextStyle(style));cad(mt.setTextHeight(height));mt.setContents(wide(escaped).c_str());
        cad(mt.setLocation(landingEnd));
        cad(ml->setContentType(AcDbMLeaderStyle::kMTextContent));cad(ml->setTextStyleId(style));cad(ml->setMText(&mt));cad(ml->setTextHeight(height));
        // "above": text sits on the reference line; "after": text continues the line at mid height.
        const auto attach = placement == "above" ? AcDbMLeaderStyle::kAttachmentBottomOfBottom : AcDbMLeaderStyle::kAttachmentMiddle;
        cad(ml->setTextAttachmentType(attach, AcDbMLeaderStyle::kLeftLeader));cad(ml->setTextAttachmentType(attach, AcDbMLeaderStyle::kRightLeader));
        cad(ml->setLandingGap(height * 0.25));expectedText = value;
    } else {
        need(kind == "block");
        for (auto it = content.begin(); it != content.end(); ++it) need(std::set<std::string>{"kind", "name", "scale", "attributes"}.contains(it.key()));
        blockId = named_symbol(db->blockTableId(), text(content, "name"));local_block(tx, blockId);
        const double scale = annotation_number(content, "scale", 1);need(scale > 0 && std::isfinite(scale));
        expectedAttributes = attribute_values(content);
        cad(ml->setContentType(AcDbMLeaderStyle::kBlockContent));cad(ml->setBlockContentId(blockId));
        cad(ml->setBlockConnectionType(AcDbMLeaderStyle::kConnectBase));cad(ml->setLandingGap(0));cad(ml->setBlockScale(AcGeScale3d(scale)));cad(ml->setBlockPosition(landingEnd));
    }
    int line = 0;cad(ml->addLeaderLine(vertices.back(), line));
    for (auto i = vertices.size() - 1; i-- > 0;) cad(ml->addFirstVertex(line, vertices[i]));
    cad(ml->setEnableLanding(landing > 0));cad(ml->setEnableDogleg(landing > 0));
    if (landing > 0) {
        AcArray<int> leaders;cad(ml->getLeaderIndexes(leaders));need(leaders.length() == 1, "EXECUTION_FAILED", "Unexpected leader cluster");
        cad(ml->setDoglegLength(leaders[0], landing));cad(ml->setDoglegDirection(leaders[0], direction));
    }
    if (kind == "text") {
        // MLEADER joins text at its attachment point (adding a vertex to reach
        // it). connectionPoint takes the direction from the content back to the
        // leader. Move the text so that point is the end of the reference line.
        AcGePoint3d connection, at;cad(ml->connectionPoint(-direction, connection), "Leader connection");
        cad(ml->getTextLocation(at));cad(ml->setTextLocation(at + (landingEnd - connection)), "Leader text location");
    } else if (kind == "block") cad(ml->setBlockPosition(landingEnd), "Leader block position");
    int count = 0;cad(ml->numVertices(line, count));
    for (; count > static_cast<int>(vertices.size()); --count) cad(ml->removeLastVertex(line), "Leader connection vertex");
    for (std::size_t i = 0; i < vertices.size(); ++i) cad(ml->setVertex(line, static_cast<int>(i), vertices[i]));
    if (p.contains("layer")) cad(ml->setLayer(wide(text(p, "layer")).c_str()));else cad(ml->setLayer(db->clayer()));
    {AcDbLayerTableRecord *layer = nullptr;cad(acdbOpenObject(layer, ml->layerId(), AcDb::kForRead));bool locked = layer->isLocked();layer->close();need(!locked, "SECURITY_DENIED", "Layer is locked");}
    auto result = identity(db);result["operationId"] = text(p, "operationId");result["status"] = "succeeded";result["applied"] = true;result["verified"] = false;result["error"] = nullptr;
    result["created"] = json::array();result["modified"] = json::array();result["erased"] = json::array();
    auto model = tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db), AcDb::kForWrite);AcDbObjectId id;json expected;
    s.writing = true;
    try {
        check_cancel();
        // Built-in dot/none arrow blocks are created on first use. They are
        // fetched only after every argument has been validated.
        AcDbObjectId arrow;
        if (terminator != "arrow") cad(AcDmUtil::getArrowId(terminator == "dot" ? L"_DOT" : L"_NONE", arrow, db), "Arrow block");
        cad(ml->setArrowSymbolId(arrow));
        cad(model->appendAcDbEntity(id, ml.get()));auto e = ml.release();cad(tx.manager->addNewlyCreatedDBRObject(e, true));
        if (kind == "block") {
            auto record = tx.get<AcDbBlockTableRecord>(blockId);AcDbBlockTableRecordIterator *raw = nullptr;cad(record->newIterator(raw));
            std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);std::set<std::string> known;
            for (; !it->done(); it->step()) {
                auto definition = AcDbAttributeDefinition::cast(tx.get<AcDbEntity>(iterator_id(it.get())));
                if (!definition || definition->isConstant()) continue;
                AcString tag;cad(definition->tag(tag));const auto key = utf8(tag.kACharPtr());known.insert(key);
                if (expectedAttributes.contains(key)) cad(e->setBlockAttributeValue(definition->objectId(), wide(expectedAttributes.at(key).get<std::string>()).c_str()));
            }
            for (auto it2 = expectedAttributes.begin(); it2 != expectedAttributes.end(); ++it2)
                need(known.contains(it2.key()), "VALIDATION_FAILED", "Unknown attribute tag for leader block content");
        }
        expected = geometry(e, out);
        const auto unit = text(p, "lengthUnit");const double tolerance = unit == "m" ? 1e-9 : unit == "inch" ? 1e-6 / 25.4 : 1e-6;
        auto close = [&](const json &a, const AcGePoint3d &b) {return annotation_close(a, xyz(b, out), tolerance);};
        bool same = expected.at("leaderLineCount") == 1 && expected.at("vertices").size() == vertices.size();
        for (std::size_t i = 0; same && i < vertices.size(); ++i) same = close(expected.at("vertices")[i], vertices[i]);
        if (!same) throw Failure{"VERIFICATION_FAILED", "Leader vertices differ before commit: " + expected.at("vertices").dump()};
        need(expected.at("terminator") == terminator && std::abs(expected.at("terminatorSize").get<double>() - size * out) <= std::max(1e-9, size * out * 1e-9),
             "VERIFICATION_FAILED", ("Leader terminator differs before commit: " + expected.at("terminator").get<std::string>()).c_str());
        need(std::abs(expected.at("landingLength").get<double>() - landing * out) <= std::max(1e-9, landing * out * 1e-9) && (landing == 0 || expected.at("landingDirection") == side),
             "VERIFICATION_FAILED", "Leader landing differs before commit");
        need(expected.at("contentKind") == kind, "VERIFICATION_FAILED", "Leader content differs before commit");
        if (kind != "none" && landing > 0)
            need(!expected.at("contentConnection").is_null() && close(expected.at("contentConnection"), landingEnd), "VERIFICATION_FAILED",
                 ("Leader content is not joined at the end of the reference line: " + expected.at("contentConnection").dump()).c_str());
        if (kind == "text") need(expected.at("text") == expectedText, "VERIFICATION_FAILED", "Leader text differs before commit");
        if (kind == "block") need(expected.at("attributes") == expectedAttributes, "VERIFICATION_FAILED", "Leader attributes differ before commit");
        result["created"].push_back(ref(db, e));test_fault("abort_before_commit");check_cancel();tx.commit();s.writing = false;s.revision++;cursors.clear();
    } catch (...) {s.writing = false;throw;}
    result["revision"] = s.revision;
    try {
        Transaction read(db);auto actual = geometry(read.get<AcDbEntity>(id), out);read.commit();
        actual.erase("extents");auto compare = expected;compare.erase("extents");
        need(same_geometry(compare, actual), "VERIFICATION_FAILED");result["verified"] = true;
        result["observedGeometry"] = {{"items", json::array({actual})}, {"lengthUnit", p.at("lengthUnit")}, {"coordinateSystem", "WCS"}};
    } catch (...) {
        result["status"] = "failed";result["error"] = {{"code", "VERIFICATION_FAILED"}, {"message", "Committed leader could not be verified"}, {"retryable", false}};
    }
    return result;
}
