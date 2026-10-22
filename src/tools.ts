import { z } from 'zod';
import { BridgeError } from './protocol.js';

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const target = { instanceId: id, documentId: id, documentEpoch: integer.min(1) };
const point = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const unit = z.enum(['mm', 'm', 'inch', 'drawing_unit']);
const geom = { coordinateSystem: z.literal('WCS'), lengthUnit: unit };
const mutation = { ...target, operationId: id, expectedRevision: integer };
const entityRef = z.strictObject({ documentId: id, documentEpoch: integer.min(1), handle: z.string().regex(/^[0-9a-fA-F]{1,16}$/) });
const targets = z.array(entityRef).min(1).max(100);
const entityType = z.enum(['LINE', 'CIRCLE', '3DSOLID', 'TEXT', 'MTEXT', 'DIMENSION', 'ARC', 'LWPOLYLINE', 'INSERT','HATCH','REGION','TABLE','FCF','MLEADER']);
const projection = z.array(z.enum(['handle', 'type', 'layer', 'start', 'end', 'center', 'radius', 'size', 'extents', 'volume', 'text', 'position', 'height', 'width', 'rotation', 'dimensionKind', 'measurement', 'displayValue', 'dimensionScale', 'textPosition', 'linePoint', 'textHeight', 'arrowSize', 'precision', 'tolerance', 'leaderLength', 'style', 'vertices', 'bulges', 'closed', 'length', 'area', 'startAngle', 'endAngle', 'blockName', 'scale', 'attributes', 'attributeGeometry','pattern','patternScale','patternAngle','loopCount','rows','columnWidths','rowHeights','externalReference','leaderLineCount','terminator','terminatorSize','landingLength','landingDirection','contentKind','symbol','contentConnection','dimensionText','basic','limits','suppressed','decimalSeparator','measurementUnit','start2','end2','axis','origin','formattedText','trailingZeros','tolerancePrecision'])).min(1).max(64);
const readGeom = { coordinateSystem: z.literal('WCS'), lengthUnit: unit.default('drawing_unit'), projection: projection.optional() };
const layer = z.string().min(1).max(255).optional();
const xy = point.refine(p => p[2] === 0, 'Only WCS XY annotation is supported');
const plainText = z.string().min(1).max(1024).refine(s => !/[\u0000-\u0009\u000b-\u001f]/.test(s) && !s.includes('%<'), 'Fields and control characters are not allowed');
const layerName = z.string().min(1).max(128).refine(s => !/[<>/\\":;?*|=,\u0000-\u001f]/.test(s) && s.trim() === s, 'Invalid layer name');
const weights = [0,5,9,13,15,18,20,25,30,35,40,50,53,60,70,80,90,100,106,120,140,158,200,211];
const attributeText=z.string().max(256).refine(s=>!/[\u0000-\u001f]/.test(s)&&!s.includes('%<'),'Attribute fields are not accepted');
const attributeTag=z.string().regex(/^[A-Z][A-Z0-9_]{0,31}$/);
const attributeValues=z.record(attributeTag,attributeText).refine(p=>Object.keys(p).length<=32,'At most 32 attribute values');
const batchStep=z.discriminatedUnion('tool',[
 z.strictObject({tool:z.literal('acad_create_line'),start:point,end:point,layer}).refine(p=>p.start.some((n,i)=>n!==p.end[i])),
 z.strictObject({tool:z.literal('acad_create_circle'),center:xy,radius:z.number().positive().finite(),layer}),
 z.strictObject({tool:z.literal('acad_create_box'),center:point,size:point,layer}).refine(p=>p.size.every(n=>n>0)),
 z.strictObject({tool:z.literal('acad_create_polyline'),vertices:z.array(xy).min(2).max(512),closed:z.boolean(),layer}).refine(p=>!p.closed||p.vertices.length>=3).refine(p=>p.vertices.every((v,i)=>i===0||v.some((n,a)=>n!==p.vertices[i-1]![a]))).refine(p=>!p.closed||p.vertices[0]!.some((n,a)=>n!==p.vertices.at(-1)![a]))
]);

const leaderContent=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('none')}),
 z.strictObject({kind:z.literal('text'),text:plainText,height:z.number().positive().finite(),style:layerName.optional(),placement:z.enum(['above','after'])}),
 z.strictObject({kind:z.literal('block'),name:layerName,scale:z.number().positive().finite().default(1),attributes:attributeValues.default({})})
]);

