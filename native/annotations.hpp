// Included inside plugin.cpp's private namespace, after transaction/unit helpers.
// No commands, LISP, external files or measurement text overrides are accepted.
std::string symbol_name(AcDbObjectId id) {
    AcDbSymbolTableRecord *record=nullptr;cad(acdbOpenObject(record,id,AcDb::kForRead));
    AcString name;auto status=record->getName(name);record->close();cad(status);return utf8(name.kACharPtr());
}
AcDbObjectId named_symbol(AcDbObjectId tableId, const std::string &name) {
    AcDbSymbolTable *table=nullptr;cad(acdbOpenObject(table,tableId,AcDb::kForRead));
    AcDbObjectId id;auto status=table->getAt(wide(name).c_str(),id);table->close();
    need(status==Acad::eOk,"TARGET_NOT_FOUND","Named style or linetype not found");return id;
}
double annotation_number(const json &p, const char *key, double fallback = 0) {
    if (!p.contains(key)) return fallback;
    need(p.at(key).is_number() && std::isfinite(p.at(key).get<double>()));
    return p.at(key).get<double>();
}
std::string annotation_newlines(const std::string &value) {
    std::string normalized;
    for (std::size_t i = 0; i < value.size(); ++i) {
        if (value[i] == '\r') { if (i+1 < value.size() && value[i+1] == '\n') ++i; normalized += '\n'; }
        else normalized += value[i];
    }
    return normalized;
}
std::string annotation_plain(const json &p, bool multiline) {
    auto value = text(p, "text");
    need(value.find("%<") == std::string::npos);
    for (unsigned char c : value) need(c >= 32 || (multiline && (c == '\r' || c == '\n')));
    return annotation_newlines(value);
}
std::string annotation_type(AcDbEntity *e) {
    if (AcDbText::cast(e)) return "TEXT";
    if (AcDbMText::cast(e)) return "MTEXT";
    if (AcDbRotatedDimension::cast(e) || AcDbAlignedDimension::cast(e) ||
        AcDbDiametricDimension::cast(e) || AcDbRadialDimension::cast(e)) return "DIMENSION";
    return {};
}
json annotation_geometry(AcDbEntity *e, double f) {
    json out = json::object();
    if (auto t = AcDbText::cast(e)) {
        AcString value; cad(t->textString(value));
        out = {{"text",utf8(value.kACharPtr())},{"position",xyz(t->position(),f)},
               {"height",t->height()*f},{"rotation",t->rotation()},{"style",symbol_name(t->textStyle())}};
    }
    if (auto t = AcDbMText::cast(e)) {
        AcString value; cad(t->text(value));
        out = {{"text",annotation_newlines(utf8(value.kACharPtr()))},{"position",xyz(t->location(),f)},
               {"height",t->textHeight()*f},{"width",t->width()*f},{"rotation",t->rotation()},{"style",symbol_name(t->textStyle())}};
    }
    if (auto d = AcDbDimension::cast(e); d && annotation_type(e) == "DIMENSION") {
        double measured = 0; cad(d->measurement(measured));
        out = {{"measurement",measured*f},{"displayValue",measured*d->dimlfac()},
               {"dimensionScale",d->dimlfac()},{"textPosition",xyz(d->textPosition(),f)},
               {"textHeight",d->dimtxt()*f},{"arrowSize",d->dimasz()*f},{"precision",d->dimdec()},
               {"tolerance",d->dimtol()?json{{"lower",-d->dimtm()},{"upper",d->dimtp()}}:json(nullptr)}, {"style",symbol_name(d->dimensionStyle())}};
        if (auto linear = AcDbRotatedDimension::cast(d)) {
            out["dimensionKind"]="linear"; out["start"]=xyz(linear->xLine1Point(),f);
            out["end"]=xyz(linear->xLine2Point(),f); out["linePoint"]=xyz(linear->dimLinePoint(),f); out["rotation"]=linear->rotation();
        } else if (auto aligned = AcDbAlignedDimension::cast(d)) {
            out["dimensionKind"]="aligned";out["start"]=xyz(aligned->xLine1Point(),f);
            out["end"]=xyz(aligned->xLine2Point(),f);out["linePoint"]=xyz(aligned->dimLinePoint(),f);
        } else if (auto diameter = AcDbDiametricDimension::cast(d)) {
            out["dimensionKind"]="diameter";out["start"]=xyz(diameter->chordPoint(),f);
            out["end"]=xyz(diameter->farChordPoint(),f);out["leaderLength"]=diameter->leaderLength()*f;
        } else if (auto radial = AcDbRadialDimension::cast(d)) {
            out["dimensionKind"]="radius";out["start"]=xyz(radial->center(),f);
            out["end"]=xyz(radial->chordPoint(),f);out["leaderLength"]=radial->leaderLength()*f;
        }
    }
    return out;
}
std::unique_ptr<AcDbEntity> make_annotation(AcDbDatabase *db, const std::string &method, const json &p, double f) {
    if (method == "acad_create_text" || method == "acad_create_mtext") {
        auto at = point(p,"position",f); need(at.z == 0);
        annotation_plain(p,method == "acad_create_mtext");
        need(annotation_number(p,"height")*f > 0 && std::isfinite(annotation_number(p,"height")*f));
        if (method == "acad_create_text") return std::make_unique<AcDbText>();
        need(annotation_number(p,"width")*f > 0 && std::isfinite(annotation_number(p,"width")*f));
        return std::make_unique<AcDbMText>();
    }
    const auto kind = text(p,"kind");
    auto a=point(p,"start",f), b=point(p,"end",f), line=point(p,"linePoint",f);
    need(a.z==0 && b.z==0 && line.z==0 && a.distanceTo(b)>1e-12);
    double leader=annotation_number(p,"leaderLength")*f; need(leader>=0 && std::isfinite(leader));
    if (kind=="linear") {
        auto angle=annotation_number(p,"rotation");
        need(std::abs((b.x-a.x)*std::cos(angle)+(b.y-a.y)*std::sin(angle))>1e-12);
        return std::make_unique<AcDbRotatedDimension>(angle,a,b,line,nullptr,db->dimstyle());
    }
    if (kind=="aligned") return std::make_unique<AcDbAlignedDimension>(a,b,line,nullptr,db->dimstyle());
    if (kind=="diameter") return std::make_unique<AcDbDiametricDimension>(a,b,leader,nullptr,db->dimstyle());
    need(kind=="radius");return std::make_unique<AcDbRadialDimension>(a,b,leader,nullptr,db->dimstyle());
}
void configure_annotation(AcDbEntity *e, AcDbDatabase *db, const json &p, double f) {
    if (auto t=AcDbText::cast(e)) {
        cad(t->setPosition(point(p,"position",f)));cad(t->setHeight(annotation_number(p,"height")*f));
        cad(t->setRotation(annotation_number(p,"rotation")));cad(t->setTextStyle(p.contains("style")?named_symbol(db->textStyleTableId(),text(p,"style")):db->textstyle()));
        cad(t->setTextString(wide(annotation_plain(p,false)).c_str()));
    }
    if (auto t=AcDbMText::cast(e)) {
        auto value=annotation_plain(p,true);std::string escaped;
        for (char c:value) {if(c=='\n') escaped+="\\P";else {if(c=='\\'||c=='{'||c=='}')escaped+='\\';escaped+=c;}}
        cad(t->setLocation(point(p,"position",f)));cad(t->setTextHeight(annotation_number(p,"height")*f));
        cad(t->setWidth(annotation_number(p,"width")*f));cad(t->setRotation(annotation_number(p,"rotation")));
        cad(t->setTextStyle(p.contains("style")?named_symbol(db->textStyleTableId(),text(p,"style")):db->textstyle()));t->setContents(wide(escaped).c_str());
    }
    if (auto d=AcDbDimension::cast(e)) {
        const bool styled=p.contains("style");if(styled)cad(d->setDimensionStyle(named_symbol(db->dimStyleTableId(),text(p,"style"))));
        double h=p.contains("textHeight")?annotation_number(p,"textHeight")*f:styled?d->dimtxt():2.5*f;
        double arrow=p.contains("arrowSize")?annotation_number(p,"arrowSize")*f:styled?d->dimasz():2.5*f;
        need(h>0 && arrow>0 && std::isfinite(h) && std::isfinite(arrow));
        auto precision=p.contains("precision")?number(p,"precision"):styled?static_cast<std::uint64_t>(d->dimdec()):2;need(precision<=8);
        cad(d->setDimscale(1));cad(d->setDimlfac(1/f));cad(d->setDimlunit(2));cad(d->setDimdec(static_cast<int>(precision)));
        cad(d->setDimtxt(h));cad(d->setDimasz(arrow));cad(d->setDimgap(h*0.4));
        cad(d->setDimexo(h*0.25));cad(d->setDimexe(h*0.5));cad(d->setDimlim(false));
        cad(d->setDimalt(false));cad(d->setDimrnd(0));cad(d->setDimensionText(L""));
        cad(d->setDimtol(p.contains("tolerance")));cad(d->setDimtdec(static_cast<int>(precision)));
        if(p.contains("tolerance")) {
            const auto &v=p.at("tolerance");need(v.is_object() && v.size()==2 && v.contains("lower") && v.contains("upper"));
            auto lower=annotation_number(v,"lower"),upper=annotation_number(v,"upper");need(lower<=0 && upper>=0);
            cad(d->setDimtm(-lower));cad(d->setDimtp(upper));
        }
        if(text(p,"kind")=="radius" || text(p,"kind")=="diameter") {
            cad(d->setTextPosition(point(p,"linePoint",f)));cad(d->useSetTextPosition());
        }
    }
}
bool annotation_close(const json &a, const json &b, double t) {
    if(!a.is_array()||!b.is_array()||a.size()!=3||b.size()!=3)return false;
    for(int i=0;i<3;++i)if(!a[i].is_number()||std::abs(a[i].get<double>()-b[i].get<double>())>t)return false;
    return true;
}
bool verify_annotation(const std::string &method, const json &p, const json &after, double t) {
    if(after.size()!=1)return false;const auto &a=after[0];
    if(p.contains("layer") && a.at("layer")!=p.at("layer"))return false;
    if(p.contains("style") && a.at("style")!=p.at("style"))return false;
    if(method!="acad_create_dimension") {
        bool ok=annotation_close(a.at("position"),p.at("position"),t)&&a.at("text")==annotation_plain(p,method=="acad_create_mtext")&&
            std::abs(a.at("height").get<double>()-annotation_number(p,"height"))<=t &&
            std::abs(std::remainder(a.at("rotation").get<double>()-annotation_number(p,"rotation"),2*3.141592653589793))<1e-9;
        return ok && (method!="acad_create_mtext" || std::abs(a.at("width").get<double>()-annotation_number(p,"width"))<=t);
    }
    auto start=point(p,"start"),end=point(p,"end");
    double expected=text(p,"kind")=="linear"?std::abs((end.x-start.x)*std::cos(annotation_number(p,"rotation"))+(end.y-start.y)*std::sin(annotation_number(p,"rotation"))):start.distanceTo(end);
    return a.at("dimensionKind")==p.at("kind") && annotation_close(a.at("start"),p.at("start"),t) && annotation_close(a.at("end"),p.at("end"),t) &&
        std::abs(a.at("measurement").get<double>()-expected)<=t && std::abs(a.at("displayValue").get<double>()-expected)<=t &&
        ((p.contains("style")&&!p.contains("textHeight"))||std::abs(a.at("textHeight").get<double>()-annotation_number(p,"textHeight",2.5))<=t) &&
        ((p.contains("style")&&!p.contains("arrowSize"))||std::abs(a.at("arrowSize").get<double>()-annotation_number(p,"arrowSize",2.5))<=t) &&
        ((p.contains("style")&&!p.contains("precision"))||a.at("precision")==p.value("precision",2)) && a.at("tolerance")==p.value("tolerance",json(nullptr));
}

