import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { copyFile,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const source=join(root,'source.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
const near=(a:number,b:number)=>Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-7);
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const query=()=>session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},limit:1000});
 const mutate=async(name:ToolName,args:any,spatial=true,error?:string)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(error){check(name+' rejects '+error,reply.isError&&result.error.code===error&&result.applied===false);return result;}
  if(reply.isError){await writeFile(join(root,'failed-readback.json'),JSON.stringify(await query(),null,2));throw Error(name+': '+result?.error?.code);}
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const mass=(entityRef:any,lengthUnit='mm',densityKgM3?:number)=>session.call('acad_get_mass_properties',{...session.target,coordinateSystem:'WCS',lengthUnit,entityRef,...(densityKgM3?{densityKgM3}:{})});
 // Symmetric 80x40 notched plate; outer area 2400 mm², centre hole Ø10.
 const vertices=[[-40,-20,0],[-10,-20,0],[-10,-15,0],[10,-15,0],[10,-20,0],[40,-20,0],[40,-10,0],[25,-10,0],[25,10,0],[40,10,0],[40,20,0],[10,20,0],[10,15,0],[-10,15,0],[-10,20,0],[-40,20,0],[-40,10,0],[-25,10,0],[-25,-10,0],[-40,-10,0]];
 const profile=await mutate('acad_create_polyline',{vertices,closed:true});check('plate profile area is 2400',near(profile.observedGeometry.items[0].area,2400));
 const plate=await mutate('acad_extrude',{entityRef:profile.created[0],height:10,keepProfile:false});check('plate extrusion volume',near(plate.observedGeometry.items[0].volume,24000));
 const circle=await mutate('acad_create_circle',{center:[0,0,0],radius:5});const hole=await mutate('acad_extrude',{entityRef:circle.created[0],height:10,keepProfile:false});
 const cut=await mutate('acad_boolean',{entityRef:plate.created[0],tools:hole.created,operation:'subtract',keepTools:false});const part=cut.created[0];
 check('boolean returns new solid and erases explicit operands',cut.erased.length===2&&part.handle!==plate.created[0].handle);
 const expected=(2400-25*Math.PI)*10,properties=await mass(part,'mm',7850);
 check('real through hole volume',near(properties.volume,expected));check('surface area includes internal cylindrical face',near(properties.area,2*(2400-25*Math.PI)+(320+10*Math.PI)*10));
 check('centroid and explicit-density mass',near(properties.centroid[0],0)&&near(properties.centroid[1],0)&&near(properties.centroid[2],5)&&near(properties.massKg,expected*1e-9*7850));
 const metres=await mass(part,'m');check('mass omitted without density and cubic units converted',!('massKg'in metres)&&near(metres.volume,expected*1e-9)&&near(metres.area,properties.area*1e-6));
 const revProfile=await mutate('acad_create_polyline',{vertices:[[100,0,0],[105,0,0],[105,10,0],[100,10,0]],closed:true});
 const revolved=await mutate('acad_revolve',{entityRef:revProfile.created[0],axisStart:[100,0,0],axisEnd:[100,10,0],angle:2*Math.PI,keepProfile:true});check('revolve produces cylinder',near(revolved.observedGeometry.items[0].volume,250*Math.PI));
 const a=await mutate('acad_create_box',{center:[200,0,5],size:[10,10,10]}),b=await mutate('acad_create_box',{center:[205,0,5],size:[10,10,10]});
 const intersection=await mutate('acad_boolean',{entityRef:a.created[0],tools:b.created,operation:'intersect',keepTools:true});check('intersection volume and tool preservation',near(intersection.observedGeometry.items[0].volume,500)&&(await query()).items.some((e:any)=>e.handle===b.created[0].handle));
 const c=await mutate('acad_create_box',{center:[220,0,5],size:[10,10,10]}),d=await mutate('acad_create_box',{center:[225,0,5],size:[10,10,10]});
 const union=await mutate('acad_boolean',{entityRef:c.created[0],tools:d.created,operation:'union',keepTools:false});check('union volume',near(union.observedGeometry.items[0].volume,1500));
 const before=await query(),revision=(await info()).revision;
 await mutate('acad_boolean',{entityRef:part,tools:revolved.created,operation:'intersect',keepTools:false},true,'VALIDATION_FAILED');
 check('empty intersection leaves all operands and revision unchanged',(await info()).revision===revision&&JSON.stringify((await query()).items)===JSON.stringify(before.items));
 const negativeProfile=await mutate('acad_create_circle',{center:[300,0,0],radius:2});const negative=await mutate('acad_extrude',{entityRef:negativeProfile.created[0],height:-5,keepProfile:false});check('negative extrusion follows -Z',near(negative.observedGeometry.items[0].volume,20*Math.PI)&&near(negative.observedGeometry.items[0].extents.min[2],-5));
 const clockwise=await mutate('acad_create_polyline',{vertices:[[320,0,0],[320,2,0],[322,2,0],[322,0,0]],closed:true});const cw=await mutate('acad_extrude',{entityRef:clockwise.created[0],height:3,keepProfile:false});check('clockwise profile still extrudes along explicit +Z',near(cw.observedGeometry.items[0].volume,12)&&near(cw.observedGeometry.items[0].extents.min[2],0)&&near(cw.observedGeometry.items[0].extents.max[2],3));
 const original=await mutate('acad_create_circle',{center:[350,20,0],radius:2});const mirrored=await mutate('acad_transform_entities',{targets:original.created,mode:'mirror',lineStart:[0,0,0],lineEnd:[1,0,0],copy:true});const mirroredSolid=await mutate('acad_extrude',{entityRef:mirrored.created[0],height:7,keepProfile:false});check('mirrored profile normal cannot reverse +Z extrusion',near(mirroredSolid.observedGeometry.items[0].extents.min[2],0)&&near(mirroredSolid.observedGeometry.items[0].extents.max[2],7));
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'mechanical-solids.dwg',overwrite:false},false);
 const output=join(session.output,'mechanical-solids.dwg'),outputHash=await hash(output),exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});const exported=join(exportRoot,'mechanical-solids.dwg');await copyFile(output,exported);
 await session.close();s=undefined;check('source file bytes preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);
 const again=await r.call('acad_query_entities',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{type:'3DSOLID'},projection:['handle','type','volume','center','extents'],limit:1000});const reopened=again.items.find((e:any)=>near(e.volume,expected));check('solid volumes preserved after DWG reopen',again.items.length===8&&Boolean(reopened));
 const er={documentId:r.target.documentId,documentEpoch:r.target.documentEpoch,handle:reopened.handle};const reopenedMass=await r.call('acad_get_mass_properties',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',entityRef:er,densityKgM3:7850});check('mass properties preserved after DWG reopen',near(reopenedMass.massKg,properties.massKg)&&near(reopenedMass.area,properties.area));
 // Explicit modelspace solids remain editable after a session restart.
 const moved=await r.call('acad_move_entities',{...r.target,operationId:randomUUID(),expectedRevision:(await r.call('acad_get_document_info',r.target)).revision,coordinateSystem:'WCS',lengthUnit:'mm',targets:[er],delta:[0,0,20]});check('reopened solid can be explicitly moved',moved.verified===true&&near(moved.observedGeometry.items[0].center[2],25));
 await r.close();r=undefined;check('saved DWG bytes preserved',await hash(input)===outputHash&&await hash(exported)===outputHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,properties,output:exported},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
