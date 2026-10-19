// Modeler calls operate on detached copies. In particular booleanOper may
// destroy both operand bodies on failure; no database body is passed to it.
AcDb3dSolid *selected_solid(AcDbDatabase *db,Transaction &tx,const json &er,bool writable=false){
    auto &s=state(db);
    need(er.is_object()&&er.size()==3&&text(er,"documentId")==s.id&&number(er,"documentEpoch")==s.epoch);
    auto solid=tx.get<AcDb3dSolid>(object_id(db,text(er,"handle")),writable?AcDb::kForWrite:AcDb::kForRead);
    modelspace(db,solid);if(writable)writable_entity(db,solid);
    need(!solid->isNull(),"VALIDATION_FAILED","Solid has no modeler body");return solid;
}
std::unique_ptr<AcDb3dSolid> clone_solid(AcDb3dSolid *source){
    auto raw=source->clone();auto solid=AcDb3dSolid::cast(raw);
    if(!solid){delete raw;throw Failure{"EXECUTION_FAILED","Solid clone unavailable"};}
    return std::unique_ptr<AcDb3dSolid>(solid);
}
json solid_properties(AcDb3dSolid *solid,double f){
    need(solid&&!solid->isNull(),"VALIDATION_FAILED","Empty solid result is not accepted");
    double volume=0,area=0,mi[3]{},pi[3]{},pm[3]{},rg[3]{};AcGePoint3d centroid;AcGeVector3d axes[3];AcDbExtents ext;
    cad(solid->getMassProp(volume,centroid,mi,pi,pm,axes,rg,ext));cad(solid->getArea(area));
    need(std::isfinite(volume)&&volume>0&&std::isfinite(area)&&area>0,"VALIDATION_FAILED","Solid must have positive finite volume and area");
    need(std::isfinite(volume*f*f*f)&&std::isfinite(area*f*f),"VALIDATION_FAILED","Solid unit conversion overflow");
    return {{"volume",volume*f*f*f},{"area",area*f*f},{"centroid",xyz(centroid,f)},
            {"extents",{{"min",xyz(ext.minPoint(),f)},{"max",xyz(ext.maxPoint(),f)}}}};
}
json mass_properties(AcDbDatabase *db,const json &p){
    Transaction tx(db);auto solid=selected_solid(db,tx,p.at("entityRef"));auto result=identity(db);auto unit=p.value("lengthUnit",std::string("drawing_unit"));
    include(result,solid_properties(solid,output_factor(db,p)));result["entityRef"]=ref(db,solid);result["revision"]=state(db).revision;
    result["coordinateSystem"]="WCS";result["lengthUnit"]=unit;result["areaUnit"]=unit+"^2";result["volumeUnit"]=unit+"^3";
    if(p.contains("densityKgM3")){
        double density=annotation_number(p,"densityKgM3");need(density>0);double metres=drawing_metres(db);
        double mass=solid_properties(solid,1).at("volume").get<double>()*metres*metres*metres*density;
        need(std::isfinite(mass)&&mass>0);result["densityKgM3"]=density;result["massKg"]=mass;
    }
    tx.commit();return result;
}
#include "machining.hpp"

