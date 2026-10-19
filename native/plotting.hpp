bool pdf_device(const std::string &name){return name=="DWG To PDF.pc3"||name=="AutoCAD PDF (General Documentation).pc3";}
json plot_devices(AcDbDatabase *db){
    auto validator=acdbHostApplicationServices()->plotSettingsValidator();need(validator!=nullptr,"UNSUPPORTED_ON_PLATFORM","Plot settings API unavailable");
    AcDbPlotSettings settings(false);validator->refreshLists(&settings);AcArray<const ACHAR*> devices;cad(validator->plotDeviceList(devices));need(devices.length()<=1000,"DOC_BUSY","Plot device limit reached");json values=json::array();
    std::vector<std::wstring> deviceNames;for(int i=0;i<devices.length();++i)deviceNames.emplace_back(devices[i]);
    for(const auto &device:deviceNames){auto name=utf8(device.c_str());if(!pdf_device(name))continue;cad(validator->setPlotCfgName(&settings,device.c_str()));validator->refreshLists(&settings);AcArray<const ACHAR*> media;cad(validator->canonicalMediaNameList(&settings,media));need(media.length()<=1000,"DOC_BUSY","Media limit reached");json mediaNames=json::array();for(int k=0;k<media.length();++k)mediaNames.push_back(utf8(media[k]));values.push_back({{"device",name},{"media",mediaNames}});}

    auto result=identity(db);result["devices"]=values;need(result.dump().size()<300000,"DOC_BUSY","Plot metadata budget reached");return result;
}
json layout_data(AcDbDatabase *,Transaction &tx,AcDbObjectId id){
    auto layout=tx.get<AcDbLayout>(id);AcString name,media;cad(layout->getName(name));cad(layout->getCanonicalMediaName(media));const ACHAR *device=nullptr;cad(layout->getPlotCfgName(device));double width=0,height=0;cad(layout->getPlotPaperSize(width,height));
    double marginLeft=0,marginBottom=0,marginRight=0,marginTop=0,originX=0,originY=0;cad(layout->getPlotPaperMargins(marginLeft,marginBottom,marginRight,marginTop));cad(layout->getPlotOrigin(originX,originY));
    json value={{"name",utf8(name.kACharPtr())},{"model",static_cast<bool>(layout->modelType())},{"device",utf8(device)},{"media",utf8(media.kACharPtr())},{"paperSizeMm",json::array({width,height})},{"rotation",static_cast<int>(layout->plotRotation())},{"viewports",json::array()},{"entities",json::array()}};
    value["plotMarginsMm"]=json::array({marginLeft,marginBottom,marginRight,marginTop});value["plotOriginMm"]=json::array({originX,originY});value["plotCentered"]=static_cast<bool>(layout->plotCentered());
    if(layout->modelType())return value;
    auto record=tx.get<AcDbBlockTableRecord>(layout->getBlockTableRecordId());AcDbBlockTableRecordIterator *raw=nullptr;cad(record->newIterator(raw));std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);std::size_t count=0;
    // Inactive/side databases do not reliably populate getViewportArray().
    // The overall paper viewport is the first viewport stored in the layout's
    // block record (created by initialize); active layouts also identify it as1.
    AcDbObjectId paperViewport;std::size_t examined=0;
    for(;!it->done();it->step()){
        need(++examined<=1000,"DOC_BUSY","Layout entity limit reached");
        auto entity=tx.get<AcDbEntity>(iterator_id(it.get()));if(auto vp=AcDbViewport::cast(entity)){
            if(paperViewport.isNull())paperViewport=vp->objectId();
            if(vp->number()==1){paperViewport=vp->objectId();break;}
        }
    }
    it->start();
    for(;!it->done();it->step()){
        need(++count<=1000,"DOC_BUSY","Layout entity limit reached");auto e=tx.get<AcDbEntity>(iterator_id(it.get()));
        if(auto vp=AcDbViewport::cast(e)){
            if(vp->objectId()==paperViewport)continue;
            value["viewports"].push_back({{"paperCenter",xyz(vp->centerPoint())},{"paperSize",json::array({vp->width(),vp->height()})},{"modelTarget",xyz(vp->viewTarget())},{"direction",json::array({vp->viewDirection().x,vp->viewDirection().y,vp->viewDirection().z})},{"viewCenter",json::array({vp->viewCenter().x,vp->viewCenter().y})},{"viewHeight",vp->viewHeight()},{"customScale",vp->customScale()},{"locked",vp->isLocked()}});
        }else if(type(e)!="UNSUPPORTED"){auto g=geometry(e,1);g.erase("handle");value["entities"].push_back(g);}
        else value["entities"].push_back({{"type","UNSUPPORTED"}});
    }
    need(value.dump().size()<200000,"DOC_BUSY","Layout snapshot budget reached");return value;
}
json layout_snapshot(AcDbDatabase *db){
    Transaction tx(db);auto layouts=tx.get<AcDbDictionary>(db->layoutDictionaryId());std::unique_ptr<AcDbDictionaryIterator> it(layouts->newIterator());json values=json::object();std::size_t bytes=0;
    for(;!it->done();it->next()){need(values.size()<1000,"DOC_BUSY","Layout limit reached");auto data=layout_data(db,tx,it->objectId());bytes+=data.dump().size();need(bytes<350000,"DOC_BUSY","Layout metadata budget reached");values[data.at("name").get<std::string>()]=data;}
    tx.commit();return values;
}
json list_layouts(AcDbDatabase *db){auto result=identity(db);result["layouts"]=layout_snapshot(db);result["revision"]=state(db).revision;result["paperLengthUnit"]="mm";result["modelLengthUnit"]="drawing_unit";return result;}
json create_layout(AcDbDatabase *db,const json &p){
    auto layout_api=[](Acad::ErrorStatus status,const char *step){if(status!=Acad::eOk)throw Failure{"EXECUTION_FAILED",std::string("Layout ")+step+" failed (status "+std::to_string(static_cast<int>(status))+")"};};
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION");auto name=text(p,"name");need(name.size()<=512&&name.find_first_of("<>/\\\":;?*|=,")==std::string::npos&&std::none_of(name.begin(),name.end(),[](unsigned char c){return c<32;}));auto manager=acdbHostApplicationServices()->layoutManager();need(manager!=nullptr,"UNSUPPORTED_ON_PLATFORM");need(manager->findLayoutNamed(wide(name).c_str(),db).isNull(),"VALIDATION_FAILED","Layout already exists");auto device=text(p,"device");need(pdf_device(device),"SECURITY_DENIED","Only allowlisted PDF devices are accepted");
    AcDbPlotSettings settings(false);auto validator=acdbHostApplicationServices()->plotSettingsValidator();need(validator!=nullptr,"UNSUPPORTED_ON_PLATFORM");validator->refreshLists(&settings);layout_api(validator->setPlotCfgName(&settings,wide(device).c_str(),wide(text(p,"media")).c_str()),"validator.setPlotCfgName");validator->refreshLists(&settings);
    auto rotation=p.value("rotation",std::string("0"));need(rotation=="0"||rotation=="90");layout_api(validator->setPlotPaperUnits(&settings,AcDbPlotSettings::kMillimeters),"validator.setPlotPaperUnits");layout_api(validator->setPlotRotation(&settings,rotation=="0"?AcDbPlotSettings::k0degrees:AcDbPlotSettings::k90degrees),"validator.setPlotRotation");layout_api(validator->setPlotType(&settings,AcDbPlotSettings::kLayout),"validator.setPlotType");layout_api(validator->setUseStandardScale(&settings,false),"validator.setUseStandardScale");layout_api(validator->setCustomPrintScale(&settings,1,1),"validator.setCustomPrintScale");layout_api(validator->setPlotOrigin(&settings,0,0),"validator.setPlotOrigin");
    // Plot origin is relative to the printable area, while the tool's paper
    // coordinates are absolute millimetres from the lower-left sheet corner.
    double left=0,bottom=0,right=0,top=0;layout_api(settings.getPlotPaperMargins(left,bottom,right,top),"settings.getPlotPaperMargins");
    layout_api(validator->setPlotOrigin(&settings,-left,-bottom),"validator.setAbsolutePaperOrigin");
    need(p.contains("viewport")&&p.at("viewport").is_object()&&p.at("viewport").size()==5);const auto &v=p.at("viewport");
    auto pair=[&](const char *key){const auto &a=v.at(key);need(a.is_array()&&a.size()==2&&a[0].is_number()&&a[1].is_number());double x=a[0].get<double>(),y=a[1].get<double>();need(x>0&&y>0&&std::isfinite(x)&&std::isfinite(y));return AcGePoint2d(x,y);};
    auto center=pair("paperCenter"),size=pair("paperSize");auto target=point(v,"modelCenter",input_factor(db,p));double scale=annotation_number(v,"scale")*drawing_metres(db)*1000;need(scale>0&&std::isfinite(scale));double width=0,height=0;layout_api(settings.getPlotPaperSize(width,height),"settings.getPlotPaperSize");if(rotation=="90")std::swap(width,height);
    need(center.x-size.x/2>=0&&center.y-size.y/2>=0&&center.x+size.x/2<=width&&center.y+size.y/2<=height,"VALIDATION_FAILED","Viewport must fit inside the selected paper");
    const std::map<std::string,AcGeVector3d> directions={{"top",{0,0,1}},{"front",{0,-1,0}},{"right",{1,0,0}},{"isometric",{1,-1,1}}};auto direction=text(v,"direction");need(directions.contains(direction));
    AcString previousName;cad(manager->getActiveLayoutName(previousName,true,db));const std::wstring previous(previousName.kACharPtr());bool switched=false;
    Transaction tx(db);AcDbObjectId layoutId,recordId;json expected;auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["error"]=nullptr;s.writing=true;
    try{
        check_cancel();layout_api(manager->createLayout(wide(name).c_str(),layoutId,recordId,db),"manager.createLayout");auto layout=tx.get<AcDbLayout>(layoutId,AcDb::kForWrite);layout_api(layout->copyFrom(&settings),"layout.copyFrom");layout_api(layout->initialize(),"layout.initialize");
        // Floating viewport boundaries are editing aids, never drawing lines.
        auto layers=tx.get<AcDbLayerTable>(db->layerTableId(),AcDb::kForWrite);AcDbObjectId viewportLayer;
        const ACHAR *viewportLayerName=L"_MCP_VIEWPORT_NONPLOT";
        if(layers->has(viewportLayerName)){
            cad(layers->getAt(viewportLayerName,viewportLayer));auto layer=tx.get<AcDbLayerTableRecord>(viewportLayer);
            need(!layer->isPlottable()&&!layer->isLocked()&&!layer->isFrozen()&&!layer->isOff()&&!layer->isDependent(),"VALIDATION_FAILED","Reserved viewport layer has incompatible properties");
        }else{
            auto layer=std::make_unique<AcDbLayerTableRecord>();cad(layer->setName(viewportLayerName));cad(layer->setIsPlottable(false));
            cad(layers->add(viewportLayer,layer.get()));auto rawLayer=layer.release();cad(tx.manager->addNewlyCreatedDBRObject(rawLayer,true));
        }
        auto vp=std::make_unique<AcDbViewport>();vp->setDatabaseDefaults(db);cad(vp->setLayer(viewportLayer));auto record=tx.get<AcDbBlockTableRecord>(recordId,AcDb::kForWrite);AcDbObjectId vpId;layout_api(record->appendAcDbEntity(vpId,vp.get()),"record.appendAcDbEntity");auto raw=vp.release();layout_api(tx.manager->addNewlyCreatedDBRObject(raw,true),"tx.manager.addNewlyCreatedDBRObject");
        layout_api(raw->setCenterPoint({center.x,center.y,0}),"raw.setCenterPoint");layout_api(raw->setWidth(size.x),"raw.setWidth");layout_api(raw->setHeight(size.y),"raw.setHeight");layout_api(raw->setViewTarget(target),"raw.setViewTarget");layout_api(raw->setViewDirection(directions.at(direction)),"raw.setViewDirection");layout_api(raw->setViewCenter({0,0}),"raw.setViewCenter");layout_api(raw->setViewHeight(size.y/scale),"raw.setViewHeight");layout_api(raw->setCustomScale(scale),"raw.setCustomScale");layout_api(manager->setCurrentLayoutId(layoutId),"activate layout");switched=true;layout_api(raw->setOn(),"raw.setOn");layout_api(raw->setLocked(true),"raw.setLocked");
        layout_api(manager->setCurrentLayout(previous.c_str(),db),"restore layout");switched=false;expected=layout_data(db,tx,layoutId);need(expected.at("viewports").size()==1,"VERIFICATION_FAILED","New layout must contain exactly one model viewport");check_cancel();test_fault("abort_before_commit");tx.commit();s.writing=false;s.revision++;cursors.clear();
    }catch(...){if(switched&&manager->setCurrentLayout(previous.c_str(),db)!=Acad::eOk){s.writing=false;throw Failure{"PARTIAL_APPLY","Layout creation failed and the previous tab could not be restored"};}s.writing=false;throw;}
    result["revision"]=s.revision;
    try{Transaction read(db);auto actual=layout_data(db,read,layoutId);read.commit();if(!same_geometry(actual,expected))throw Failure{"VERIFICATION_FAILED","Created layout differs at "+geometry_difference(expected,actual)};result["verified"]=true;result["createdLayouts"]=json::array({actual});}
    catch(const Failure &e){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message",e.message},{"retryable",false}};}
    return result;
}
struct PlotEngine {
    AcPlPlotEngine *p=nullptr;int level=0;
    ~PlotEngine(){if(!p)return;if(level>=4)p->endGenerateGraphics();if(level>=3)p->endPage();if(level>=2)p->endDocument();if(level>=1)p->endPlot();p->destroy();}
};
json export_pdf(AcDbDatabase *db,const json &p){
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION");need(text(p,"outputRootId")=="test-output"&&p.contains("overwrite")&&p.at("overwrite")==false,"OUTPUT_PATH_DENIED");auto name=text(p,"relativePath");
    need(name.size()<=255&&std::regex_match(name,std::regex("[^\\\\/:*?\"<>|]+[.]pdf",std::regex::icase))&&name.back()!=' '&&std::none_of(name.begin(),name.end(),[](unsigned char c){return c<32;})&&!std::regex_search(name,std::regex("^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])([.]|$)",std::regex::icase)),"OUTPUT_PATH_DENIED");
    Handles pinned;pin_directories(output_root,pinned);auto destination=output_root/wide(name);need(GetFileAttributesW(destination.c_str())==INVALID_FILE_ATTRIBUTES,"FILE_EXISTS");auto manager=acdbHostApplicationServices()->layoutManager();need(manager!=nullptr,"UNSUPPORTED_ON_PLATFORM");auto id=manager->findLayoutNamed(wide(text(p,"layoutName")).c_str(),db);need(!id.isNull(),"TARGET_NOT_FOUND","Layout not found");
    {Transaction read(db);auto layout=read.get<AcDbLayout>(id);need(!layout->modelType(),"VALIDATION_FAILED","PDF tool accepts explicit paper layouts only");const ACHAR *device=nullptr;cad(layout->getPlotCfgName(device));need(pdf_device(utf8(device)),"SECURITY_DENIED","Layout must use an allowlisted PDF device");read.commit();}
    need(acplProcessPlotState()==kNotPlotting,"DOC_BUSY","Another plot is active");AcString oldName;cad(manager->getActiveLayoutName(oldName,true,db));auto originalName=std::wstring(oldName.kACharPtr());auto staging=output_root/(L"staging-"+wide(mcp::random_hex(16)));need(CreateDirectoryW(staging.c_str(),nullptr)!=FALSE,"OUTPUT_PATH_DENIED");auto temporary=staging/L"drawing.pdf";bool published=false,switched=false;json result;
    s.writing=true;
    try{
        check_cancel();cad(manager->setCurrentLayoutId(id));switched=true;
        AcPlPlotInfo info;info.setLayout(id);AcPlPlotInfoValidator validator;validator.setMediaMatchingPolicy(AcPlPlotInfoValidator::kMatchEnabled);cad(validator.validate(info));
        {Transaction read(db);auto layout=read.get<AcDbLayout>(id);AcString requestedMedia,actualMedia;cad(layout->getCanonicalMediaName(requestedMedia));need(info.validatedSettings()!=nullptr,"VERIFICATION_FAILED");cad(info.validatedSettings()->getCanonicalMediaName(actualMedia));need(requestedMedia==actualMedia,"VALIDATION_FAILED","Plot validator changed the requested paper; no PDF published");read.commit();}
        {PlotEngine engine;cad(AcPlPlotFactory::createPublishEngine(engine.p));check_cancel();cad(engine.p->beginPlot(nullptr));engine.level=1;
            cad(engine.p->beginDocument(info,L"Autocad MCP",nullptr,1,true,temporary.c_str()));engine.level=2;AcPlPlotPageInfo page;cad(engine.p->beginPage(page,info,true));engine.level=3;
            check_cancel();cad(engine.p->beginGenerateGraphics());engine.level=4;cad(engine.p->endGenerateGraphics());engine.level=3;cad(engine.p->endPage());engine.level=2;cad(engine.p->endDocument());engine.level=1;cad(engine.p->endPlot());engine.level=0;}
        cad(manager->setCurrentLayout(originalName.c_str(),db));switched=false;
        auto bytes=std::filesystem::file_size(temporary);need(bytes>=100&&bytes<=128*1024*1024,"VERIFICATION_FAILED","PDF size outside the output budget");std::ifstream input(temporary,std::ios::binary);char signature[5]{};input.read(signature,5);need(std::string(signature,5)=="%PDF-","VERIFICATION_FAILED","Plot output is not PDF");input.close();
        result=identity(db);result["operationId"]=text(p,"operationId");result["revision"]=s.revision;result["status"]="succeeded";result["applied"]=true;result["verified"]=true;result["error"]=nullptr;result["output"]={{"outputRootId","test-output"},{"relativePath",name},{"bytes",bytes}};result["verification"]={{"pdfHeader",true},{"layoutRestored",true},{"visualContentVerified",false}};
        check_cancel();if(!MoveFileExW(temporary.c_str(),destination.c_str(),MOVEFILE_WRITE_THROUGH))throw Failure{GetLastError()==ERROR_ALREADY_EXISTS||GetLastError()==ERROR_FILE_EXISTS?"FILE_EXISTS":"OUTPUT_PATH_DENIED","PDF publication failed"};published=true;s.writing=false;
    }catch(...){s.writing=false;if(switched&&manager->setCurrentLayout(originalName.c_str(),db)!=Acad::eOk)throw Failure{"PARTIAL_APPLY","Plot failed and the previous layout could not be restored"};std::error_code ignored;if(!published)std::filesystem::remove(temporary,ignored);std::filesystem::remove(staging,ignored);throw;}
    std::error_code ignored;std::filesystem::remove(staging,ignored);return result;
}
