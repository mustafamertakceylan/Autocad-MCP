struct TemporaryCurves {
    AcDbVoidPtrArray values;
    ~TemporaryCurves(){for(int i=0;i<values.length();++i)delete static_cast<AcDbEntity*>(values[i]);}
    std::unique_ptr<AcDbEntity> take(int i){auto p=static_cast<AcDbEntity*>(values[i]);values[i]=nullptr;return std::unique_ptr<AcDbEntity>(p);}
};
AcDbCurve *planar_curve(AcDbDatabase *db,Transaction &tx,const json &er,bool write=false){
    auto &s=state(db);need(er.is_object()&&er.size()==3&&text(er,"documentId")==s.id&&number(er,"documentEpoch")==s.epoch);
    auto curve=tx.get<AcDbCurve>(object_id(db,text(er,"handle")),write?AcDb::kForWrite:AcDb::kForRead);
    modelspace(db,curve);if(write)writable_entity(db,curve);require_xy(curve);
    need(std::set<std::string>{"LINE","CIRCLE","ARC","LWPOLYLINE"}.contains(type(curve)),"UNSUPPORTED_ON_PLATFORM","Only supported planar curves are accepted");
    auto g=geometry(curve,1);
    for(const auto &key:{"start","end","center"})if(g.contains(key))need(std::abs(g.at(key)[2].get<double>())<1e-9,"UNSUPPORTED_ON_PLATFORM","Only WCS XY curves are accepted");
    if(g.contains("vertices"))for(const auto &v:g.at("vertices"))need(std::abs(v[2].get<double>())<1e-9,"UNSUPPORTED_ON_PLATFORM","Only WCS XY curves are accepted");
    return curve;
}
json edit_curves(AcDbDatabase *db,const std::string &method,const json &p){
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION","Drawing changed before curve editing");
    const double f=input_factor(db,p),out=output_factor(db,p);Transaction tx(db);
    std::vector<std::unique_ptr<AcDbEntity>> additions;std::vector<AcDbEntity*> erase;
    struct LineChange{AcDbLine *line;AcGePoint3d start,end;};std::vector<LineChange> changes;
    AcDbEntity *properties=nullptr;
    auto xy=[&](const char *key){auto v=point(p,key,f);need(v.z==0);return v;};
    if(method=="acad_offset_entity"){
        auto source=planar_curve(db,tx,p.at("entityRef"));properties=source;
        // Creating on a locked source layer is also forbidden.
        writable_entity(db,source);double distance=annotation_number(p,"distance")*f;need(distance>0&&std::isfinite(distance));
        auto side=xy("sidePoint");AcGePoint3d original;cad(source->getClosestPointTo(side,original));
        auto direction=side-original;need(direction.length()>1e-9,"VALIDATION_FAILED","Side point must lie off the source curve");
        std::vector<std::unique_ptr<AcDbEntity>> chosen;int matches=0;
        for(double sign:{1.,-1.}){
            TemporaryCurves group;auto status=source->getOffsetCurves(distance*sign,group.values);
            if(status!=Acad::eOk)continue;need(group.values.length()<=100,"DOC_BUSY","Offset result limit reached");
            bool onSide=false;
            for(int i=0;i<group.values.length();++i){auto curve=AcDbCurve::cast(static_cast<AcDbEntity*>(group.values[i]));need(curve!=nullptr);AcGePoint3d closest;cad(curve->getClosestPointTo(side,closest));
                if((closest-original).dotProduct(direction)>1e-9*direction.length())onSide=true;}
            if(onSide){++matches;for(int i=0;i<group.values.length();++i)chosen.push_back(group.take(i));}
        }
        need(matches==1&&!chosen.empty(),"VALIDATION_FAILED","Offset is impossible or side selection is ambiguous");additions=std::move(chosen);
    }else if(method=="acad_edit_curve"){
        const auto mode=text(p,"mode");need(mode=="trim"||mode=="extend");
        need(!p.contains(mode=="trim"?"end":"keepPoint"));
        auto source=planar_curve(db,tx,p.at("entityRef"),true);properties=source;
        need(p.contains("boundaries")&&p.at("boundaries").is_array()&&!p.at("boundaries").empty()&&p.at("boundaries").size()<=32);
        AcGePoint3dArray crossings;std::set<std::string> unique={handle(source)};
        for(const auto &er:p.at("boundaries")){
            need(unique.insert(text(er,"handle")).second);auto boundary=planar_curve(db,tx,er);
            cad(source->intersectWith(boundary,mode=="extend"?AcDb::kExtendThis:AcDb::kOnBothOperands,crossings));
            need(crossings.length()<=512,"DOC_BUSY","Intersection limit reached");
        }
        if(mode=="extend"){
            auto line=AcDbLine::cast(source);need(line!=nullptr,"UNSUPPORTED_ON_PLATFORM","Extension currently accepts LINE only");
            const auto end=text(p,"end");need(end=="start"||end=="end");auto a=line->startPoint(),b=line->endPoint();auto direction=b-a;
            need(direction.lengthSqrd()>0);double best=std::numeric_limits<double>::infinity();AcGePoint3d chosen;
            for(int i=0;i<crossings.length();++i){auto hit=crossings[i];double t=(hit-a).dotProduct(direction)/direction.lengthSqrd();double distance=end=="start"?-t:t-1;
                if(distance>1e-9&&distance<best){best=distance;chosen=hit;}}
            need(std::isfinite(best),"TARGET_NOT_FOUND","No forward boundary intersection");changes.push_back({line,end=="start"?chosen:a,end=="end"?chosen:b});
        }else{
            auto keep=xy("keepPoint");AcGePoint3d anchor;cad(source->getClosestPointTo(keep,anchor));
            double start=0,end=0;cad(source->getStartParam(start));cad(source->getEndParam(end));std::vector<double> cuts;
            for(int i=0;i<crossings.length();++i){auto hit=crossings[i];need(hit.distanceTo(anchor)>1e-8,"VALIDATION_FAILED","Keep point lies on a cutting boundary");double t=0;if(source->getParamAtPoint(hit,t)!=Acad::eOk)continue;
                if(source->isClosed()||(t>start+1e-9&&t<end-1e-9))cuts.push_back(t);}
            std::sort(cuts.begin(),cuts.end());cuts.erase(std::unique(cuts.begin(),cuts.end(),[](double a,double b){return std::abs(a-b)<1e-9;}),cuts.end());
            need(!cuts.empty()&&(!source->isClosed()||cuts.size()>=2),"TARGET_NOT_FOUND","No usable trim intersections");AcGeDoubleArray params;for(double v:cuts)params.append(v);
            TemporaryCurves segments;cad(source->getSplitCurves(params,segments.values));need(segments.values.length()>=2&&segments.values.length()<=100,"VALIDATION_FAILED","Cannot split curve within limits");
            int chosen=-1;double best=std::numeric_limits<double>::infinity(),second=best;
            for(int i=0;i<segments.values.length();++i){auto segment=AcDbCurve::cast(static_cast<AcDbEntity*>(segments.values[i]));need(segment!=nullptr);AcGePoint3d closest;cad(segment->getClosestPointTo(anchor,closest));double distance=closest.distanceTo(anchor);if(distance<best){second=best;best=distance;chosen=i;}else second=std::min(second,distance);}
            need(chosen>=0&&best<1e-7&&second>1e-8,"VALIDATION_FAILED","Trim segment selection is ambiguous");additions.push_back(segments.take(chosen));erase.push_back(source);
        }
    }else{
        const auto kind=text(p,"kind");need(kind=="fillet"||kind=="chamfer");
        need(p.contains("targets")&&p.at("targets").is_array()&&p.at("targets").size()==2);
        auto a=AcDbLine::cast(planar_curve(db,tx,p.at("targets")[0],true)),b=AcDbLine::cast(planar_curve(db,tx,p.at("targets")[1],true));
        need(a&&b&&a!=b,"UNSUPPORTED_ON_PLATFORM","Corner requires two different LINEs");properties=a;
        AcGePoint3d corner,otherA,otherB;bool startA=false,startB=false;int matches=0;
        for(int i=0;i<2;++i)for(int j=0;j<2;++j){auto pa=i==0?a->startPoint():a->endPoint(),pb=j==0?b->startPoint():b->endPoint();if(pa.distanceTo(pb)<1e-8){++matches;corner=pa;startA=i==0;startB=j==0;}}
        need(matches==1,"VALIDATION_FAILED","Lines must share exactly one endpoint");otherA=startA?a->endPoint():a->startPoint();otherB=startB?b->endPoint():b->startPoint();
        auto u=otherA-corner,v=otherB-corner;double lengthA=u.length(),lengthB=v.length();need(lengthA>1e-9&&lengthB>1e-9);u/=lengthA;v/=lengthB;
        double angle=std::acos(std::clamp(u.dotProduct(v),-1.,1.));need(angle>1e-6&&angle<3.141592653589793-1e-6);
        double da=0,dbb=0,radius=0;
        if(kind=="fillet"){need(!p.contains("distanceA")&&!p.contains("distanceB"));radius=annotation_number(p,"radius")*f;need(radius>0&&std::isfinite(radius));da=dbb=radius/std::tan(angle/2);}
        else{need(!p.contains("radius"));da=annotation_number(p,"distanceA")*f;dbb=annotation_number(p,"distanceB")*f;}
        need(da>0&&dbb>0&&da<lengthA-1e-9&&dbb<lengthB-1e-9,"VALIDATION_FAILED","Corner distances do not fit inside line segments");
        auto tangentA=corner+u*da,tangentB=corner+v*dbb;
        if(kind=="fillet"){
            auto bisector=(u+v).normal();auto center=corner+bisector*(radius/std::sin(angle/2));auto pa=tangentA-center,pb=tangentB-center;
            double aa=std::atan2(pa.y,pa.x),ab=std::atan2(pb.y,pb.x),delta=std::fmod(ab-aa+2*3.141592653589793,2*3.141592653589793);if(delta>3.141592653589793)std::swap(aa,ab);
            additions.push_back(std::make_unique<AcDbArc>(center,AcGeVector3d::kZAxis,radius,aa,ab));
        }else additions.push_back(std::make_unique<AcDbLine>(tangentA,tangentB));
        if(p.contains("trim"))need(p.at("trim").is_boolean());if(p.value("trim",true)){
            changes.push_back({a,startA?tangentA:otherA,startA?otherA:tangentA});changes.push_back({b,startB?tangentB:otherB,startB?otherB:tangentB});
        }
    }
    need(additions.size()<=100,"DOC_BUSY","Curve edit output limit reached");auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["error"]=nullptr;
    result["created"]=json::array();result["modified"]=json::array();result["erased"]=json::array();
    std::vector<std::pair<AcDbObjectId,json>> verify;std::vector<AcDbObjectId> erasedIds;
    auto model=tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db),AcDb::kForWrite);s.writing=true;
    try{
        std::size_t bytes=0;
        for(auto &e:additions){check_cancel();need(e&&std::set<std::string>{"LINE","CIRCLE","ARC","LWPOLYLINE"}.contains(type(e.get())),"UNSUPPORTED_ON_PLATFORM","Curve edit produced an unsupported object");
            e->setDatabaseDefaults(db);cad(e->setPropertiesFrom(properties));AcDbObjectId id;cad(model->appendAcDbEntity(id,e.get()));auto raw=e.release();cad(tx.manager->addNewlyCreatedDBRObject(raw,true));auto value=geometry(raw,out);bytes+=value.dump().size();need(bytes<200000,"DOC_BUSY","Curve response budget reached");verify.push_back({id,value});result["created"].push_back(ref(db,raw));
        }
        for(const auto &change:changes){check_cancel();cad(change.line->setStartPoint(change.start));cad(change.line->setEndPoint(change.end));verify.push_back({change.line->objectId(),geometry(change.line,out)});result["modified"].push_back(ref(db,change.line));}
        for(auto e:erase){check_cancel();result["erased"].push_back(ref(db,e));erasedIds.push_back(e->objectId());cad(e->erase());}
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing=false;s.revision++;cursors.clear();
    }catch(...){s.writing=false;throw;}
    result["revision"]=s.revision;
    try{Transaction read(db);json values=json::array();
        for(const auto &[id,wanted]:verify){auto e=read.get<AcDbEntity>(id);auto actual=geometry(e,out);need(same_geometry(actual,wanted),"VERIFICATION_FAILED");values.push_back(actual);}
        for(auto id:erasedIds){AcDbEntity *erased=nullptr;cad(read.manager->getObject(erased,id,AcDb::kForRead,true));need(erased&&erased->isErased(),"VERIFICATION_FAILED");}
        read.commit();result["verified"]=true;result["observedGeometry"]={{"items",values},{"lengthUnit",p.value("lengthUnit",std::string("drawing_unit"))},{"coordinateSystem","WCS"}};
    }catch(...){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Committed curve edit could not be verified"},{"retryable",false}};}
    return result;
}
