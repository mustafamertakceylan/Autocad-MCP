std::unique_ptr<AcDb3dSolid> axial_frustum(double height,double radius,double topRadius,const AcGePoint3d &entry,bool negative){
    need(std::isfinite(height)&&std::isfinite(radius)&&std::isfinite(topRadius)&&height>0&&radius>0&&topRadius>0);
    auto solid=std::make_unique<AcDb3dSolid>();check_cancel();cad(solid->createFrustum(height,radius,radius,topRadius));
    // Normalize by native bounds instead of assuming the primitive's origin.
    AcDbExtents ext;cad(solid->getGeomExtents(ext));cad(solid->transformBy(AcGeMatrix3d::translation({0,0,-ext.minPoint().z})));
    if(negative)cad(solid->transformBy(AcGeMatrix3d::rotation(3.141592653589793,AcGeVector3d::kXAxis,AcGePoint3d::kOrigin)));
    cad(solid->transformBy(AcGeMatrix3d::translation(entry-AcGePoint3d::kOrigin)));return solid;
}
std::unique_ptr<AcDb3dSolid> machining(AcDbDatabase *db,Transaction &tx,const std::string &method,const json &p,AcDbEntity *&properties,std::vector<AcDbEntity*> &erase){
    double f=input_factor(db,p);
    if(method=="acad_create_shaft"){
        need(p.contains("segments")&&p.at("segments").is_array()&&!p.at("segments").empty()&&p.at("segments").size()<=32);auto base=point(p,"base",f);std::unique_ptr<AcDb3dSolid> result;double z=base.z;
        for(const auto &segment:p.at("segments")){need(segment.is_object()&&segment.size()==2);double length=annotation_number(segment,"length")*f,radius=annotation_number(segment,"diameter")*f/2;need(std::isfinite(z+length));
            auto current=axial_frustum(length,radius,radius,{base.x,base.y,z},false);if(!result)result=std::move(current);else cad(result->booleanOper(AcDb::kBoolUnite,current.get()));z+=length;}
        return result;
    }
    need(method=="acad_drill_holes");auto source=selected_solid(db,tx,p.at("entityRef"),true);properties=source;erase.push_back(source);auto result=clone_solid(source);
    need(p.contains("centers")&&p.at("centers").is_array()&&!p.at("centers").empty()&&p.at("centers").size()<=64);
    double radius=annotation_number(p,"diameter")*f/2,depth=annotation_number(p,"depth")*f;need(radius>0&&depth>0&&std::isfinite(radius)&&std::isfinite(depth));auto direction=text(p,"direction");need(direction=="positive_z"||direction=="negative_z");bool negative=direction=="negative_z";
    auto entry=p.value("entry",json{{"kind","plain"}});need(entry.is_object());auto kind=text(entry,"kind");need(kind=="plain"||kind=="counterbore"||kind=="countersink");need(entry.size()==(kind=="plain"?1:3));double entryRadius=radius,entryDepth=0;
    if(kind!="plain"){entryRadius=annotation_number(entry,"diameter")*f/2;entryDepth=annotation_number(entry,"depth")*f;need(entryRadius>radius&&entryDepth>0&&entryDepth<=depth&&std::isfinite(entryRadius));}
    std::set<std::string> seen;
    for(const auto &center:p.at("centers")){
        json pointObject={{"center",center}};auto position=point(pointObject,"center",f);need(seen.insert(xyz(position).dump()).second,"VALIDATION_FAILED","Duplicate hole center");double before=solid_properties(result.get(),1).at("volume");
        auto cutter=axial_frustum(depth,radius,radius,position,negative);cad(result->booleanOper(AcDb::kBoolSubtract,cutter.get()));
        if(kind!="plain"){auto counter=axial_frustum(entryDepth,entryRadius,kind=="counterbore"?entryRadius:radius,position,negative);cad(result->booleanOper(AcDb::kBoolSubtract,counter.get()));}
        double after=solid_properties(result.get(),1).at("volume");need(before-after>std::max(1e-12,before*1e-12),"VALIDATION_FAILED","Each hole must remove material; no source geometry was changed");
    }
    return result;
}
