struct PinnedDwg {
    Handles handles;std::filesystem::path path;
    explicit PinnedDwg(const std::filesystem::path &file){
        need(file.is_absolute(),"OUTPUT_PATH_DENIED","Xref source must be an absolute staged path");path=std::filesystem::weakly_canonical(file).make_preferred();const auto root=std::filesystem::weakly_canonical(input_root).make_preferred();
        need(_wcsicmp(path.parent_path().c_str(),root.c_str())==0&&_wcsicmp(path.extension().c_str(),L".dwg")==0,"OUTPUT_PATH_DENIED","Xref must remain inside the private staged DWG root");pin_directories(input_root,handles);
        auto h=CreateFileW(file.c_str(),GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,nullptr);need(h!=INVALID_HANDLE_VALUE,"OUTPUT_PATH_DENIED","Staged DWG is unavailable");handles.values.push_back(h);FILE_ATTRIBUTE_TAG_INFO info{};LARGE_INTEGER bytes{};
        need(GetFileInformationByHandleEx(h,FileAttributeTagInfo,&info,sizeof(info))&&!(info.FileAttributes&(FILE_ATTRIBUTE_DIRECTORY|FILE_ATTRIBUTE_REPARSE_POINT))&&GetFileSizeEx(h,&bytes)&&bytes.QuadPart>0&&bytes.QuadPart<=64*1024*1024,"OUTPUT_PATH_DENIED","Staged input must be a regular DWG within 64 MiB");
    }
};
void preflight_xref(const std::filesystem::path &file){
    AcDbDatabase input(false,true);cad(input.readDwgFile(file.c_str(),AcDbDatabase::kForReadAndAllShare,false));cad(input.closeInput(true));Transaction tx(&input);
    auto named=tx.get<AcDbDictionary>(input.namedObjectsDictionaryId());
    for(const auto key:{L"ACAD_IMAGE_DICT",L"ACAD_PDFDEFINITIONS",L"ACAD_DWFDEFINITIONS",L"ACAD_DGNDEFINITIONS",L"ACAD_DATALINK"}){
        AcDbObjectId id;if(named->getAt(key,id)==Acad::eOk)need(tx.get<AcDbDictionary>(id)->numEntries()==0,"SECURITY_DENIED","External image/underlay/data-link dependencies are not accepted");
    }
    if(!input.dataLinkDictionaryId().isNull())need(tx.get<AcDbDictionary>(input.dataLinkDictionaryId())->numEntries()==0,"SECURITY_DENIED","Data-link dependencies are not accepted");
    auto styles=tx.get<AcDbTextStyleTable>(input.textStyleTableId());AcDbTextStyleTableIterator *styleRaw=nullptr;cad(styles->newIterator(styleRaw));std::unique_ptr<AcDbTextStyleTableIterator> styleIt(styleRaw);std::size_t count=0;
    for(;!styleIt->done();styleIt->step()){need(++count<=1000,"DOC_BUSY","Input style limit reached");AcDbObjectId id;cad(styleIt->getRecordId(id));auto style=tx.get<AcDbTextStyleTableRecord>(id);AcString font,big;cad(style->fileName(font));cad(style->bigFontFileName(big));for(const auto value:{utf8(font.kACharPtr()),utf8(big.kACharPtr())})need(value.find_first_of("/\\:")==std::string::npos,"SECURITY_DENIED","Input font paths are not accepted");}
    auto table=tx.get<AcDbBlockTable>(input.blockTableId());AcDbBlockTableIterator *raw=nullptr;cad(table->newIterator(raw));std::unique_ptr<AcDbBlockTableIterator> it(raw);count=0;
    for(;!it->done();it->step()){
        AcDbObjectId id;cad(it->getRecordId(id));auto record=tx.get<AcDbBlockTableRecord>(id);need(!record->isFromExternalReference(),"SECURITY_DENIED","Nested xrefs are not accepted");AcDbBlockTableRecordIterator *entityRaw=nullptr;cad(record->newIterator(entityRaw));std::unique_ptr<AcDbBlockTableRecordIterator> entities(entityRaw);
        for(;!entities->done();entities->step()){need(++count<=10000,"DOC_BUSY","Input entity limit reached");auto e=tx.get<AcDbEntity>(iterator_id(entities.get()));need(type(e)!="UNSUPPORTED"||AcDbSolid::cast(e)||AcDbViewport::cast(e)||AcDbAttributeDefinition::cast(e),"SECURITY_DENIED","Unsupported/custom input entities are not accepted");need(!e->hasFields(),"SECURITY_DENIED","Input fields are not accepted");}
    }
    tx.commit();
}
json list_xrefs(AcDbDatabase *db){
    Transaction tx(db);auto table=tx.get<AcDbBlockTable>(db->blockTableId());AcDbBlockTableIterator *raw=nullptr;cad(table->newIterator(raw));std::unique_ptr<AcDbBlockTableIterator> it(raw);json values=json::array();std::size_t scanned=0;
    for(;!it->done();it->step()){need(++scanned<=10000&&values.size()<1000,"DOC_BUSY","Xref listing limit reached");AcDbObjectId id;cad(it->getRecordId(id));auto record=tx.get<AcDbBlockTableRecord>(id);if(!record->isFromExternalReference())continue;AcString name,path;cad(record->getName(name));cad(record->pathName(path));values.push_back({{"name",utf8(name.kACharPtr())},{"basename",utf8(std::filesystem::path(path.kACharPtr()).filename().c_str())},{"overlay",record->isFromOverlayReference()},{"unloaded",record->isUnloaded()}});}
    tx.commit();auto result=identity(db);result["xrefs"]=values;result["revision"]=state(db).revision;return result;
}
json edit_xrefs(AcDbDatabase *db,const std::string &method,const json &p){
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION");auto name=text(p,"name");need(name.size()<=512&&name.find_first_of("<>/\\\":;?*|=,")==std::string::npos&&std::none_of(name.begin(),name.end(),[](unsigned char c){return c<32;}));
    const bool attach=method=="acad_attach_xref";auto mode=attach?std::string("attach"):text(p,"mode");need(mode=="attach"||mode=="reload"||mode=="unload"||mode=="bind"||mode=="detach");std::unique_ptr<PinnedDwg> input;
    Transaction tx(db);auto table=tx.get<AcDbBlockTable>(db->blockTableId());AcDbObjectId recordId;std::vector<AcDbBlockReference*> references;
    if(attach){
        need(!table->has(wide(name).c_str()),"VALIDATION_FAILED","Block/xref name already exists");need(text(p,"inputRootId")=="session-input","OUTPUT_PATH_DENIED");auto filename=text(p,"relativePath");
        need(filename.size()<=255&&filename.find_first_of("/\\:*?\"<>|")==std::string::npos&&filename.back()!='.'&&filename.back()!=' '&&std::none_of(filename.begin(),filename.end(),[](unsigned char c){return c<32;}),"OUTPUT_PATH_DENIED");input=std::make_unique<PinnedDwg>(input_root/wide(filename));preflight_xref(input->path);
        if(p.contains("overlay"))need(p.at("overlay").is_boolean());
    }else{
        cad(table->getAt(wide(name).c_str(),recordId));auto record=tx.get<AcDbBlockTableRecord>(recordId);need(record->isFromExternalReference(),"VALIDATION_FAILED","Named block is not an xref");
        need(p.contains("targets")&&p.at("targets").is_array()&&!p.at("targets").empty()&&p.at("targets").size()<=100);std::set<AcDbObjectId> actual,selected;AcDbObjectIdArray ids;cad(record->getBlockReferenceIds(ids,false,true));need(ids.length()<=100,"DOC_BUSY","Xref reference limit reached");for(int i=0;i<ids.length();++i)actual.insert(ids[i]);
        for(const auto &er:p.at("targets")){need(er.is_object()&&er.size()==3&&text(er,"documentId")==s.id&&number(er,"documentEpoch")==s.epoch);auto e=tx.get<AcDbBlockReference>(object_id(db,text(er,"handle")),AcDb::kForWrite);writable_entity(db,e);need(e->blockTableRecord()==recordId&&selected.insert(e->objectId()).second);references.push_back(e);}
        need(actual==selected,"VALIDATION_FAILED","All xref references must be explicitly selected direct modelspace entities");
        if(mode=="reload"||mode=="bind"){AcString path;cad(record->pathName(path));input=std::make_unique<PinnedDwg>(std::filesystem::path(path.kACharPtr()));preflight_xref(input->path);}
    }
    auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["error"]=nullptr;result["created"]=json::array();result["modified"]=json::array();result["erased"]=json::array();std::vector<AcDbObjectId> entityIds;std::vector<AcDbObjectId> erasedIds;s.writing=true;
    try{
        check_cancel();
        if(attach){
            cad(p.value("overlay",true)?acdbOverlayXref(db,input->path.c_str(),wide(name).c_str(),recordId):acdbAttachXref(db,input->path.c_str(),wide(name).c_str(),recordId));
            cad(tx.get<AcDbBlockTableRecord>(recordId,AcDb::kForWrite)->setPathName(input->path.c_str()));
            auto e=std::make_unique<AcDbBlockReference>(point(p,"position",input_factor(db,p)),recordId);double scale=annotation_number(p,"scale",1);need(scale>0);cad(e->setScaleFactors(AcGeScale3d(scale)));cad(e->setRotation(annotation_number(p,"rotation",0)));e->setDatabaseDefaults(db);if(p.contains("layer"))cad(e->setLayer(wide(text(p,"layer")).c_str()));auto layer=tx.get<AcDbLayerTableRecord>(e->layerId());need(!layer->isLocked(),"SECURITY_DENIED","Layer is locked");
            auto model=tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db),AcDb::kForWrite);AcDbObjectId id;cad(model->appendAcDbEntity(id,e.get()));auto raw=e.release();cad(tx.manager->addNewlyCreatedDBRObject(raw,true));result["created"].push_back(ref(db,raw));entityIds.push_back(id);
        }else{
            AcDbObjectIdArray ids;ids.append(recordId);
            if(mode=="detach"){for(auto e:references){result["erased"].push_back(ref(db,e));erasedIds.push_back(e->objectId());cad(e->erase());}cad(acdbDetachXref(db,recordId));}
            else{cad(mode=="unload"?acdbUnloadXrefs(db,ids,true):mode=="reload"?acdbReloadXrefs(db,ids,true):acdbBindXrefs(db,ids,false,false,true));for(auto e:references){entityIds.push_back(e->objectId());result["modified"].push_back(ref(db,e));}}
        }
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing=false;s.revision++;cursors.clear();
    }catch(...){s.writing=false;throw;}
    result["revision"]=s.revision;
    try{
        Transaction read(db);auto blocks=read.get<AcDbBlockTable>(db->blockTableId());
        if(mode=="detach")need(!blocks->has(wide(name).c_str()),"VERIFICATION_FAILED");
        else{AcDbObjectId current;cad(blocks->getAt(wide(name).c_str(),current));auto record=read.get<AcDbBlockTableRecord>(current);need(mode=="bind"?!record->isFromExternalReference():record->isFromExternalReference(),"VERIFICATION_FAILED");if(mode=="unload"||mode=="reload")need(record->isUnloaded()==(mode=="unload"),"VERIFICATION_FAILED");}
        json values=json::array();for(auto id:entityIds)values.push_back(geometry(read.get<AcDbEntity>(id),attach?output_factor(db,p):1));for(auto id:erasedIds){AcDbEntity *e=nullptr;cad(read.manager->getObject(e,id,AcDb::kForRead,true));need(e&&e->isErased(),"VERIFICATION_FAILED");}read.commit();result["verified"]=true;result["observedGeometry"]={{"items",values},{"lengthUnit",attach?p.at("lengthUnit"):json("drawing_unit")},{"coordinateSystem","WCS"}};
    }catch(...){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Committed xref operation could not be verified"},{"retryable",false}};}
    return result;
}

json xref_snapshot(AcDbDatabase *db){
    Transaction tx(db);auto table=tx.get<AcDbBlockTable>(db->blockTableId());AcDbBlockTableIterator *raw=nullptr;cad(table->newIterator(raw));std::unique_ptr<AcDbBlockTableIterator> it(raw);json values=json::object();std::size_t scanned=0,bytes=0;
    for(;!it->done();it->step()){need(++scanned<=10000&&values.size()<1000,"DOC_BUSY","Xref snapshot limit reached");AcDbObjectId id;cad(it->getRecordId(id));auto record=tx.get<AcDbBlockTableRecord>(id);if(!record->isFromExternalReference())continue;AcString name,path;cad(record->getName(name));cad(record->pathName(path));auto value=json{{"path",utf8(path.kACharPtr())},{"overlay",record->isFromOverlayReference()},{"unloaded",record->isUnloaded()}};bytes+=value.dump().size();need(bytes<200000,"DOC_BUSY","Xref snapshot budget reached");values[utf8(name.kACharPtr())]=value;}
    tx.commit();return values;
}
