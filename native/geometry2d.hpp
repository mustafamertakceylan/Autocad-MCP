// Atomic bounded 2D transformations. Source copies never use command evaluation.
json transform_entities(AcDbDatabase *db, const json &p) {
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION","Drawing changed before transformation");
    const auto mode=text(p,"mode");double f=input_factor(db,p),out=output_factor(db,p),scale=1;
    std::set<std::string> allowed={"instanceId","documentId","documentEpoch","expectedRevision","operationId","coordinateSystem","lengthUnit","targets","mode"};
    if(mode=="copy")allowed.insert("delta");
    else if(mode=="rotate")allowed.insert({"center","angle","copy"});
    else if(mode=="scale")allowed.insert({"center","factor","copy"});
    else if(mode=="mirror")allowed.insert({"lineStart","lineEnd","copy"});
    else if(mode=="linear_array")allowed.insert({"count","step"});
    else {need(mode=="circular_array");allowed.insert({"count","center","angleStep"});}
    for(auto it=p.begin();it!=p.end();++it)need(allowed.contains(it.key()));
    if(p.contains("copy"))need(p.at("copy").is_boolean());
    const bool copying=mode=="copy"||mode=="linear_array"||mode=="circular_array"||p.value("copy",mode=="mirror");
    const auto count=(mode=="linear_array"||mode=="circular_array")?number(p,"count"):2;
    need(count>=2&&count<=100);need(p.contains("targets")&&p.at("targets").is_array()&&!p.at("targets").empty()&&p.at("targets").size()<=100);
    need(p.at("targets").size()*(count-1)<=100);
    auto xy=[&](const char *key){auto v=point(p,key,f);need(v.z==0);return v;};
    std::vector<AcGeMatrix3d> matrices;
    if(mode=="copy"){auto delta=xy("delta");matrices.push_back(AcGeMatrix3d::translation(delta-AcGePoint3d::kOrigin));}
    if(mode=="rotate")matrices.push_back(AcGeMatrix3d::rotation(annotation_number(p,"angle"),AcGeVector3d::kZAxis,xy("center")));
    if(mode=="scale"){scale=annotation_number(p,"factor");need(scale>0);matrices.push_back(AcGeMatrix3d::scaling(scale,xy("center")));}
    if(mode=="mirror"){
        auto a=xy("lineStart"),b=xy("lineEnd");need(a.distanceTo(b)>1e-12);
        auto v=b-a;matrices.push_back(AcGeMatrix3d::mirroring(AcGePlane(a,AcGeVector3d(-v.y,v.x,0))));
    }
    if(mode=="linear_array"){
        auto step=xy("step")-AcGePoint3d::kOrigin;need(step.length()>0);
        for(std::uint64_t i=1;i<count;++i)matrices.push_back(AcGeMatrix3d::translation(step*static_cast<double>(i)));
    }
    if(mode=="circular_array"){
        double angle=annotation_number(p,"angleStep");need(std::abs(std::sin(angle/2))>1e-9);
        for(std::uint64_t i=1;i<count;++i)matrices.push_back(AcGeMatrix3d::rotation(angle*static_cast<double>(i),AcGeVector3d::kZAxis,xy("center")));
    }
    Transaction tx(db);auto model=tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db),AcDb::kForWrite);
    std::vector<AcDbEntity*> sources;std::vector<json> before;std::set<std::string> handles;
    std::size_t estimate=0;
    for(const auto &er:p.at("targets")){
        need(er.is_object()&&er.size()==3&&text(er,"documentId")==s.id&&number(er,"documentEpoch")==s.epoch);
        auto e=tx.get<AcDbEntity>(object_id(db,text(er,"handle")),copying?AcDb::kForRead:AcDb::kForWrite);writable_entity(db,e);require_xy(e);
        need(std::set<std::string>{"LINE","CIRCLE","ARC","LWPOLYLINE"}.contains(type(e)),"UNSUPPORTED_ON_PLATFORM","2D transform accepts line, circle, arc and polyline only");
        need(handles.insert(handle(e)).second);auto g=geometry(e,out);
        for(const auto &key:{"start","end","center"})if(g.contains(key))need(std::abs(g.at(key)[2].get<double>())<1e-9,"UNSUPPORTED_ON_PLATFORM","Only WCS XY entities are supported");
        if(g.contains("vertices"))for(const auto &v:g.at("vertices"))need(std::abs(v[2].get<double>())<1e-9,"UNSUPPORTED_ON_PLATFORM","Only WCS XY polylines are supported");
        estimate+=g.dump().size()*matrices.size();need(estimate<200000,"DOC_BUSY","Transformation response budget reached");sources.push_back(e);before.push_back(g);
    }
    auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["error"]=nullptr;
    result["created"]=json::array();result["modified"]=json::array();result["erased"]=json::array();
    struct Verify {AcDbObjectId id;json before;AcGeMatrix3d matrix;};std::vector<Verify> expected;
    s.writing=true;
    try{
        for(std::size_t i=0;i<sources.size();++i)for(const auto &matrix:matrices){
            check_cancel();auto e=sources[i];
            if(copying){std::unique_ptr<AcDbEntity> clone(AcDbEntity::cast(e->clone()));need(clone!=nullptr,"EXECUTION_FAILED","Cannot clone entity");
                cad(clone->transformBy(matrix));AcDbObjectId id;cad(model->appendAcDbEntity(id,clone.get()));e=clone.release();cad(tx.manager->addNewlyCreatedDBRObject(e,true));result["created"].push_back(ref(db,e));
            }else{cad(e->transformBy(matrix));result["modified"].push_back(ref(db,e));}
            expected.push_back({e->objectId(),before[i],matrix});
        }
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing=false;s.revision++;cursors.clear();
    }catch(...){s.writing=false;throw;}
    result["revision"]=s.revision;
    try{
        Transaction read(db);json values=json::array();
        const double tolerance=p.value("lengthUnit",std::string("drawing_unit"))=="m"?1e-9:1e-6;
        for(const auto &plan:expected){
            auto e=read.get<AcDbEntity>(plan.id);auto actual=geometry(e,out);need(actual.at("type")==plan.before.at("type")&&actual.at("layer")==plan.before.at("layer"),"VERIFICATION_FAILED");
            auto transformed=[&](const json &v){auto pt=point(json{{"value",v}},"value",f);pt.transformBy(plan.matrix);return xyz(pt,out);};
            const bool mirroredArc=mode=="mirror"&&plan.before.at("type")=="ARC";
            if(mirroredArc){auto a=transformed(plan.before.at("start")),b=transformed(plan.before.at("end"));
                need((close_point(actual.at("start"),a,tolerance)&&close_point(actual.at("end"),b,tolerance))||
                     (close_point(actual.at("start"),b,tolerance)&&close_point(actual.at("end"),a,tolerance)),"VERIFICATION_FAILED");}
            // AutoCAD normalizes a reflected arc back to CCW, exchanging its endpoints.
            for(const auto &key:{"start","end","center"})if(plan.before.contains(key)&&!(mirroredArc&&std::string(key)!="center"))need(close_point(actual.at(key),transformed(plan.before.at(key)),tolerance),"VERIFICATION_FAILED");
            if(plan.before.contains("vertices")){need(actual.at("vertices").size()==plan.before.at("vertices").size(),"VERIFICATION_FAILED");for(std::size_t j=0;j<plan.before.at("vertices").size();++j)need(close_point(actual.at("vertices")[j],transformed(plan.before.at("vertices")[j]),tolerance),"VERIFICATION_FAILED");}
            for(const auto &key:{"radius","length","area"})if(plan.before.contains(key)){double wanted=plan.before.at(key).get<double>()*scale*(std::string(key)=="area"?scale:1);need(std::isfinite(wanted)&&std::abs(actual.at(key).get<double>()-wanted)<=std::max(tolerance,std::abs(wanted)*1e-8),"VERIFICATION_FAILED");}
            values.push_back(actual);
        }
        read.commit();result["verified"]=true;result["observedGeometry"]={{"items",values},{"coordinateSystem","WCS"},{"lengthUnit",p.value("lengthUnit",std::string("drawing_unit"))}};
    }catch(...){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Committed transformation could not be verified"},{"retryable",false}};}
    return result;
}
