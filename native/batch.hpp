json run_batch(AcDbDatabase *db,const json &p){
    auto &s=state(db);const auto initial=s.revision;need(initial==number(p,"expectedRevision"),"STALE_REVISION");need(p.contains("steps")&&p.at("steps").is_array()&&!p.at("steps").empty()&&p.at("steps").size()<=24);
    std::vector<std::pair<std::string,json>> steps;
    for(const auto &step:p.at("steps")){
        need(step.is_object());auto method=text(step,"tool");need(std::set<std::string>{"acad_create_line","acad_create_circle","acad_create_box","acad_create_polyline"}.contains(method),"SECURITY_DENIED","Batch step is outside the fixed create allowlist");json args;
        for(const auto key:{"instanceId","documentId","documentEpoch","expectedRevision","operationId","coordinateSystem","lengthUnit"})args[key]=p.at(key);
        for(auto it=step.begin();it!=step.end();++it){if(it.key()=="tool")continue;need(!args.contains(it.key()),"VALIDATION_FAILED","Batch steps cannot override shared identity or units");args[it.key()]=it.value();}
        if(method=="acad_create_circle"){need(!step.contains("normal"));args["normal"]=json::array({0,0,1});}validate(method,args);steps.push_back({method,std::move(args)});
    }
    auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["revision"]=initial+1;result["error"]=nullptr;result["created"]=json::array();result["modified"]=json::array();result["erased"]=json::array();result["stepCount"]=steps.size();
    std::vector<std::pair<AcDbObjectId,json>> expected;auto outer=std::make_unique<Transaction>(db);
    try{
        std::size_t bytes=0;
        for(auto &[method,args]:steps){check_cancel();args["expectedRevision"]=s.revision;auto step=mutate(db,method,args);need(step.value("verified",false)&&step.value("status",std::string())=="succeeded","EXECUTION_FAILED","A batch step failed; the entire batch was rolled back");
            for(const auto &er:step.at("created"))result["created"].push_back(er);
            for(const auto &value:step.at("observedGeometry").at("items")){bytes+=value.dump().size();need(bytes<300000,"DOC_BUSY","Batch geometry response budget reached");expected.push_back({object_id(db,value.at("handle").get<std::string>()),value});}
        }
        check_cancel();s.writing=true;outer->commit();outer.reset();s.revision=initial+1;s.writing=false;cursors.clear();
    }catch(...){s.writing=true;outer.reset();if(!rollback_uncertain)s.revision=initial;s.writing=false;cursors.clear();throw;}
    try{Transaction read(db);json values=json::array();double f=output_factor(db,p);for(const auto &[id,wanted]:expected){auto actual=geometry(read.get<AcDbEntity>(id),f);need(same_geometry(actual,wanted),"VERIFICATION_FAILED");values.push_back(actual);}read.commit();result["verified"]=true;result["observedGeometry"]={{"items",values},{"lengthUnit",p.at("lengthUnit")},{"coordinateSystem","WCS"}};}
    catch(...){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Committed batch could not be verified"},{"retryable",false}};}
    return result;
}
