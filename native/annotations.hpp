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
        AcDbDiametricDimension::cast(e) || AcDbRadialDimension::cast(e) || AcDb2LineAngularDimension::cast(e) ||
        AcDb3PointAngularDimension::cast(e) || AcDbArcDimension::cast(e) || AcDbOrdinateDimension::cast(e)) return "DIMENSION";
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
        // Angles are radians (displayed in degrees); every other kind is a length.
        const bool angular = AcDb2LineAngularDimension::cast(d) || AcDb3PointAngularDimension::cast(d);
        AcString override_text; cad(d->dimensionText(override_text));
        out = {{"measurement",angular?measured:measured*f},{"displayValue",angular?measured*180/3.141592653589793:measured*d->dimlfac()},
               {"measurementUnit",angular?"rad":"length"},
               {"dimensionScale",d->dimlfac()},{"textPosition",xyz(d->textPosition(),f)},
               {"textHeight",d->dimtxt()*f},{"arrowSize",d->dimasz()*f},{"precision",angular?d->dimadec():d->dimdec()},
               {"tolerance",d->dimtol()||d->dimlim()?json{{"lower",-d->dimtm()},{"upper",d->dimtp()}}:json(nullptr)}, {"style",symbol_name(d->dimensionStyle())},
               {"decimalSeparator",std::string(1,static_cast<char>(d->dimdsep()))},{"dimensionText",utf8(override_text.kACharPtr())},{"basic",d->dimgap()<0},{"limits",static_cast<bool>(d->dimlim())},
               {"trailingZeros",(d->dimzin()&8)||(d->dimtzin()&8)?"suppressed":"kept"},{"tolerancePrecision",d->dimtdec()},
               {"suppressed",d->dimsd1()&&d->dimse1()?json("first"):d->dimsd2()&&d->dimse2()?json("second"):json(nullptr)}};
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
        } else if (auto two = AcDb2LineAngularDimension::cast(d)) {
            out["dimensionKind"]="angular";out["start"]=xyz(two->xLine1Start(),f);out["end"]=xyz(two->xLine1End(),f);
            out["start2"]=xyz(two->xLine2Start(),f);out["end2"]=xyz(two->xLine2End(),f);out["linePoint"]=xyz(two->arcPoint(),f);
        } else if (auto three = AcDb3PointAngularDimension::cast(d)) {
            out["dimensionKind"]="angular3";out["center"]=xyz(three->centerPoint(),f);out["start"]=xyz(three->xLine1Point(),f);
            out["end"]=xyz(three->xLine2Point(),f);out["linePoint"]=xyz(three->arcPoint(),f);
        } else if (auto arc = AcDbArcDimension::cast(d)) {
            out["dimensionKind"]="arc_length";out["center"]=xyz(arc->centerPoint(),f);out["start"]=xyz(arc->xLine1Point(),f);
            out["end"]=xyz(arc->xLine2Point(),f);out["linePoint"]=xyz(arc->arcPoint(),f);
        } else if (auto ordinate = AcDbOrdinateDimension::cast(d)) {
            out["dimensionKind"]="ordinate";out["axis"]=ordinate->isUsingXAxis()?"x":"y";out["origin"]=xyz(ordinate->origin(),f);
            out["start"]=xyz(ordinate->definingPoint(),f);out["end"]=xyz(ordinate->leaderEndPoint(),f);
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
    auto a=point(p,"start",f), b=point(p,"end",f);
    need(a.z==0 && b.z==0 && a.distanceTo(b)>1e-12);
    if (kind=="ordinate") {
        const auto axis=text(p,"axis");need(axis=="x"||axis=="y");
        auto origin=p.contains("origin")?point(p,"origin",f):AcGePoint3d::kOrigin;need(origin.z==0);
        auto d=std::make_unique<AcDbOrdinateDimension>(axis=="x",a,b,nullptr,db->dimstyle());cad(d->setOrigin(origin));return d;
    }
    auto line=point(p,"linePoint",f);need(line.z==0);
    if (kind=="angular") {
        auto c=point(p,"start2",f),e=point(p,"end2",f);need(c.z==0&&e.z==0&&c.distanceTo(e)>1e-12);
        need(!(b-a).isParallelTo(e-c),"VALIDATION_FAILED","Angular dimension lines must not be parallel");
        return std::make_unique<AcDb2LineAngularDimension>(a,b,c,e,line,nullptr,db->dimstyle());
    }
    if (kind=="angular3"||kind=="arc_length") {
        auto center=point(p,"center",f);need(center.z==0&&center.distanceTo(a)>1e-12&&center.distanceTo(b)>1e-12);
        if (kind=="arc_length") {
            need(std::abs(center.distanceTo(a)-center.distanceTo(b))<=std::max(1e-9,center.distanceTo(a)*1e-9),"VALIDATION_FAILED","Arc length end points must lie on one circle");
            return std::make_unique<AcDbArcDimension>(center,a,b,line,nullptr,db->dimstyle());
        }
        return std::make_unique<AcDb3PointAngularDimension>(center,a,b,line,nullptr,db->dimstyle());
    }
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
// Dimension text template. "<>" is AutoCAD's live measured value: notation only
// adds ISO symbols around the real measurement and can never replace it.
// Written values keep their display precision, including trailing zeros,
// without inferring acceptance tolerances; only the decimal
// separator follows the drawing. Signed values are tolerance deviations.
std::string written(const json &p, const char *key, bool signed_value = false) {
    const auto value = text(p, key);
    need(std::regex_match(value, std::regex(signed_value ? "0([.,]0{1,4})?|[+-][0-9]{1,3}([.,][0-9]{1,4})?" : "[0-9]{1,4}([.,][0-9]{1,4})?")),
         "VALIDATION_FAILED", "Values are written decimals such as 11, 11,00 or +0,021");
    return value;
}
double written_value(const json &p, const char *key, bool signed_value = false) {
    auto value = written(p, key, signed_value);
    for (auto &c : value) if (c == ',') c = '.';
    return std::stod(value);
}
std::string written_text(const json &p, const char *key, wchar_t separator, bool signed_value = false) {
    auto value = written(p, key, signed_value);
    for (auto &c : value) if (c == '.' || c == ',') c = static_cast<char>(separator);
    return value;
}
std::string dimension_override(const json &n, wchar_t separator, const std::string &dimensionKind) {
    need(n.is_object());
    for (auto it = n.begin(); it != n.end(); ++it)
        need(std::set<std::string>{"kind","prefix","count","fit","fitDeviations","limits","singleLimit","sizeModifiers","suppress"}.contains(it.key()));
    const auto kind = n.value("kind", std::string("normal"));
    need(kind == "normal" || kind == "theoretical_exact" || kind == "reference" || kind == "not_to_scale");
    std::string out;
    if (n.contains("count")) {need(n.at("count").is_number_unsigned() && n.at("count").get<std::uint64_t>() >= 2 && n.at("count").get<std::uint64_t>() <= 999);out += std::to_string(n.at("count").get<std::uint64_t>()) + "× ";}
    if (n.contains("prefix")) {
        // Diameter/radius/sphere per ISO 129-1; the square symbol is gdt.shx "o".
        static const std::map<std::string, std::string> prefixes = {{"diameter", "%%c"}, {"radius", "R"}, {"spherical_diameter", "S%%c"},
                                                                    {"spherical_radius", "SR"}, {"square", "{\\Fgdt;o}"}, {"thickness", "t="}};
        const auto prefix = text(n, "prefix");need(prefixes.contains(prefix));
        // Diameter and radius dimensions already render Ø/R inside "<>"; only the sphere S is added.
        if (dimensionKind == "diameter") {
            need(prefix == "diameter" || prefix == "spherical_diameter", "VALIDATION_FAILED", "Diameter dimensions take only a diameter or spherical diameter prefix");
            if (prefix == "spherical_diameter") out += "S";
        } else if (dimensionKind == "radius") {
            need(prefix == "radius" || prefix == "spherical_radius", "VALIDATION_FAILED", "Radius dimensions take only a radius or spherical radius prefix");
            if (prefix == "spherical_radius") out += "S";
        } else out += prefixes.at(prefix);
    }
    out += "<>";
    if (n.contains("fit")) {
        // ISO 286 tolerance class: hole (upper case) or shaft (lower case) letters + IT grade, or a fit hole/shaft.
        need(std::regex_match(text(n, "fit"), std::regex("([A-Z]{1,2}(01|[0-9]|1[0-8])(/[a-z]{1,2}(01|[0-9]|1[0-8]))?)|([a-z]{1,2}(01|[0-9]|1[0-8]))")));
        out += text(n, "fit");
        if (n.contains("fitDeviations")) {
            const auto &v = n.at("fitDeviations");need(v.is_object() && v.size() == 2);
            need(written_value(v, "upper", true) >= written_value(v, "lower", true));
            out += "(\\S" + written_text(v, "upper", separator, true) + "^" + written_text(v, "lower", separator, true) + ";)";
        }
    } else need(!n.contains("fitDeviations"));
    if (n.contains("singleLimit")) {const auto limit = text(n, "singleLimit");need(limit == "min" || limit == "max");out += " " + limit;}
    if (n.contains("sizeModifiers")) {
        // ISO 14405-1 specification modifiers; E is the circled envelope requirement.
        static const std::set<std::string> codes = {"E","LP","LS","GG","GX","GN","GC","CC","CA","CV","SX","SN","SA","SM","SD","SR","SQ","ACS","SCS","CT"};
        need(n.at("sizeModifiers").is_array() && n.at("sizeModifiers").size() <= 4);
        for (const auto &code : n.at("sizeModifiers")) {need(code.is_string() && codes.contains(code.get<std::string>()));out += code == "E" ? " Ⓔ" :" " + code.get<std::string>();}
    }
    if (kind == "reference") out = "(" + out + ")";
    if (kind == "not_to_scale") out = "\\L" + out + "\\l";
    return out == "<>" ? std::string() : out;
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
        cad(d->setDimalt(false));cad(d->setDimrnd(0));
        cad(d->setDimaunit(0));cad(d->setDimadec(static_cast<int>(precision)));
        const auto notation=p.value("notation",json::object());
        cad(d->setDimensionText(wide(dimension_override(notation,d->dimdsep(),text(p,"kind"))).c_str()));
        if(notation.value("kind",std::string("normal"))=="theoretical_exact")cad(d->setDimgap(-h*0.4));
        const auto suppress=notation.value("suppress",std::string("none"));need(suppress=="none"||suppress=="first"||suppress=="second");
        cad(d->setDimsd1(suppress=="first"));cad(d->setDimse1(suppress=="first"));cad(d->setDimsd2(suppress=="second"));cad(d->setDimse2(suppress=="second"));
        const bool limits=notation.value("limits",false);need(!limits||p.contains("tolerance"),"VALIDATION_FAILED","Limit dimensions need explicit deviations");
        cad(d->setDimtol(p.contains("tolerance")&&!limits));cad(d->setDimlim(limits));
        // Preserve requested display precision and trailing zeros independently
        // of tolerance values. Deviations may state their own precision.
        const auto tolerancePrecision=p.contains("tolerancePrecision")?number(p,"tolerancePrecision"):precision;need(tolerancePrecision<=8);
        cad(d->setDimtdec(static_cast<int>(tolerancePrecision)));cad(d->setDimzin(0));cad(d->setDimtzin(0));
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
    const auto kind=text(p,"kind");auto start=point(p,"start"),end=point(p,"end");
    const double pi=3.141592653589793,measured=a.at("measurement").get<double>();
    std::vector<double> candidates;double valueTolerance=t;
    if(kind=="linear")candidates={std::abs((end.x-start.x)*std::cos(annotation_number(p,"rotation"))+(end.y-start.y)*std::sin(annotation_number(p,"rotation")))};
    else if(kind=="aligned"||kind=="diameter"||kind=="radius")candidates={start.distanceTo(end)};
    else if(kind=="ordinate"){auto origin=p.contains("origin")?point(p,"origin"):AcGePoint3d::kOrigin;candidates={std::abs(text(p,"axis")=="x"?start.x-origin.x:start.y-origin.y)};}
    else if(kind=="angular"){const double theta=(end-start).angleTo(point(p,"end2")-point(p,"start2"));candidates={theta,pi-theta};valueTolerance=1e-9;}
    else{auto center=point(p,"center");const double theta=(start-center).angleTo(end-center);
        if(kind=="angular3"){candidates={theta,2*pi-theta};valueTolerance=1e-9;}
        else{const double r=center.distanceTo(start);candidates={r*theta,r*(2*pi-theta)};}}
    bool value=false;for(double c:candidates)value|=std::abs(measured-c)<=valueTolerance;
    const bool angular=kind=="angular"||kind=="angular3";
    if(angular&&std::abs(a.at("displayValue").get<double>()-measured*180/pi)>1e-7)return false;
    if(!angular&&std::abs(a.at("displayValue").get<double>()-measured)>t)return false;
    for(const auto &field:{"start2","end2","center","origin"})
        if(p.contains(field)&&a.contains(field)&&!annotation_close(a.at(field),p.at(field),t))return false;
    // AutoCAD normalises dimension-line points: linear ones along the line, arc
    // points along their arc. Only the arc radius around a known center is kept.
    if(p.contains("center")&&a.contains("linePoint")){
        auto center=point(p,"center"),requested=point(p,"linePoint"),actual=point(a,"linePoint");
        if(std::abs(center.distanceTo(actual)-center.distanceTo(requested))>t)return false;
    }
    const auto notation=p.value("notation",json::object());
    const auto separator=a.at("decimalSeparator").get<std::string>();
    if(a.at("dimensionText")!=dimension_override(notation,static_cast<wchar_t>(separator.empty()?'.':separator[0]),kind)||
       a.at("basic")!=(notation.value("kind",std::string("normal"))=="theoretical_exact")||a.at("limits")!=notation.value("limits",false)||a.at("trailingZeros")!="kept"||
       (p.contains("tolerancePrecision")&&a.at("tolerancePrecision")!=p.at("tolerancePrecision"))||
       a.at("suppressed")!=(notation.value("suppress",std::string("none"))=="none"?json(nullptr):notation.at("suppress")))return false;
    return value && a.at("dimensionKind")==p.at("kind") && annotation_close(a.at("start"),p.at("start"),t) && annotation_close(a.at("end"),p.at("end"),t) &&
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
