bool same_geometry(const json &,const json &);
void require_xy(AcDbEntity *e){
    auto normal=AcGeVector3d::kZAxis;
    if(auto c=AcDbCircle::cast(e))normal=c->normal();
    if(auto a=AcDbArc::cast(e))normal=a->normal();
    if(auto p=AcDbPolyline::cast(e))normal=p->normal();
    if(auto t=AcDbText::cast(e))normal=t->normal();
    if(auto t=AcDbMText::cast(e))normal=t->normal();
    need(std::abs(normal.x)<1e-9&&std::abs(normal.y)<1e-9&&std::abs(std::abs(normal.z)-1)<1e-9,"UNSUPPORTED_ON_PLATFORM","Only WCS XY entities are accepted");
    auto g=geometry(e,1);for(const auto &key:{"start","end","center","position"})if(g.contains(key))need(std::abs(g.at(key)[2].get<double>())<1e-9,"UNSUPPORTED_ON_PLATFORM","Only WCS XY entities are accepted");
    if(g.contains("vertices"))for(const auto &v:g.at("vertices"))need(std::abs(v[2].get<double>())<1e-9,"UNSUPPORTED_ON_PLATFORM","Only WCS XY vertices are accepted");
}
std::string attribute_string(const json &v){
    need(v.is_string());auto value=v.get<std::string>();need(value.size()<=1024&&value.find("%<")==std::string::npos);
    for(unsigned char c:value)need(c>=32);return value;
}
json attribute_values(const json &p){
    auto values=p.value("attributes",json::object());need(values.is_object()&&values.size()<=32);
    for(auto it=values.begin();it!=values.end();++it){need(std::regex_match(it.key(),std::regex("[A-Z][A-Z0-9_]{0,31}")));attribute_string(it.value());}
    return values;
}
json block_geometry(AcDbEntity *e,double f){
    auto block=AcDbBlockReference::cast(e);if(!block||AcDbTable::cast(e))return json::object();
    const auto scale=block->scaleFactors();json attrs=json::object(),points=json::array();Transaction read(e->database());
    std::unique_ptr<AcDbObjectIterator> it(block->attributeIterator());std::size_t bytes=0;
    for(;!it->done();it->step()){
        need(points.size()<100,"DOC_BUSY","Attribute query limit reached");auto a=read.get<AcDbAttribute>(it->objectId());AcString tag,value;cad(a->tag(tag));cad(a->textString(value));
        auto key=utf8(tag.kACharPtr()),content=utf8(value.kACharPtr());need(!attrs.contains(key),"UNSUPPORTED_ON_PLATFORM","Duplicate attribute tags require manual resolution");
        attrs[key]=content;points.push_back({{"tag",key},{"position",xyz(a->position(),f)},{"height",a->height()*f},{"visible",!a->isInvisible()}});
        bytes+=key.size()+content.size();need(bytes<150000,"DOC_BUSY","Attribute response limit reached");
    }
    bool external=read.get<AcDbBlockTableRecord>(block->blockTableRecord())->isFromExternalReference();
    read.commit();return {{"externalReference",external},{"blockName",symbol_name(block->blockTableRecord())},{"position",xyz(block->position(),f)},
        {"rotation",block->rotation()},{"scale",json::array({scale.sx,scale.sy,scale.sz})},{"attributes",attrs},{"attributeGeometry",points}};
}
void attribute_layer(AcDbAttribute *attribute,Transaction &tx){
    auto layer=tx.get<AcDbLayerTableRecord>(attribute->layerId());need(!layer->isLocked(),"SECURITY_DENIED","Attribute layer is locked");
}
void writable_block_attributes(AcDbEntity *e){
    auto block=AcDbBlockReference::cast(e);if(!block)return;
    Transaction tx(e->database());
    std::unique_ptr<AcDbObjectIterator> it(block->attributeIterator());std::size_t count=0;
    for(;!it->done();it->step()){need(++count<=100,"DOC_BUSY","Attribute update limit reached");auto a=tx.get<AcDbAttribute>(it->objectId());attribute_layer(a,tx);}
    tx.commit();
}
AcDbBlockTableRecord *local_block(Transaction &tx,AcDbObjectId id){
    auto record=tx.get<AcDbBlockTableRecord>(id);need(!record->isLayout()&&!record->isAnonymous()&&!record->isFromExternalReference(),"UNSUPPORTED_ON_PLATFORM","Only local named block definitions are accepted");return record;
}
json block_definition(AcDbDatabase *db,AcDbObjectId id,double f){
    Transaction read(db);auto record=local_block(read,id);AcDbBlockTableRecordIterator *raw=nullptr;cad(record->newIterator(raw));std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);
    json items=json::array(),attributes=json::array();std::size_t bytes=0;
    for(;!it->done();it->step()){
        need(items.size()+attributes.size()<132,"DOC_BUSY","Block definition query limit reached");auto e=read.get<AcDbEntity>(iterator_id(it.get()));
        if(auto a=AcDbAttributeDefinition::cast(e)){AcString tag,value,prompt;cad(a->tag(tag));cad(a->textString(value));cad(a->prompt(prompt));
            attributes.push_back({{"tag",utf8(tag.kACharPtr())},{"defaultValue",utf8(value.kACharPtr())},{"prompt",utf8(prompt.kACharPtr())},{"position",xyz(a->position(),f)},{"height",a->height()*f},{"visible",!a->isInvisible()},{"constant",static_cast<bool>(a->isConstant())}});
        }else{auto value=geometry(e,f);value.erase("handle");bytes+=value.dump().size();items.push_back(value);}
        need(bytes+attributes.dump().size()<250000,"DOC_BUSY","Block definition response budget reached");
    }
    auto result=json{{"name",symbol_name(id)},{"origin",xyz(record->origin(),f)},{"items",items},{"attributeDefinitions",attributes}};read.commit();return result;
}
json get_block(AcDbDatabase *db,const json &p){
    auto result=block_definition(db,named_symbol(db->blockTableId(),text(p,"name")),output_factor(db,p));
    result["revision"]=state(db).revision;result["lengthUnit"]=p.value("lengthUnit",std::string("drawing_unit"));return result;
}
json edit_blocks(AcDbDatabase *db,const std::string &method,const json &p){
    auto &s=state(db);need(s.revision==number(p,"expectedRevision"),"STALE_REVISION","Drawing changed before block operation");
    const double f=method=="acad_set_attributes"?1:input_factor(db,p),out=method=="acad_set_attributes"?1:output_factor(db,p);
    auto result=identity(db);result["operationId"]=text(p,"operationId");result["status"]="succeeded";result["applied"]=true;result["verified"]=false;result["error"]=nullptr;
    result["created"]=json::array();result["modified"]=json::array();result["erased"]=json::array();
    Transaction tx(db);AcDbObjectId definitionId,entityId;json expected;bool defining=method=="acad_define_block";
    s.writing=true;
    try{
        if(defining){
            const auto name=text(p,"name");need(name.size()<=512&&name.find_first_of("<>/\\\":;?*|=,")==std::string::npos);for(unsigned char c:name)need(c>=32);
            auto table=tx.get<AcDbBlockTable>(db->blockTableId(),AcDb::kForWrite);need(!table->has(wide(name).c_str()),"VALIDATION_FAILED","Block already exists");
            need(p.contains("targets")&&p.at("targets").is_array()&&!p.at("targets").empty()&&p.at("targets").size()<=100);
            auto base=point(p,"basePoint",f);need(base.z==0);std::vector<AcDbEntity*> selected;std::set<std::string> unique;std::size_t budget=0;
            for(const auto &er:p.at("targets")){
                need(er.is_object()&&er.size()==3&&text(er,"documentId")==s.id&&number(er,"documentEpoch")==s.epoch);auto e=tx.get<AcDbEntity>(object_id(db,text(er,"handle")));modelspace(db,e);
                need(unique.insert(handle(e)).second);need(std::set<std::string>{"LINE","CIRCLE","ARC","LWPOLYLINE","TEXT","MTEXT"}.contains(type(e)),"UNSUPPORTED_ON_PLATFORM","Initial block definition accepts planar curves/text only");
                require_xy(e);budget+=geometry(e,1).dump().size();need(budget<150000,"DOC_BUSY","Block source budget reached");selected.push_back(e);
            }
            auto attributes=p.value("attributes",json::array());need(attributes.is_array()&&attributes.size()<=32);std::set<std::string> tags;
            for(const auto &a:attributes){need(a.is_object()&&a.size()>=5&&a.size()<=6);for(auto it=a.begin();it!=a.end();++it)need(std::set<std::string>{"tag","prompt","defaultValue","position","height","visible"}.contains(it.key()));
                const auto tag=text(a,"tag");need(std::regex_match(tag,std::regex("[A-Z][A-Z0-9_]{0,31}"))&&tags.insert(tag).second);attribute_string(a.at("prompt"));attribute_string(a.at("defaultValue"));auto position=point(a,"position",f);need(position.z==0);
                double height=annotation_number(a,"height")*f;need(height>0&&std::isfinite(height));if(a.contains("visible"))need(a.at("visible").is_boolean());}
            auto record=std::make_unique<AcDbBlockTableRecord>();cad(record->setName(wide(name).c_str()));cad(record->setOrigin(AcGePoint3d::kOrigin));
            check_cancel();cad(table->add(definitionId,record.get()));auto block=record.release();cad(tx.manager->addNewlyCreatedDBRObject(block,true));
            for(auto source:selected){check_cancel();std::unique_ptr<AcDbEntity> clone(AcDbEntity::cast(source->clone()));need(clone!=nullptr);cad(clone->transformBy(AcGeMatrix3d::translation(AcGePoint3d::kOrigin-base)));AcDbObjectId id;cad(block->appendAcDbEntity(id,clone.get()));auto raw=clone.release();cad(tx.manager->addNewlyCreatedDBRObject(raw,true));}
            for(const auto &a:attributes){check_cancel();auto attribute=std::make_unique<AcDbAttributeDefinition>();attribute->setDatabaseDefaults(db);cad(attribute->setLayer(L"0"));
                cad(attribute->setTag(wide(text(a,"tag")).c_str()));cad(attribute->setPrompt(wide(attribute_string(a.at("prompt"))).c_str()));cad(attribute->setTextString(wide(attribute_string(a.at("defaultValue"))).c_str()));
                cad(attribute->setPosition(point(a,"position",f)));cad(attribute->setHeight(annotation_number(a,"height")*f));cad(attribute->setInvisible(!a.value("visible",true)));cad(attribute->setConstant(false));
                AcDbObjectId id;cad(block->appendAcDbEntity(id,attribute.get()));auto raw=attribute.release();cad(tx.manager->addNewlyCreatedDBRObject(raw,true));}
            expected=block_definition(db,definitionId,out);
        }else if(method=="acad_insert_block"){
            definitionId=named_symbol(db->blockTableId(),text(p,"name"));auto block=local_block(tx,definitionId);auto values=attribute_values(p);
            auto position=point(p,"position",f);need(position.z==0);double scale=annotation_number(p,"scale",1);need(scale>0);
            auto reference=std::make_unique<AcDbBlockReference>(position,definitionId);reference->setDatabaseDefaults(db);cad(reference->setRotation(annotation_number(p,"rotation")));cad(reference->setScaleFactors(AcGeScale3d(scale)));
            cad(reference->setLayer(p.contains("layer")?named_symbol(db->layerTableId(),text(p,"layer")):db->clayer()));
            need(!tx.get<AcDbLayerTableRecord>(reference->layerId())->isLocked(),"SECURITY_DENIED","Layer is locked");
            AcDbBlockTableRecordIterator *raw=nullptr;cad(block->newIterator(raw));std::unique_ptr<AcDbBlockTableRecordIterator> it(raw);std::vector<AcDbAttributeDefinition*> definitions;std::set<std::string> known;
            for(;!it->done();it->step()){auto entity=tx.get<AcDbEntity>(iterator_id(it.get()));if(auto a=AcDbAttributeDefinition::cast(entity);a&&!a->isConstant()){need(definitions.size()<32,"DOC_BUSY","Attribute definition limit reached");AcString tag;cad(a->tag(tag));auto key=utf8(tag.kACharPtr());need(known.insert(key).second,"UNSUPPORTED_ON_PLATFORM","Duplicate attribute tags");definitions.push_back(a);}}
            for(auto v=values.begin();v!=values.end();++v)need(known.contains(v.key()),"TARGET_NOT_FOUND","Unknown attribute tag");
            auto model=tx.get<AcDbBlockTableRecord>(acdbSymUtil()->blockModelSpaceId(db),AcDb::kForWrite);check_cancel();cad(model->appendAcDbEntity(entityId,reference.get()));auto inserted=reference.release();cad(tx.manager->addNewlyCreatedDBRObject(inserted,true));
            for(auto definition:definitions){auto a=std::make_unique<AcDbAttribute>();cad(a->setAttributeFromBlock(definition,inserted->blockTransform()));AcString tag;cad(definition->tag(tag));auto key=utf8(tag.kACharPtr());if(values.contains(key))cad(a->setTextString(wide(attribute_string(values.at(key))).c_str()));
                AcDbObjectId id;cad(inserted->appendAttribute(id,a.get()));auto rawAttribute=a.release();cad(tx.manager->addNewlyCreatedDBRObject(rawAttribute,true));}
            result["created"].push_back(ref(db,inserted));expected=geometry(inserted,out);
        }else{
            need(method=="acad_set_attributes");const auto &er=p.at("entityRef");need(er.is_object()&&er.size()==3&&text(er,"documentId")==s.id&&number(er,"documentEpoch")==s.epoch);
            auto reference=tx.get<AcDbBlockReference>(object_id(db,text(er,"handle")),AcDb::kForWrite);writable_entity(db,reference);local_block(tx,reference->blockTableRecord());auto values=attribute_values(p);need(!values.empty());
            std::map<std::string,AcDbAttribute*> attributes;std::unique_ptr<AcDbObjectIterator> it(reference->attributeIterator());
            for(;!it->done();it->step()){need(attributes.size()<100,"DOC_BUSY","Attribute update limit reached");auto a=tx.get<AcDbAttribute>(it->objectId(),AcDb::kForWrite);AcString tag;cad(a->tag(tag));need(attributes.emplace(utf8(tag.kACharPtr()),a).second,"UNSUPPORTED_ON_PLATFORM","Duplicate attribute tags");}
            for(auto v=values.begin();v!=values.end();++v){auto a=attributes.find(v.key());need(a!=attributes.end(),"TARGET_NOT_FOUND","Unknown attribute tag");need(!a->second->isConstant(),"SECURITY_DENIED","Constant attribute cannot be changed");attribute_layer(a->second,tx);}
            for(auto v=values.begin();v!=values.end();++v){check_cancel();cad(attributes.at(v.key())->setTextString(wide(attribute_string(v.value())).c_str()));}
            entityId=reference->objectId();result["modified"].push_back(ref(db,reference));expected=geometry(reference,out);
        }
        check_cancel();test_fault("abort_before_commit");tx.commit();s.writing=false;s.revision++;cursors.clear();
    }catch(...){s.writing=false;throw;}
    result["revision"]=s.revision;
    try{
        if(defining){auto actual=block_definition(db,definitionId,out);need(same_geometry(actual,expected),"VERIFICATION_FAILED");result["createdBlocks"]=json::array({actual});}
        else{Transaction read(db);auto actual=geometry(read.get<AcDbEntity>(entityId),out);read.commit();need(same_geometry(actual,expected),"VERIFICATION_FAILED");result["observedGeometry"]={{"items",json::array({actual})},{"lengthUnit",p.value("lengthUnit",std::string("drawing_unit"))},{"coordinateSystem","WCS"}};}
        result["verified"]=true;
    }catch(...){result["status"]="failed";result["error"]={{"code","VERIFICATION_FAILED"},{"message","Committed block operation could not be verified"},{"retryable",false}};}
    return result;
}
json snapshot_blocks(AcDbDatabase *db){
    Transaction tx(db);auto table=tx.get<AcDbBlockTable>(db->blockTableId());AcDbBlockTableIterator *raw=nullptr;cad(table->newIterator(raw));std::unique_ptr<AcDbBlockTableIterator> it(raw);
    json blocks=json::object();std::size_t bytes=0;
    for(;!it->done();it->step()){AcDbObjectId id;cad(it->getRecordId(id));auto record=tx.get<AcDbBlockTableRecord>(id);if(record->isLayout()||record->isAnonymous()||record->isFromExternalReference())continue;
        need(blocks.size()<1000,"DOC_BUSY","Block snapshot limit reached");auto data=block_definition(db,id,1);bytes+=data.dump().size();need(bytes<350000,"DOC_BUSY","Block snapshot budget reached");blocks[data.at("name").get<std::string>()]=data;
    }tx.commit();return blocks;
}