json layer_record(AcDbLayerTableRecord *layer) {
    AcString name;cad(layer->getName(name));
    return {{"name",utf8(name.kACharPtr())},{"dependent",layer->isDependent()},{"colorIndex",layer->color().colorIndex()},
            {"lineweight",static_cast<int>(layer->lineWeight())},{"locked",layer->isLocked()},
            {"off",layer->isOff()},{"frozen",layer->isFrozen()},{"plottable",static_cast<bool>(layer->isPlottable())},{"linetype",symbol_name(layer->linetypeObjectId())}};
}
json list_layers(AcDbDatabase *db) {
    Transaction tx(db);auto table=tx.get<AcDbLayerTable>(db->layerTableId());
    AcDbLayerTableIterator *raw=nullptr;cad(table->newIterator(raw));std::unique_ptr<AcDbLayerTableIterator> it(raw);
    json layers=json::array();std::size_t bytes=0;
    for(;!it->done();it->step()) {
        need(layers.size()<1000,"DOC_BUSY","Layer listing limit reached");
        AcDbObjectId id;cad(it->getRecordId(id));auto value=layer_record(tx.get<AcDbLayerTableRecord>(id));
        bytes+=value.dump().size();need(bytes<350000,"DOC_BUSY","Layer response budget reached");layers.push_back(value);
    }
    tx.commit();return {{"layers",layers},{"revision",state(db).revision}};
}
json create_layer(AcDbDatabase *db, const json &p) {
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION","Drawing changed before layer creation");
    auto name=text(p,"name");need(name.size()<=512 && name.find_first_of("<>/\\\":;?*|=,")==std::string::npos);
    for(unsigned char c:name)need(c>=32);
    auto color=number(p,"colorIndex"),weight=p.contains("lineweight")?number(p,"lineweight"):25;
    need(color>=1 && color<=255 && std::set<std::uint64_t>{0,5,9,13,15,18,20,25,30,35,40,50,53,60,70,80,90,100,106,120,140,158,200,211}.contains(weight));
    Transaction tx(db);auto table=tx.get<AcDbLayerTable>(db->layerTableId(),AcDb::kForWrite);
    need(!table->has(wide(name).c_str()),"VALIDATION_FAILED","Layer already exists");
    auto layer=std::make_unique<AcDbLayerTableRecord>();cad(layer->setName(wide(name).c_str()));
    AcCmColor aci;aci.setColorIndex(static_cast<Adesk::UInt16>(color));layer->setColor(aci);
    cad(layer->setLineWeight(static_cast<AcDb::LineWeight>(weight)));
    auto continuous=named_symbol(db->linetypeTableId(),p.value("linetype",std::string("Continuous")));
    cad(layer->setLinetypeObjectId(continuous));layer->setIsLocked(false);layer->setIsOff(false);cad(layer->setIsFrozen(false));
    auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";
    result["applied"]=true;result["verified"]=false;result["error"]=nullptr;
    AcDbObjectId id;s.writing=true;
    try {check_cancel();cad(table->add(id,layer.get()));auto raw=layer.release();cad(tx.manager->addNewlyCreatedDBRObject(raw,true));check_cancel();tx.commit();s.revision++;cursors.clear();s.writing=false;}
    catch(...){s.writing=false;throw;}
    result["revision"]=s.revision;
    try {Transaction read(db);auto actual=layer_record(read.get<AcDbLayerTableRecord>(id));read.commit();
        need(actual.at("name")==name && actual.at("colorIndex")==color && actual.at("lineweight")==weight,"VERIFICATION_FAILED");
        result["createdLayers"]=json::array({actual});result["verified"]=true;
    } catch(...) {result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Layer committed but verification failed"},{"retryable",false}};}
    return result;
}

json style_record(AcDbSymbolTableRecord *record) {
    AcString name;cad(record->getName(name));json out={{"name",utf8(name.kACharPtr())},{"dependent",record->isDependent()}};
    if(auto textStyle=AcDbTextStyleTableRecord::cast(record)) {
        AcString filename;cad(textStyle->fileName(filename));
        out["kind"]="text";out["font"]=utf8(std::filesystem::path(filename.kACharPtr()).filename().c_str());
        out["widthFactor"]=textStyle->xScale();out["fixedHeight"]=textStyle->textSize();
    } else if(auto dimStyle=AcDbDimStyleTableRecord::cast(record)) {
        out["kind"]="dimension";out["textStyle"]=symbol_name(dimStyle->dimtxsty());out["textHeight"]=dimStyle->dimtxt();
        out["arrowSize"]=dimStyle->dimasz();out["precision"]=dimStyle->dimdec();out["dimensionScale"]=dimStyle->dimlfac();
    } else if(auto lineStyle=AcDbLinetypeTableRecord::cast(record)) {
        out["kind"]="linetype";out["patternLength"]=lineStyle->patternLength();out["dashes"]=json::array();
        for(int i=0;i<lineStyle->numDashes();++i)out["dashes"].push_back(lineStyle->dashLengthAt(i));
    }
    return out;
}
json list_styles(AcDbDatabase *db) {
    Transaction tx(db);json styles=json::array();std::size_t bytes=0;
    for(auto tableId:{db->textStyleTableId(),db->dimStyleTableId(),db->linetypeTableId()}) {
        auto table=tx.get<AcDbSymbolTable>(tableId);AcDbSymbolTableIterator *raw=nullptr;
        cad(table->newIterator(raw));std::unique_ptr<AcDbSymbolTableIterator> it(raw);
        for(;!it->done();it->step()) {
            need(styles.size()<1000,"DOC_BUSY","Style listing limit reached");AcDbObjectId id;cad(it->getRecordId(id));
            auto value=style_record(tx.get<AcDbSymbolTableRecord>(id));bytes+=value.dump().size();
            need(bytes<350000,"DOC_BUSY","Style response budget reached");styles.push_back(value);
        }
    }
    tx.commit();return {{"styles",styles},{"revision",state(db).revision},{"sizeUnit","drawing_unit"}};
}
json create_style(AcDbDatabase *db, const json &p) {
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION","Drawing changed before style creation");
    const auto kind=text(p,"kind"),name=text(p,"name");need(name.size()<=512 && name.find_first_of("<>/\\\":;?*|=,")==std::string::npos);
    for(unsigned char c:name)need(c>=32);
    std::set<std::string> allowed={"instanceId","documentId","documentEpoch","expectedRevision","operationId","kind","name"};
    if(kind=="text")allowed.insert({"font","widthFactor"});else allowed.insert({"coordinateSystem","lengthUnit"});
    if(kind=="dimension")allowed.insert({"textStyle","textHeight","arrowSize","precision"});
    if(kind=="linetype")allowed.insert("dashes");
    for(auto it=p.begin();it!=p.end();++it)need(allowed.contains(it.key()));
    Transaction tx(db);std::unique_ptr<AcDbSymbolTableRecord> record;AcDbObjectId tableId;
    if(kind=="text") {
        const auto font=text(p,"font");need(font=="arial.ttf"||font=="txt.shx");
        auto style=std::make_unique<AcDbTextStyleTableRecord>();cad(style->setFileName(wide(font).c_str()));
        const double width=annotation_number(p,"widthFactor",1);need(width>0 && width<=10);cad(style->setXScale(width));cad(style->setTextSize(0));
        tableId=db->textStyleTableId();record=std::move(style);
    } else {
        need(text(p,"coordinateSystem")=="WCS");double f=input_factor(db,p);
        if(kind=="dimension") {
            auto style=std::make_unique<AcDbDimStyleTableRecord>();double h=annotation_number(p,"textHeight")*f,a=annotation_number(p,"arrowSize")*f;
            need(h>0&&a>0&&std::isfinite(h)&&std::isfinite(a));auto precision=number(p,"precision");need(precision<=8);
            cad(style->setDimtxsty(named_symbol(db->textStyleTableId(),text(p,"textStyle"))));
            cad(style->setDimtxt(h));cad(style->setDimasz(a));cad(style->setDimdec(static_cast<int>(precision)));
            cad(style->setDimlunit(2));cad(style->setDimscale(1));cad(style->setDimlfac(1/f));cad(style->setDimtol(false));cad(style->setDimlim(false));
            tableId=db->dimStyleTableId();record=std::move(style);
        } else {
            need(kind=="linetype" && p.contains("dashes") && p.at("dashes").is_array());const auto &d=p.at("dashes");
            need(d.size()>=2 && d.size()<=16);auto style=std::make_unique<AcDbLinetypeTableRecord>();
            cad(style->setNumDashes(static_cast<int>(d.size())));double total=0;bool ink=false,gap=false;
            for(std::size_t i=0;i<d.size();++i){need(d[i].is_number());double v=d[i].get<double>()*f;need(std::isfinite(v));ink|=v>0;gap|=v<0;total+=std::abs(v);cad(style->setDashLengthAt(static_cast<int>(i),v));}
            need(ink&&gap&&std::isfinite(total)&&total>0);cad(style->setPatternLength(total));
            tableId=db->linetypeTableId();record=std::move(style);
        }
    }
    cad(record->setName(wide(name).c_str()));auto expected=style_record(record.get());
    auto table=tx.get<AcDbSymbolTable>(tableId,AcDb::kForWrite);need(!table->has(wide(name).c_str()),"VALIDATION_FAILED","Style already exists");
    auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["error"]=nullptr;
    AcDbObjectId id;s.writing=true;
    try{check_cancel();cad(table->add(id,record.get()));auto raw=record.release();cad(tx.manager->addNewlyCreatedDBRObject(raw,true));check_cancel();tx.commit();s.revision++;cursors.clear();s.writing=false;}
    catch(...){s.writing=false;throw;}
    result["revision"]=s.revision;
    try{Transaction read(db);auto actual=style_record(read.get<AcDbSymbolTableRecord>(id));read.commit();need(actual==expected,"VERIFICATION_FAILED");result["createdStyles"]=json::array({actual});result["verified"]=true;}
    catch(...){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Style committed but verification failed"},{"retryable",false}};}
    return result;
}
