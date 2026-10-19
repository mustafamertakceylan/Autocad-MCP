json detailing_geometry(AcDbEntity *e,double f){
    if(auto frame=AcDbFcf::cast(e)){AcString value;cad(frame->text(value));return {{"text",utf8(value.kACharPtr())},{"position",xyz(frame->location(),f)},{"textHeight",frame->dimtxt()*f},{"dimensionScale",frame->dimscale()},{"style",symbol_name(frame->dimensionStyle())}};}
    if(auto hatch=AcDbHatch::cast(e)){
        need(hatch->numLoops()<=33,"DOC_BUSY","Hatch query loop limit reached");double area=0;cad(hatch->getArea(area));
        return {{"area",area*f*f},{"pattern",utf8(hatch->patternName())},{"patternScale",hatch->patternScale()*f},{"patternAngle",hatch->patternAngle()},{"loopCount",hatch->numLoops()}};
    }
    if(auto region=AcDbRegion::cast(e)){
        double area=0,length=0;cad(region->getArea(area));cad(region->getPerimeter(length));return {{"area",area*f*f},{"length",length*f}};
    }
    if(auto table=AcDbTable::cast(e)){
        const auto n=table->numRows(),m=table->numColumns();need(n<=100&&m<=10,"DOC_BUSY","Table query cell limit reached");
        json rows=json::array(),widths=json::array(),heights=json::array();std::size_t bytes=0;
        for(unsigned int col=0;col<m;++col)widths.push_back(table->columnWidth(col)*f);
        for(unsigned int row=0;row<n;++row){json values=json::array();heights.push_back(table->rowHeight(row)*f);
            for(unsigned int col=0;col<m;++col){auto value=utf8(table->textStringConst(row,col));bytes+=value.size();need(bytes<150000,"DOC_BUSY","Table text query budget reached");values.push_back(value);}rows.push_back(values);}
        return {{"position",xyz(table->position(),f)},{"rows",rows},{"columnWidths",widths},{"rowHeights",heights}};
    }
    return json::object();
}
json get_bom(AcDbDatabase *db,const json &p){
    auto &s=state(db);need(p.contains("targets")&&p.at("targets").is_array()&&!p.at("targets").empty()&&p.at("targets").size()<=100);
    need(p.contains("groupBy")&&p.at("groupBy").is_array()&&!p.at("groupBy").empty()&&p.at("groupBy").size()<=8);
    std::set<std::string> keys,handles;for(const auto &key:p.at("groupBy"))need(key.is_string()&&std::regex_match(key.get<std::string>(),std::regex("[A-Z][A-Z0-9_]{0,31}"))&&keys.insert(key.get<std::string>()).second);
    std::map<std::string,json> grouped;Transaction tx(db);
    for(const auto &er:p.at("targets")){
        need(er.is_object()&&er.size()==3&&text(er,"documentId")==s.id&&number(er,"documentEpoch")==s.epoch);
        auto e=tx.get<AcDbBlockReference>(object_id(db,text(er,"handle")));need(!AcDbTable::cast(e),"UNSUPPORTED_ON_PLATFORM");modelspace(db,e);local_block(tx,e->blockTableRecord());need(handles.insert(handle(e)).second);
        auto g=block_geometry(e,1);json values=json::object();for(const auto &key:keys){need(g.at("attributes").contains(key),"TARGET_NOT_FOUND","Selected block lacks a required BOM attribute");values[key]=g.at("attributes").at(key);}
        json key={{"blockName",g.at("blockName")},{"attributes",values}};auto serialized=key.dump();if(!grouped.contains(serialized)){key["quantity"]=0;grouped[serialized]=key;}
        auto &row=grouped.at(serialized);row["quantity"]=row.at("quantity").get<int>()+1;
    }
    tx.commit();auto result=identity(db);result["revision"]=s.revision;result["rows"]=json::array();for(const auto &[key,row]:grouped)result["rows"].push_back(row);
    result["selectedCount"]=handles.size();need(result.dump().size()<200000,"DOC_BUSY","BOM output budget reached");return result;
}
json create_detailing(AcDbDatabase *db,const std::string &method,const json &p){
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION","Drawing changed before detailing");const double f=input_factor(db,p),out=output_factor(db,p);Transaction tx(db);
    std::unique_ptr<AcDbEntity> created;double expectedArea=-1;json expectedRows;
    if(method=="acad_section_solid"){
        auto source=selected_solid(db,tx,p.at("entityRef"));auto normal=point(p,"normal")-AcGePoint3d::kOrigin;need(normal.length()>0);auto origin=point(p,"origin",f);
        AcDbRegion *raw=nullptr;const auto status=source->getSection(AcGePlane(origin,normal.normal()),raw);created.reset(raw);cad(status);need(raw&&!raw->isNull(),"VALIDATION_FAILED","Section plane does not produce a region");cad(raw->getArea(expectedArea));need(expectedArea>0);
    }else if(method=="acad_create_hatch"){
        need(p.contains("targets")&&p.at("targets").is_array()&&!p.at("targets").empty()&&p.at("targets").size()<=33);auto pattern=text(p,"pattern");need(pattern=="SOLID"||pattern=="ANSI31");
        auto hatch=std::make_unique<AcDbHatch>();hatch->setDatabaseDefaults(db);cad(hatch->setNormal(AcGeVector3d::kZAxis));cad(hatch->setElevation(0));cad(hatch->setAssociative(false));
        cad(hatch->setPattern(AcDbHatch::kPreDefined,wide(pattern).c_str()));double scale=annotation_number(p,"scale",1)*f;need(scale>0&&std::isfinite(scale));cad(hatch->setPatternScale(scale));cad(hatch->setPatternAngle(annotation_number(p,"angle",0)));
        std::set<AcDbObjectId> seen;expectedArea=0;
        for(const auto &er:p.at("targets")){
            auto curve=planar_curve(db,tx,er);need(seen.insert(curve->objectId()).second);auto circle=AcDbCircle::cast(curve);auto poly=AcDbPolyline::cast(curve);
            need(circle||(poly&&poly->isClosed()),"UNSUPPORTED_ON_PLATFORM","Hatch loops must be closed circles or polylines");double area=0;cad(curve->getArea(area));expectedArea+=seen.size()==1?area:-area;
            AcDbObjectIdArray ids;ids.append(curve->objectId());cad(hatch->appendLoop(seen.size()==1?AcDbHatch::kExternal:AcDbHatch::kDefault,ids));
        }
        need(expectedArea>0,"VALIDATION_FAILED","Hatch holes must leave positive area");cad(hatch->evaluateHatch());double actual=0;cad(hatch->getArea(actual));
        need(std::abs(actual-expectedArea)<=std::max(1.,expectedArea)*1e-7,"VALIDATION_FAILED","Hatch loops overlap or nesting differs from outer-minus-holes");created=std::move(hatch);
    }else if(method=="acad_create_feature_control_frame"){
        const std::map<std::string,char> symbols={{"position",'j'},{"parallelism",'f'},{"perpendicularity",'b'},{"angularity",'a'},{"flatness",'c'},{"roundness",'e'},{"cylindricity",'g'},{"straightness",'u'},{"surface_profile",'d'},{"line_profile",'k'},{"circular_runout",'h'},{"total_runout",'t'}};
        auto characteristic=text(p,"characteristic");need(symbols.contains(characteristic));double tolerance=annotation_number(p,"tolerance"),height=annotation_number(p,"textHeight")*f;need(tolerance>0&&height>0&&std::isfinite(height));
        auto position=point(p,"position",f);need(position.z==0);if(p.contains("diameterZone"))need(p.at("diameterZone").is_boolean());auto condition=p.value("materialCondition",std::string("none"));need(condition=="none"||condition=="MMC"||condition=="LMC");
        auto symbol=[](char c){return std::string("{\\Fgdt;")+c+"}";};std::string value=symbol(symbols.at(characteristic))+"%%v";
        if(p.value("diameterZone",false))value+=symbol('n');value+=json(tolerance).dump();if(condition!="none")value+=symbol(condition=="MMC"?'m':'l');value+="%%v";
        auto datums=p.value("datums",json::array());need(datums.is_array()&&datums.size()<=3);for(const auto &datum:datums){need(datum.is_string()&&std::regex_match(datum.get<std::string>(),std::regex("[A-Z]{1,3}")));value+="%%v"+datum.get<std::string>();}
        auto frame=std::make_unique<AcDbFcf>(wide(value).c_str(),position,AcGeVector3d::kZAxis,AcGeVector3d::kXAxis);frame->setDimensionStyle(db->dimstyle());cad(frame->setDimscale(1));cad(frame->setDimtxt(height));created=std::move(frame);
    }else{
        need(method=="acad_create_table"&&p.contains("rows")&&p.at("rows").is_array()&&!p.at("rows").empty()&&p.at("rows").size()<=100);
        need(p.contains("columnWidths")&&p.at("columnWidths").is_array()&&!p.at("columnWidths").empty()&&p.at("columnWidths").size()<=10);
        auto table=std::make_unique<AcDbTable>();table->setDatabaseDefaults(db);table->setTableStyle(db->tablestyle());const auto n=static_cast<int>(p.at("rows").size()),m=static_cast<int>(p.at("columnWidths").size());cad(table->setSize(n,m));
        int minRow,maxRow,minCol,maxCol;for(int row=0;row<n;++row)for(int col=0;col<m;++col)if(table->isMergedCell(row,col,&minRow,&maxRow,&minCol,&maxCol))cad(table->unmergeCells(minRow,maxRow,minCol,maxCol));
        auto position=point(p,"position",f);need(position.z==0);cad(table->setPosition(position));double height=annotation_number(p,"textHeight")*f,rowHeight=annotation_number(p,"rowHeight")*f;need(height>0&&rowHeight>0&&std::isfinite(height)&&std::isfinite(rowHeight));
        for(int col=0;col<m;++col){const auto &value=p.at("columnWidths")[col];need(value.is_number());double width=value.get<double>()*f;need(width>0&&std::isfinite(width));cad(table->setColumnWidth(col,width));}
        std::size_t bytes=0;
        for(int row=0;row<n;++row){const auto &values=p.at("rows")[row];need(values.is_array()&&values.size()==m);for(int col=0;col<m;++col){auto value=attribute_string(values[col]);bytes+=value.size();need(bytes<150000,"DOC_BUSY","Table input budget reached");
            need(value.find('\\')==std::string::npos&&value.find('{')==std::string::npos&&value.find('}')==std::string::npos,"VALIDATION_FAILED","Table formatting codes are not accepted");
            cad(table->setTextString(row,col,wide(value).c_str()));cad(table->setTextHeight(row,col,height));}
            cad(table->setRowHeight(row,rowHeight));}
        cad(table->generateLayout());expectedRows=p.at("rows");created=std::move(table);
    }
    created->setDatabaseDefaults(db);if(p.contains("layer"))cad(created->setLayer(wide(text(p,"layer")).c_str()));else cad(created->setLayer(db->clayer()));
    AcDbLayerTableRecord *layer=nullptr;cad(acdbOpenObject(layer,created->layerId(),AcDb::kForRead));bool locked=layer->isLocked();layer->close();need(!locked,"SECURITY_DENIED","Layer is locked");
    auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["error"]=nullptr;result["created"]=json::array();result["modified"]=json::array();result["erased"]=json::array();AcDbObjectId id;json expected;
    auto model=tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db),AcDb::kForWrite);s.writing=true;
    try{
        check_cancel();cad(model->appendAcDbEntity(id,created.get()));auto e=created.release();cad(tx.manager->addNewlyCreatedDBRObject(e,true));
        if(auto table=AcDbTable::cast(e)){
            cad(table->recomputeTableBlock(true));
            for(unsigned int col=0;col<table->numColumns();++col){double width=p.at("columnWidths")[col].get<double>()*f;need(std::abs(table->columnWidth(col)-width)<=std::max(1.,width)*1e-7,"VALIDATION_FAILED","Native table expanded a column; provide wider cells");}
            for(unsigned int row=0;row<table->numRows();++row){double height=annotation_number(p,"rowHeight")*f;need(std::abs(table->rowHeight(row)-height)<=std::max(1.,height)*1e-7,"VALIDATION_FAILED","Native table expanded a row; provide a larger row height");
                for(unsigned int col=0;col<table->numColumns();++col)need(std::abs(table->textHeight(row,col)-annotation_number(p,"textHeight")*f)<=std::max(1.,annotation_number(p,"textHeight")*f)*1e-7,"VALIDATION_FAILED","Native table text height differs");}
        }
        if(auto frame=AcDbFcf::cast(e)){
            AcDbDimStyleTableRecord settings;cad(settings.copyFrom(tx.get<AcDbDimStyleTableRecord>(db->dimstyle())));
            cad(settings.setDimscale(1));cad(settings.setDimtxt(annotation_number(p,"textHeight")*f));
            frame->setDimensionStyle(db->dimstyle());cad(frame->setDimstyleData(&settings));
        }
        expected=geometry(e,out);
        if(!expectedRows.is_null())need(expected.at("rows")==expectedRows,"VERIFICATION_FAILED","Table cells differ before commit");
        if(expectedArea>=0)need(std::abs(expected.at("area").get<double>()-expectedArea*out*out)<=std::max(1.,expectedArea*out*out)*1e-7,"VERIFICATION_FAILED");
        result["created"].push_back(ref(db,e));test_fault("abort_before_commit");check_cancel();tx.commit();s.writing=false;s.revision++;cursors.clear();
    }catch(...){s.writing=false;throw;}
    result["revision"]=s.revision;
    try{Transaction read(db);auto actual=geometry(read.get<AcDbEntity>(id),out);read.commit();need(same_geometry(expected,actual),"VERIFICATION_FAILED");result["verified"]=true;result["observedGeometry"]={{"items",json::array({actual})},{"lengthUnit",p.at("lengthUnit")},{"coordinateSystem","WCS"}};}
    catch(...){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Committed detailing could not be verified"},{"retryable",false}};}
    return result;
}