const tolerance=z.strictObject({lower:z.number().finite().nonpositive(),upper:z.number().finite().nonnegative()});
// Preserve written decimal places, including trailing zeros, without inferring tolerances.
// Acceptance limits come from explicit tolerances, drawing notes or a referenced standard.
const writtenNumber=(s:string)=>Number(s.replace(',','.'));
const writtenSize=z.string().regex(/^[0-9]{1,4}([.,][0-9]{1,4})?$/,'Write the size as stated, e.g. 11 or 11,00').refine(s=>writtenNumber(s)>0,'Size must be positive');
const writtenDeviation=z.string().regex(/^(0([.,]0{1,4})?|[+-][0-9]{1,3}([.,][0-9]{1,4})?)$/,'Write the deviation as stated, e.g. +0,021, -0,013 or 0');
const holeFit=/^[A-Z]{1,2}(01|[0-9]|1[0-8])$/;
// ISO 286 tolerance class (hole upper case / shaft lower case + IT grade) or a hole/shaft fit.
const fitClass=/^(([A-Z]{1,2}(01|[0-9]|1[0-8])(\/[a-z]{1,2}(01|[0-9]|1[0-8]))?)|([a-z]{1,2}(01|[0-9]|1[0-8])))$/;
const notation=z.strictObject({
 kind:z.enum(['normal','theoretical_exact','reference','not_to_scale']).optional(),
 prefix:z.enum(['diameter','radius','spherical_diameter','spherical_radius','square','thickness']).optional(),
 count:z.number().int().min(2).max(999).optional(),
 fit:z.string().regex(fitClass).optional(),
 fitDeviations:z.strictObject({upper:writtenDeviation,lower:writtenDeviation}).refine(v=>writtenNumber(v.upper)>=writtenNumber(v.lower),'Upper deviation must not be below lower').optional(),
 limits:z.boolean().optional(),
 singleLimit:z.enum(['min','max']).optional(),
 sizeModifiers:z.array(z.enum(['E','LP','LS','GG','GX','GN','GC','CC','CA','CV','SX','SN','SA','SM','SD','SR','SQ','ACS','SCS','CT'])).max(4).refine(a=>new Set(a).size===a.length,'Duplicate size modifier').optional(),
 suppress:z.enum(['none','first','second']).optional()
});
const dimensionBase={...mutation,...geom,textHeight:z.number().positive().finite().optional(),arrowSize:z.number().positive().finite().optional(),precision:z.number().int().min(0).max(8).optional(),tolerance:tolerance.optional(),tolerancePrecision:z.number().int().min(0).max(8).optional(),layer,style:layerName.optional(),notation:notation.optional()};
const differ=(a:number[],b:number[])=>a.some((n,i)=>n!==b[i]);
const dimensionSchema=z.discriminatedUnion('kind',[
 z.strictObject({...dimensionBase,kind:z.literal('linear'),start:xy,end:xy,linePoint:xy,rotation:z.number().finite().default(0)}).refine(p=>differ(p.start,p.end),'Dimension points must differ').refine(p=>Math.abs((p.end[0]-p.start[0])*Math.cos(p.rotation)+(p.end[1]-p.start[1])*Math.sin(p.rotation))>1e-9,'Linear dimension must have nonzero projected length'),
 z.strictObject({...dimensionBase,kind:z.literal('aligned'),start:xy,end:xy,linePoint:xy}).refine(p=>differ(p.start,p.end),'Dimension points must differ'),
 z.strictObject({...dimensionBase,kind:z.literal('diameter'),start:xy,end:xy,linePoint:xy,leaderLength:z.number().nonnegative().finite().default(0)}).refine(p=>differ(p.start,p.end),'Dimension points must differ'),
 z.strictObject({...dimensionBase,kind:z.literal('radius'),start:xy,end:xy,linePoint:xy,leaderLength:z.number().nonnegative().finite().default(0)}).refine(p=>differ(p.start,p.end),'Dimension points must differ'),
 z.strictObject({...dimensionBase,kind:z.literal('angular'),start:xy,end:xy,start2:xy,end2:xy,linePoint:xy}).refine(p=>differ(p.start,p.end)&&differ(p.start2,p.end2),'Angular dimension lines need two distinct points'),
 z.strictObject({...dimensionBase,kind:z.literal('angular3'),center:xy,start:xy,end:xy,linePoint:xy}).refine(p=>differ(p.center,p.start)&&differ(p.center,p.end)&&differ(p.start,p.end),'Angle points must differ'),
 z.strictObject({...dimensionBase,kind:z.literal('arc_length'),center:xy,start:xy,end:xy,linePoint:xy}).refine(p=>differ(p.center,p.start)&&differ(p.start,p.end),'Arc points must differ'),
 z.strictObject({...dimensionBase,kind:z.literal('ordinate'),start:xy,end:xy,axis:z.enum(['x','y']),origin:xy.optional()}).refine(p=>differ(p.start,p.end),'Ordinate leader needs two points')
]).superRefine((p,ctx)=>{
 const n=p.notation??{},kind=n.kind??'normal',issue=(message:string)=>ctx.addIssue({code:'custom',message});
 if(n.fit&&p.tolerance)issue('Give a fit with fitDeviations, not tolerance');
 if(n.fitDeviations&&!n.fit)issue('fitDeviations require a fit');
 if(n.limits&&!p.tolerance)issue('Limit dimensions need explicit tolerance deviations');
 if(kind==='theoretical_exact'&&(p.tolerance||n.fit||n.limits||n.singleLimit||n.sizeModifiers))issue('Theoretically exact dimensions carry no tolerance');
 if(kind==='reference'&&(p.tolerance||n.fit||n.limits))issue('Reference dimensions carry no tolerance');
 if(n.singleLimit&&(p.tolerance||n.fit||n.limits))issue('A single limit replaces other tolerances');
 if(n.suppress&&n.suppress!=='none'&&p.kind!=='linear'&&p.kind!=='aligned')issue('Half dimensions apply to linear or aligned dimensions');
 if(['angular','angular3'].includes(p.kind)&&(n.prefix||n.fit||n.sizeModifiers))issue('Angular dimensions take no size prefix, fit or size modifier');
 // AutoCAD already renders Ø for diameter and R for radius dimensions; only the sphere form adds S.
 if(p.kind==='diameter'&&n.prefix&&!['diameter','spherical_diameter'].includes(n.prefix))issue('Diameter dimensions take only a diameter or spherical diameter prefix');
 if(p.kind==='radius'&&n.prefix&&!['radius','spherical_radius'].includes(n.prefix))issue('Radius dimensions take only a radius or spherical radius prefix');
});
const holeSize=writtenSize;
const holeCallout=z.strictObject({count:z.number().int().min(2).max(999).optional(),diameter:holeSize.optional(),fit:z.string().regex(holeFit).optional(),depth:holeSize.optional(),
 thread:z.strictObject({designation:z.string().regex(/^M[0-9]{1,3}([.,][0-9]{1,2})?(x[0-9]{1,2}([.,][0-9]{1,2})?)?(-[0-9][A-Hfgh]{1,2})?(-LH)?$/),depth:holeSize.optional()}).optional(),
 counterbore:z.strictObject({diameter:holeSize,depth:holeSize}).optional(),
 countersink:z.strictObject({diameter:holeSize,angle:writtenSize.refine(s=>writtenNumber(s)<180,'Countersink angle must be below 180')}).optional()
}).refine(h=>h.thread||h.diameter,'Hole diameter or thread is required').refine(h=>!(h.counterbore&&h.countersink),'Choose counterbore or countersink')
 .refine(h=>!h.thread||!(h.counterbore||h.countersink||h.fit),'Threaded callouts take only the tap drill diameter and depth')
 .refine(h=>!h.counterbore||(h.diameter!==undefined&&writtenNumber(h.counterbore.diameter)>writtenNumber(h.diameter)),'Counterbore must be wider than the hole')
 .refine(h=>!h.countersink||(h.diameter!==undefined&&writtenNumber(h.countersink.diameter)>writtenNumber(h.diameter)),'Countersink must be wider than the hole');