json edit_solids(AcDbDatabase *db,const std::string &method,const json &p){
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION","Drawing changed before solid operation");
    const double f=input_factor(db,p),out=output_factor(db,p);Transaction tx(db);
    std::unique_ptr<AcDb3dSolid> created;AcDbEntity *properties=nullptr;std::vector<AcDbEntity*> erase;
    if(method=="acad_drill_holes"||method=="acad_create_shaft"){
        created=machining(db,tx,method,p,properties,erase);
    }else if(method=="acad_boolean"){
        auto source=selected_solid(db,tx,p.at("entityRef"),true);properties=source;created=clone_solid(source);erase.push_back(source);
        auto operation=text(p,"operation");need(operation=="union"||operation=="subtract"||operation=="intersect");
        need(p.contains("tools")&&p.at("tools").is_array()&&!p.at("tools").empty()&&p.at("tools").size()<=16);
        if(p.contains("keepTools"))need(p.at("keepTools").is_boolean());
        std::set<AcDbObjectId> seen={source->objectId()};std::vector<AcDb3dSolid*> cutters;
        // Validate every target and layer before the first expensive modeler call.
        for(const auto &er:p.at("tools")){auto tool=selected_solid(db,tx,er,!p.value("keepTools",true));need(seen.insert(tool->objectId()).second);cutters.push_back(tool);if(!p.value("keepTools",true))erase.push_back(tool);}
        for(auto tool:cutters){check_cancel();auto detached=clone_solid(tool);
            cad(created->booleanOper(operation=="union"?AcDb::kBoolUnite:operation=="subtract"?AcDb::kBoolSubtract:AcDb::kBoolIntersect,detached.get()));
            need(!created->isNull(),"VALIDATION_FAILED","Boolean result is empty; source entities were preserved");
        }
    }else{
        auto profile=planar_curve(db,tx,p.at("entityRef"));properties=profile;writable_entity(db,profile);
        need(AcDbCircle::cast(profile)||(AcDbPolyline::cast(profile)&&AcDbPolyline::cast(profile)->isClosed()),"UNSUPPORTED_ON_PLATFORM","Solid profile must be one closed CIRCLE or LWPOLYLINE");
        if(p.contains("keepProfile"))need(p.at("keepProfile").is_boolean());
        // createFromCurves must never receive a database curve open for write.
        std::unique_ptr<AcRxObject> detached(profile->clone());auto curve=AcDbCurve::cast(detached.get());need(curve!=nullptr);
        AcDbVoidPtrArray curves;curves.append(curve);TemporaryCurves regions;
        check_cancel();cad(AcDbRegion::createFromCurves(curves,regions.values));
        need(regions.values.length()==1,"VALIDATION_FAILED","Profile must form exactly one simple closed region");
        auto region=AcDbRegion::cast(static_cast<AcDbEntity*>(regions.values[0]));need(region!=nullptr);created=std::make_unique<AcDb3dSolid>();
        if(method=="acad_extrude"){
            double height=annotation_number(p,"height")*f;need(std::isfinite(height)&&height!=0);AcDbSweepOptions options;
            cad(created->createExtrudedSolid(region,AcGeVector3d(0,0,height),options));
        }else{
            need(method=="acad_revolve");auto a=point(p,"axisStart",f),b=point(p,"axisEnd",f);need(a.z==0&&b.z==0&&a.distanceTo(b)>1e-9);
            double angle=annotation_number(p,"angle");need(angle>0&&angle<=2*3.141592653589793);AcDbRevolveOptions options;
            cad(created->createRevolvedSolid(region,a,(b-a).normal(),angle,0,options));
        }
        if(!p.value("keepProfile",true)){cad(profile->upgradeOpen());erase.push_back(profile);}
    }
    check_cancel();const auto expectedProperties=solid_properties(created.get(),out);
    created->setDatabaseDefaults(db);if(properties)cad(created->setPropertiesFrom(properties));
    if(p.contains("layer"))cad(created->setLayer(wide(text(p,"layer")).c_str()));
    AcDbLayerTableRecord *layer=nullptr;cad(acdbOpenObject(layer,created->layerId(),AcDb::kForRead));bool locked=layer->isLocked();layer->close();need(!locked,"SECURITY_DENIED","Layer is locked");
    auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["error"]=nullptr;
    result["created"]=json::array();result["modified"]=json::array();result["erased"]=json::array();AcDbObjectId createdId;std::vector<AcDbObjectId> erasedIds;json expected;
    auto model=tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db),AcDb::kForWrite);s.writing=true;
    try{
        check_cancel();cad(model->appendAcDbEntity(createdId,created.get()));auto raw=created.release();cad(tx.manager->addNewlyCreatedDBRObject(raw,true));
        result["created"].push_back(ref(db,raw));expected=geometry(raw,out);
        for(auto e:erase){check_cancel();result["erased"].push_back(ref(db,e));erasedIds.push_back(e->objectId());cad(e->erase());}
        test_fault("abort_before_commit");check_cancel();tx.commit();s.writing=false;s.revision++;cursors.clear();
    }catch(...){s.writing=false;throw;}
    result["revision"]=s.revision;
    try{
        Transaction read(db);auto solid=read.get<AcDb3dSolid>(createdId);auto actual=geometry(solid,out);
        need(same_geometry(actual,expected)&&same_geometry(solid_properties(solid,out),expectedProperties),"VERIFICATION_FAILED");
        for(auto id:erasedIds){AcDbEntity *e=nullptr;cad(read.manager->getObject(e,id,AcDb::kForRead,true));need(e&&e->isErased(),"VERIFICATION_FAILED");}
        read.commit();result["verified"]=true;result["observedGeometry"]={{"items",json::array({actual})},{"lengthUnit",p.at("lengthUnit")},{"coordinateSystem","WCS"}};
    }catch(...){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Committed solid operation could not be verified"},{"retryable",false}};}
    return result;
}