export const toolSchemas = {
  acad_list_instances: z.strictObject({}),
  acad_get_status: z.strictObject({ instanceId: id }),
  acad_get_capabilities: z.strictObject({ instanceId: id, documentId: id.optional(), documentEpoch: integer.min(1).optional() })
    .refine(x => (x.documentId === undefined) === (x.documentEpoch === undefined), 'Document identity requires both fields'),
  acad_list_documents: z.strictObject({ instanceId: id }),
  acad_get_document_info: z.strictObject(target),
  acad_list_layers: z.strictObject(target),
  acad_list_styles: z.strictObject(target),
  acad_get_plot_devices: z.strictObject(target),
  acad_list_layouts: z.strictObject(target),
  acad_create_layout: z.strictObject({...mutation,...geom,name:layerName,device:z.enum(['DWG To PDF.pc3','AutoCAD PDF (General Documentation).pc3']),media:z.string().min(1).max(255).refine(s=>!/[\\/\u0000-\u001f]/.test(s)),rotation:z.enum(['0','90']).default('0'),viewport:z.strictObject({paperCenter:z.tuple([z.number().positive().finite(),z.number().positive().finite()]),paperSize:z.tuple([z.number().positive().finite(),z.number().positive().finite()]),modelCenter:point,direction:z.enum(['top','front','right','isometric']),scale:z.number().positive().finite()})}),
  acad_export_pdf: z.strictObject({...mutation,layoutName:layerName,outputRootId:id,relativePath:z.string().min(1).max(255),overwrite:z.literal(false)}),
  acad_list_xrefs: z.strictObject(target),
  acad_attach_xref: z.strictObject({...mutation,...geom,inputRootId:z.literal('session-input'),relativePath:z.string().min(1).max(255),name:layerName,position:point,scale:z.number().positive().finite().default(1),rotation:z.number().finite().default(0),overlay:z.boolean().default(true),layer}),
  acad_manage_xref: z.strictObject({...mutation,name:layerName,mode:z.enum(['reload','unload','bind','detach']),targets}),
  acad_run_batch: z.strictObject({...mutation,...geom,steps:z.array(batchStep).min(1).max(24)}),
  acad_get_view: z.strictObject({...target,coordinateSystem:z.literal('WCS'),lengthUnit:unit.default('drawing_unit')}),
  acad_set_view: z.strictObject({...mutation,...geom,center:point,direction:z.enum(['top','front','right','isometric']),height:z.number().positive().finite()}),
  acad_create_style: z.discriminatedUnion('kind',[
    z.strictObject({...mutation,kind:z.literal('text'),name:layerName,font:z.enum(['arial.ttf','txt.shx']),widthFactor:z.number().positive().max(10).default(1)}),
    z.strictObject({...mutation,...geom,kind:z.literal('dimension'),name:layerName,textStyle:layerName,textHeight:z.number().positive().finite(),arrowSize:z.number().positive().finite(),precision:z.number().int().min(0).max(8)}),
    z.strictObject({...mutation,...geom,kind:z.literal('linetype'),name:layerName,dashes:z.array(z.number().finite()).min(2).max(16).refine(a=>a.some(v=>v>0)&&a.some(v=>v<0),'Pattern requires ink and a gap')})
  ]),
  acad_get_block: z.strictObject({...target,coordinateSystem:z.literal('WCS'),lengthUnit:unit.default('drawing_unit'),name:layerName}),
  acad_define_block: z.strictObject({...mutation,...geom,name:layerName,basePoint:xy,targets,attributes:z.array(z.strictObject({tag:attributeTag,prompt:attributeText,defaultValue:attributeText,position:xy,height:z.number().positive().finite(),visible:z.boolean().default(true)})).max(32).default([])}).refine(p=>new Set(p.attributes.map(a=>a.tag)).size===p.attributes.length,'Attribute tags must be unique'),
  acad_insert_block: z.strictObject({...mutation,...geom,name:layerName,position:xy,rotation:z.number().finite().default(0),scale:z.number().positive().finite().default(1),attributes:attributeValues.default({}),layer}),
  acad_set_attributes: z.strictObject({...mutation,entityRef,attributes:attributeValues.refine(p=>Object.keys(p).length>0,'At least one attribute required')}),
  acad_create_layer: z.strictObject({ ...mutation, name: layerName, colorIndex: z.number().int().min(1).max(255), lineweight: z.number().int().refine(n=>weights.includes(n)).default(25), linetype:layerName.optional() }),
  acad_create_text: z.strictObject({ ...mutation, ...geom, position: xy, text: plainText.refine(s=>!/[\r\n\t]/.test(s)), height: z.number().positive().finite(), rotation: z.number().finite().default(0), layer, style: layerName.optional() }),
  acad_create_mtext: z.strictObject({ ...mutation, ...geom, position: xy, text: plainText, height: z.number().positive().finite(), width: z.number().positive().finite(), rotation: z.number().finite().default(0), layer, style: layerName.optional() }),
  acad_create_dimension: dimensionSchema,
  acad_query_entities: z.strictObject({ ...target, ...readGeom, filter: z.strictObject({ type: entityType.optional(), layer: z.string().min(1).max(255).optional() }), limit: integer.min(1).max(1000).default(100), cursor: z.string().min(1).max(4096).optional() }),
  acad_get_entity: z.strictObject({ ...target, ...readGeom, entityRef }),
  acad_create_line: z.strictObject({ ...mutation, ...geom, start: point, end: point, layer }).refine(x => x.start.some((n, i) => n !== x.end[i]), 'Line must have nonzero length'),
  acad_create_circle: z.strictObject({ ...mutation, ...geom, center: point, radius: z.number().positive().finite(), normal: point.default([0, 0, 1]), layer }).refine(x => x.normal[0] === 0 && x.normal[1] === 0 && x.normal[2] === 1, 'Only WCS XY circles supported'),
  acad_create_arc: z.strictObject({...mutation,...geom,center:xy,radius:z.number().positive().finite(),startAngle:z.number().finite(),endAngle:z.number().finite(),layer}).refine(p=>Math.abs(Math.sin((p.endAngle-p.startAngle)/2))>1e-9,'Arc cannot be empty or a full circle'),
  acad_create_polyline: z.strictObject({...mutation,...geom,vertices:z.array(xy).min(2).max(512),closed:z.boolean(),layer}).refine(p=>!p.closed||p.vertices.length>=3,'Closed polyline requires three vertices').refine(p=>p.vertices.every((v,i)=>i===0||v.some((n,a)=>n!==p.vertices[i-1]![a])),'Consecutive vertices must differ').refine(p=>!p.closed||p.vertices[0]!.some((n,a)=>n!==p.vertices.at(-1)![a]),'Closing vertex is implicit'),
  acad_create_box: z.strictObject({ ...mutation, ...geom, center: point, size: point, layer }).refine(x => x.size.every(n => n > 0), 'Box size must be positive'),
  acad_extrude: z.strictObject({...mutation,...geom,entityRef,height:z.number().finite().refine(n=>n!==0),keepProfile:z.boolean().default(true),layer}),
  acad_revolve: z.strictObject({...mutation,...geom,entityRef,axisStart:xy,axisEnd:xy,angle:z.number().positive().max(2*Math.PI),keepProfile:z.boolean().default(true),layer}).refine(p=>p.axisStart.some((n,i)=>n!==p.axisEnd[i]),'Revolution axis requires different points'),
  acad_boolean: z.strictObject({...mutation,...geom,entityRef,tools:z.array(entityRef).min(1).max(16),operation:z.enum(['union','subtract','intersect']),keepTools:z.boolean().default(true)}),
  acad_get_mass_properties: z.strictObject({...target,coordinateSystem:z.literal('WCS'),lengthUnit:unit.default('drawing_unit'),entityRef,densityKgM3:z.number().positive().finite().optional()}),
  acad_section_solid: z.strictObject({...mutation,...geom,entityRef,origin:point,normal:point,layer}).refine(p=>p.normal.some(n=>n!==0),'Section normal cannot be zero'),
  acad_create_hatch: z.strictObject({...mutation,...geom,targets:z.array(entityRef).min(1).max(33),pattern:z.enum(['SOLID','ANSI31']),scale:z.number().positive().finite().default(1),angle:z.number().finite().default(0),layer}),
  acad_create_table: z.strictObject({...mutation,...geom,position:xy,rows:z.array(z.array(attributeText.refine(s=>!/[\\{}]/.test(s),'Table formatting is not accepted')).min(1).max(10)).min(1).max(100),columnWidths:z.array(z.number().positive().finite()).min(1).max(10),rowHeight:z.number().positive().finite(),textHeight:z.number().positive().finite(),layer}).refine(p=>p.rows.every(row=>row.length===p.columnWidths.length),'All rows must match columnWidths'),
  acad_get_bom: z.strictObject({...target,targets,groupBy:z.array(attributeTag).min(1).max(8)}).refine(p=>new Set(p.groupBy).size===p.groupBy.length,'BOM grouping keys must be unique'),
  acad_drill_holes: z.strictObject({...mutation,...geom,entityRef,centers:z.array(point).min(1).max(64),diameter:z.number().positive().finite(),depth:z.number().positive().finite(),direction:z.enum(['positive_z','negative_z']),entry:z.discriminatedUnion('kind',[
    z.strictObject({kind:z.literal('plain')}),
    z.strictObject({kind:z.literal('counterbore'),diameter:z.number().positive().finite(),depth:z.number().positive().finite()}),
    z.strictObject({kind:z.literal('countersink'),diameter:z.number().positive().finite(),depth:z.number().positive().finite()})
  ]).default({kind:'plain'})}).refine(p=>p.entry.kind==='plain'||(p.entry.diameter>p.diameter&&p.entry.depth<=p.depth),'Entry diameter must exceed the hole; entry depth cannot exceed total depth'),
  acad_create_shaft: z.strictObject({...mutation,...geom,base:point,segments:z.array(z.strictObject({length:z.number().positive().finite(),diameter:z.number().positive().finite()})).min(1).max(32),layer}),
  acad_create_feature_control_frame: z.strictObject({...mutation,...geom,position:xy,characteristic:z.enum(['position','parallelism','perpendicularity','angularity','flatness','roundness','cylindricity','straightness','surface_profile','line_profile','circular_runout','total_runout']),tolerance:z.number().positive().finite(),diameterZone:z.boolean().default(false),materialCondition:z.enum(['none','MMC','LMC']).default('none'),datums:z.array(z.string().regex(/^[A-Z]{1,3}$/)).max(3).default([]),textHeight:z.number().positive().finite(),layer}),
  acad_move_entities: z.strictObject({ ...mutation, ...geom, targets, delta: point }),
  acad_transform_entities: z.discriminatedUnion('mode',[
    z.strictObject({...mutation,...geom,targets,mode:z.literal('copy'),delta:xy}),
    z.strictObject({...mutation,...geom,targets,mode:z.literal('rotate'),center:xy,angle:z.number().finite(),copy:z.boolean().default(false)}),
    z.strictObject({...mutation,...geom,targets,mode:z.literal('scale'),center:xy,factor:z.number().positive().finite(),copy:z.boolean().default(false)}),
    z.strictObject({...mutation,...geom,targets,mode:z.literal('mirror'),lineStart:xy,lineEnd:xy,copy:z.boolean().default(true)}).refine(p=>p.lineStart.some((v,i)=>v!==p.lineEnd[i]),'Mirror line requires different points'),
    z.strictObject({...mutation,...geom,targets,mode:z.literal('linear_array'),count:z.number().int().min(2).max(100),step:xy}).refine(p=>p.targets.length*(p.count-1)<=100&&p.step.some(v=>v!==0),'Array must be nonzero and create at most 100 copies'),
    z.strictObject({...mutation,...geom,targets,mode:z.literal('circular_array'),count:z.number().int().min(2).max(100),center:xy,angleStep:z.number().finite()}).refine(p=>p.targets.length*(p.count-1)<=100&&Math.abs(Math.sin(p.angleStep/2))>1e-9,'Array requires a nonzero angle and at most 100 copies')
  ]),
  acad_offset_entity: z.strictObject({...mutation,...geom,entityRef,distance:z.number().positive().finite(),sidePoint:xy}),
  acad_edit_curve: z.discriminatedUnion('mode',[
    z.strictObject({...mutation,...geom,entityRef,boundaries:z.array(entityRef).min(1).max(32),mode:z.literal('trim'),keepPoint:xy}),
    z.strictObject({...mutation,...geom,entityRef,boundaries:z.array(entityRef).min(1).max(32),mode:z.literal('extend'),end:z.enum(['start','end'])})
  ]),
  acad_corner: z.discriminatedUnion('kind',[
    z.strictObject({...mutation,...geom,targets:z.array(entityRef).length(2),kind:z.literal('fillet'),radius:z.number().positive().finite(),trim:z.boolean().default(true)}),
    z.strictObject({...mutation,...geom,targets:z.array(entityRef).length(2),kind:z.literal('chamfer'),distanceA:z.number().positive().finite(),distanceB:z.number().positive().finite(),trim:z.boolean().default(true)})
  ]),
  acad_erase_entities: z.strictObject({ ...mutation, targets }),
  acad_setup_drawing_standard: z.strictObject({...mutation,standard:z.literal('ISO'),lineGroup:z.literal([0.25,0.35,0.5,0.7,1]),textHeight:z.literal([1.8,2.5,3.5,5,7,10,14,20]),decimalSeparator:z.enum(['comma','point']),precision:z.number().int().min(0).max(4),viewScale:z.number().positive().finite().default(1),prefix:z.string().regex(/^[A-Z][A-Z0-9]{0,11}$/).default('ISO')}),
  acad_create_leader: z.strictObject({...mutation,...geom,vertices:z.array(xy).min(2).max(16),terminator:z.enum(['arrow','dot','none']),terminatorSize:z.number().positive().finite(),landingLength:z.number().nonnegative().finite(),landingDirection:z.enum(['left','right']),content:leaderContent,layer}).refine(p=>p.vertices.every((v,i)=>i===0||v.some((n,a)=>n!==p.vertices[i-1]![a])),'Consecutive leader vertices must differ'),
  acad_create_dimension_series: z.strictObject({...mutation,...geom,mode:z.enum(['chain','baseline']),points:z.array(xy).min(2).max(33),rotation:z.number().finite().default(0),linePoint:xy,spacing:z.number().positive().finite().optional(),textHeight:z.number().positive().finite().optional(),arrowSize:z.number().positive().finite().optional(),precision:z.number().int().min(0).max(8).optional(),style:layerName.optional(),layer})
   .refine(p=>(p.mode==='baseline')===(p.spacing!==undefined),'Baseline series require spacing; chain series take none')
   .refine(p=>p.points.every((v,i)=>{if(i===0)return true;const o=p.mode==='chain'?p.points[i-1]!:p.points[0]!;return Math.abs((v[0]-o[0])*Math.cos(p.rotation)+(v[1]-o[1])*Math.sin(p.rotation))>1e-9;}),'Every dimension needs a nonzero projected length'),
  acad_create_hole_callout: z.strictObject({...mutation,...geom,vertices:z.array(xy).min(2).max(16),terminator:z.enum(['arrow','dot','none']),terminatorSize:z.number().positive().finite(),landingLength:z.number().nonnegative().finite(),landingDirection:z.enum(['left','right']),textHeight:z.number().positive().finite(),style:layerName.optional(),layer,decimalSeparator:z.enum(['comma','point']),hole:holeCallout,circle:entityRef.optional()})
   .refine(p=>p.vertices.every((v,i)=>i===0||differ(v,p.vertices[i-1]!)),'Consecutive leader vertices must differ').refine(p=>!p.circle||p.hole.diameter!==undefined,'A circle check needs the hole diameter'),
  acad_get_operation_status: z.strictObject({ ...target, operationId: id }),
  acad_save_copy: z.strictObject({ ...mutation, outputRootId: id, relativePath: z.string().min(1).max(4096), overwrite: z.literal(false) })
};
export type ToolName = keyof typeof toolSchemas;
export const toolNames = Object.keys(toolSchemas) as ToolName[];
export const mutating = new Set<ToolName>(['acad_create_dimension_series','acad_create_hole_callout','acad_setup_drawing_standard','acad_create_leader','acad_set_view','acad_run_batch','acad_attach_xref','acad_manage_xref','acad_create_layout','acad_export_pdf','acad_drill_holes','acad_create_shaft','acad_create_feature_control_frame','acad_section_solid','acad_create_hatch','acad_create_table','acad_extrude','acad_revolve','acad_boolean','acad_create_line', 'acad_create_circle', 'acad_create_arc', 'acad_create_polyline', 'acad_create_box', 'acad_create_layer', 'acad_create_style', 'acad_define_block', 'acad_insert_block', 'acad_set_attributes', 'acad_create_text', 'acad_create_mtext', 'acad_create_dimension', 'acad_move_entities', 'acad_transform_entities', 'acad_offset_entity', 'acad_edit_curve', 'acad_corner', 'acad_erase_entities', 'acad_save_copy']);
export const descriptions: Record<ToolName, string> = {
  acad_list_instances: 'List explicitly paired local AutoCAD instances. No active-tab fallback.',
  acad_get_status: 'Read bridge/backend status; simulated backends are identified explicitly.',
  acad_get_capabilities: 'Read actual operations supported by the paired plugin.',
  acad_list_documents: 'List open drawings and their explicit identity, revision and units.',
  acad_get_document_info: 'Read drawing metadata without changing the current drawing.',
  acad_list_styles: 'Read bounded native text/dimension style and linetype metadata.',
  acad_get_plot_devices: 'Read installed allowlisted PDF plot devices and canonical media names. No physical printer or arbitrary PC3 path is accepted.',
  acad_list_layouts: 'Read bounded layout names, paper settings and paper/model viewport geometry. Paper dimensions are millimetres; model viewport coordinates use drawing units.',
  acad_create_layout: 'Create a new PDF-configured paper layout with one locked model viewport. Paper center/size are millimetres; modelCenter uses lengthUnit; scale is paper-mm/model-mm (1 means 1:1). Direction is explicit. Existing layouts and model geometry are preserved.',
  acad_export_pdf: 'Plot one explicit existing paper layout to a NEW flat PDF filename in the private authorized output root. Physical printers and overwrite are forbidden. The active layout is restored. PDF generation is a separate filesystem side effect; reconcile operation status after timeout.',
  acad_list_xrefs: 'Read bounded xref names, overlay/unloaded state and basename only. Does not resolve or reload external files.',
  acad_attach_xref: 'Attach/overlay one DWG already staged in the private session-input root. No arbitrary paths, URLs, nested xrefs, image/underlay/datalink dependencies or custom entities are accepted in this initial importer. Place one explicit modelspace reference with uniform scale and Z rotation. Source file is read only.',
  acad_manage_xref: 'Reload, unload, bind or detach one named top-level xref. targets must enumerate ALL direct modelspace references; hidden/nested/paperspace references are rejected. Reload/bind accepts only a validated DWG in session-input. Detach erases those explicit references. Xref files are never deleted or modified.',
  acad_run_batch: 'Run up to 24 typed create_line/create_circle/create_box/create_polyline steps in one atomic transaction with one operationId and one final revision. All steps share explicit WCS/units and must be separately granted. Any failing step rolls back the entire batch. No raw commands, LISP, shell, external files or nested batches.',
  acad_get_view: 'Read the current modelspace camera target, direction, height, width and view-center offset in explicit units. Paper layouts are excluded.',
  acad_set_view: 'Set the explicit modelspace camera center, top/front/right/isometric direction and visible height. Width follows the current viewport aspect ratio. Coordinates/height use lengthUnit. Drawing entities are preserved; native camera values are reread.',
  acad_create_style: 'Create a new text, dimension or simple dash-pattern linetype style; no font paths or external LIN files. Font choices are installed arial.ttf and bundled txt.shx. Existing names are rejected. Dimension/linetype sizes require explicit units.',
  acad_get_block: 'Read a named local non-layout/non-xref/non-anonymous block definition and attribute defaults in explicit units. Bounded to 132 definition objects.',
  acad_define_block: 'Define a new block from up to 100 explicitly referenced planar curves/TEXT/MTEXT; originals are preserved. basePoint becomes the block origin. Up to 32 plain attribute definitions use block-local positions. No nested blocks or measurement dimensions in this initial definition tool.',
  acad_insert_block: 'Insert an existing local block with uniform positive scale and Z rotation; explicitly set known plain attribute values. Placement uses lengthUnit; attributes follow the block transform.',
  acad_set_attributes: 'Update only explicitly named non-constant plain attributes of one modelspace block reference. Unknown tags and locked layers are rejected atomically.',
  acad_list_layers: 'Read up to 1000 layer records with names, colors, lineweights and lock state.',
  acad_create_layer: 'Create one new unlocked continuous-line layer with explicit ACI color and lineweight in hundredths of a millimetre. Existing names are rejected.',
  acad_create_text: 'Create plain single-line native TEXT in WCS XY; rotation is radians. Field expressions are rejected.',
  acad_create_mtext: 'Create plain multiline native MTEXT in WCS XY with explicit width; formatting is escaped. Rotation is radians.',
  acad_create_dimension: 'Create a non-associative native DIMENSION from explicit points: linear/aligned, diameter (opposite chord endpoints), radius (start=center, end=chord), angular (two lines start/end and start2/end2, linePoint on the arc), angular3 (center and two points), arc_length (center and two points on one circle) or ordinate (feature point, leader end, axis x/y from origin). Coordinates and text/arrow size use lengthUnit, rotation radians; angles are measured in radians and displayed in degrees. The measured value is never overridden: optional notation only adds ISO symbols around it (count n×, Ø/R/SØ/SR/square/t= prefix, theoretically exact frame, reference parentheses, not-to-scale underline, ISO 286 fit class with optional written deviations such as "+0,021"/"0", limit dimension from tolerance, min/max single limit, ISO 14405 size modifiers, half dimension). Tolerance lower<=0, upper>=0 are explicit deviations. Displayed decimals equal precision (tolerancePrecision for deviations), with trailing zeros kept. Display precision does not determine a tolerance: obtain it from the dimension, applicable title-block notes or a referenced standard; use decimal-place mappings only when explicitly specified. Definition points do not follow later geometry edits.',
  acad_query_entities: 'Read bounded modelspace entity projections with a revision-bound cursor.',
  acad_get_entity: 'Read one entity from its explicit drawing and epoch.',
  acad_create_line: 'Create a modelspace WCS line with explicit length units and read it back.',
  acad_create_circle: 'Create a modelspace WCS XY circle with explicit units and verify its radius.',
  acad_create_arc: 'Create a counterclockwise WCS XY ARC from center/radius and start/end angles in radians. Empty/full-circle arcs are rejected.',
  acad_create_polyline: 'Create an open or closed straight-segment native LWPOLYLINE in WCS XY; closing segment is implicit. Up to 512 vertices, no duplicate adjacent vertices.',
  acad_create_box: 'Create an axis-aligned modelspace solid box and read back volume and extents.',
  acad_extrude: 'Extrude one closed WCS XY CIRCLE/LWPOLYLINE profile along Z, without taper. Height uses lengthUnit and may be negative. Preserve the profile by default; explicitly keepProfile=false erases it atomically with creation.',
  acad_revolve: 'Revolve one closed WCS XY CIRCLE/LWPOLYLINE around an explicit in-plane axis. Angle is positive radians, at most 2*pi. Preserve the profile by default. Self-intersecting or invalid profiles are rejected by the native modeler.',
  acad_boolean: 'Union, subtract or intersect one explicit modelspace 3DSOLID with up to 16 distinct solid tools. Compute on detached copies, then atomically erase the target and create a NEW solid with a NEW entityRef. Tool entities are preserved unless keepTools=false. Empty or failed results have no drawing effect.',
  acad_get_mass_properties: 'Read native solid volume, surface area, centroid and bounds with explicit length/area/volume units. Mass in kg is returned only with user-supplied densityKgM3 and known drawing units; no material density is inferred.',
  acad_section_solid: 'Intersect one solid with an explicit WCS plane and create a native planar REGION, preserving the source. origin uses lengthUnit; normal is a unitless nonzero direction. Empty sections are rejected.',
  acad_create_hatch: 'Create a non-associative native SOLID or ANSI31 hatch from one outer closed XY CIRCLE/LWPOLYLINE and up to 32 inner loops. Targets are ordered outer first, then holes. Sources are preserved. Angle uses radians; ANSI31 scale multiplies the pattern base unit in lengthUnit.',
  acad_create_table: 'Create a plain native modelspace TABLE with explicit rectangular cells, column widths, row/text height and top-left WCS XY position. No fields or formulas; at most 100 rows by 10 columns.',
  acad_get_bom: 'Read selected modelspace INSERT attributes and group identical block names and explicit attribute keys with quantities. Missing keys fail explicitly; nested contents are not expanded. Read only, no inferred material or standard part data.',
  acad_drill_holes: 'Cut up to 64 explicit cylindrical holes along +Z or -Z in one solid, with optional explicit counterbore or conical countersink entry. Centers are entry-plane WCS points. Every hole must remove material; failure preserves all source geometry. Returns a new solid entityRef and measured removed volume. No thread geometry or inferred fastener standards.',
  acad_create_shaft: 'Create one stepped coaxial solid along +Z from an explicit base and up to 32 length/diameter segments. No inferred standard sizes; no persistent parametric constraints.',
  acad_create_feature_control_frame: 'Create one native FCF geometric tolerance frame with an explicit characteristic, tolerance, optional diameter/material condition and up to three datum labels. Dimensions use lengthUnit. This encodes the chosen annotation; it does not validate the engineering choice or certify ISO compliance.',
  acad_move_entities: 'Translate explicitly referenced native entities and verify resulting geometry.',
  acad_transform_entities: 'Copy, rotate, uniformly scale, mirror, or make linear/circular arrays of WCS XY LINE/CIRCLE/ARC/LWPOLYLINE entities. Angles are radians; count includes the original; at most 100 created copies. Dimensions/text/solids are intentionally excluded. Entity geometry is reread after one transaction.',
  acad_offset_entity: 'Offset a WCS XY LINE/CIRCLE/ARC/LWPOLYLINE a positive distance toward sidePoint; source is preserved. Ambiguous or impossible offsets are rejected; result curves are verified.',
  acad_edit_curve: 'Trim a planar curve against explicit boundaries and retain the segment nearest keepPoint, replacing the source atomically; or extend only a LINE start/end to the nearest forward boundary intersection. Boundaries are never changed.',
  acad_corner: 'Fillet or chamfer exactly two WCS XY LINE segments sharing one endpoint; no implicit extension. Radius or both distances must fit inside segments. Optionally trim original endpoints in the same transaction.',
  acad_erase_entities: 'Erase explicit modelspace entities in one transaction.',
  acad_setup_drawing_standard: 'Create an ISO drawing profile in one transaction: ISO 3098 lettering style (isocp.shx), ISO 128-2 thin dashed/long-dash dotted/long-dash double-dotted linetypes for the chosen line group, ten prefixed layers (visible, thin, hidden, center, cutting plane, phantom, dimension, hatch, text, symbol) with thick/thin/lettering lineweights, an ISO dimension style and PSLTSCALE=1. lineGroup is the thick width in mm (thin is half); textHeight is paper mm; viewScale is paper-mm/model-mm (1 means 1:1). precision is the style default; trailing zeros are always kept because written decimals state the required precision. Existing names are rejected, nothing is overwritten. The result lists the basis of every numeric choice and reports verification pending the full ISO text.',
  acad_create_leader: 'Create one native MLEADER: straight leader through explicit WCS XY vertices (first = terminator point on the feature, last = start of the reference line), ISO terminator arrow/dot/none with explicit size, optional horizontal reference line (landingLength 0 disables it) and none/plain text/local block content. Text placement above sits on the reference line; after continues it. Block content connects at its base point at the end of the reference line; only existing non-constant attribute tags can be set. Vertices, terminator, landing and content are read back.',
  acad_create_dimension_series: 'Create a chain (consecutive) or baseline (common origin) series of measured linear dimensions in one transaction. points are the explicit feature points in order; linePoint places the first dimension line; baseline lines step by spacing away from the points. Every member is read back like acad_create_dimension.',
  acad_create_hole_callout: 'Create an ISO 15786-style simplified hole indication as a native MLEADER: count n×, Ø diameter with optional ISO 286 hole class, ×depth, counterbore (⌴Ø×depth) or countersink (⌵Ø×angle), or metric thread designation with ×depth and optional tap drill. Sizes are written decimal strings ("6,6", "11,00") reproduced exactly, including trailing zeros; only the separator follows decimalSeparator. Written decimal places do not by themselves define a tolerance; use the dimension, applicable title-block notes or a referenced standard. Values come only from the request; pass circle to check the noted diameter against a real CIRCLE. Callout layout is pending full-text verification.',
  acad_get_operation_status: 'Reconcile an operation after timeout. Missing records do not prove no effect.',
  acad_save_copy: 'Write a new authorized DWG copy without replacing existing files or renaming the source.'
};

export function validateTool(name: ToolName, input: unknown): Record<string, unknown> {
  const parsed = toolSchemas[name].parse(input) as Record<string, unknown>;
  const refs = [...((parsed.targets ?? (parsed.entityRef ? [parsed.entityRef] : [])) as Array<z.infer<typeof entityRef>>), ...((parsed.boundaries??[]) as Array<z.infer<typeof entityRef>>), ...((parsed.tools??[]) as Array<z.infer<typeof entityRef>>), ...(parsed.circle ? [parsed.circle as z.infer<typeof entityRef>] : [])];
  const unique = new Set<string>();
  for (const ref of refs) {
    const key = ref.handle.toUpperCase();
    if (ref.documentId !== parsed.documentId || ref.documentEpoch !== parsed.documentEpoch || unique.has(key)) throw new Error('Invalid entity target');
    unique.add(key);
  }
  if (parsed.projection && new Set(parsed.projection as string[]).size !== (parsed.projection as string[]).length) throw new Error('Duplicate projection');
  if (name === 'acad_save_copy'||name==='acad_export_pdf'||name==='acad_attach_xref') {
    const p = parsed.relativePath as string;
    if (p.length > 255 || !(name==='acad_export_pdf'?/\.pdf$/i:/\.dwg$/i).test(p) || /[\x00-\x1f:\\/*?"<>|]/.test(p) || /[. ]$/.test(p) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p)) throw new BridgeError('OUTPUT_PATH_DENIED', 'Only a flat authorized filename is accepted');
  }
  return parsed;
}
