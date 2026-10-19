import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const source=join(root,'source.dwg');
await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const projection=['handle','type','layer','start','end','center','radius','vertices','bulges','closed','length','area','startAngle','endAngle'];
 const query=()=>session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection,limit:1000});
 const mutate=async(name:ToolName,args:any,expectedError?:string)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,coordinateSystem:'WCS',lengthUnit:'mm',...args};
  const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(expectedError){check(name+' rejects '+expectedError,reply.isError&&result.error.code===expectedError&&result.applied===false);return result;}
  if(reply.isError){await writeFile(join(root,'failed-readback.json'),JSON.stringify(await query(),null,2));throw Error(name+': '+result?.error?.code);}
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const line=async(start:number[],end:number[])=>(await mutate('acad_create_line',{start,end})).created[0];
 const circle=(await mutate('acad_create_circle',{center:[0,0,0],radius:10})).created[0];
 const outward=await mutate('acad_offset_entity',{entityRef:circle,distance:2,sidePoint:[20,0,0]});
 check('outward circle offset measured radius12',outward.observedGeometry.items[0].radius===12);
 const inward=await mutate('acad_offset_entity',{entityRef:circle,distance:2,sidePoint:[0,0,0]});check('inward circle offset measured radius8',inward.observedGeometry.items[0].radius===8);
 const countBefore=(await query()).items.length;await mutate('acad_offset_entity',{entityRef:circle,distance:20,sidePoint:[0,0,0]},'VALIDATION_FAILED');check('impossible inward offset did not create outward replacement',(await query()).items.length===countBefore);
 const sourceLine=await line([0,30,0],[20,30,0]);const offsetLine=await mutate('acad_offset_entity',{entityRef:sourceLine,distance:3,sidePoint:[10,40,0]});
 check('line offset follows selected side',Math.abs(offsetLine.observedGeometry.items[0].start[1]-33)<1e-6&&Math.abs(offsetLine.observedGeometry.items[0].end[1]-33)<1e-6);
 const poly=(await mutate('acad_create_polyline',{vertices:[[40,0,0],[60,0,0],[60,20,0],[40,20,0]],closed:true})).created[0];
 const offsetPoly=await mutate('acad_offset_entity',{entityRef:poly,distance:2,sidePoint:[70,10,0]});check('polyline outward offset area576',Math.abs(offsetPoly.observedGeometry.items[0].area-576)<1e-6);
 const trimLine=await line([0,50,0],[20,50,0]),cutA=await line([8,40,0],[8,60,0]),cutB=await line([15,40,0],[15,60,0]);
 const trimmed=await mutate('acad_edit_curve',{mode:'trim',entityRef:trimLine,boundaries:[cutA,cutB],keepPoint:[10,50,0]});
 check('trim kept only intended middle segment',trimmed.erased.length===1&&trimmed.observedGeometry.items[0].length===7&&trimmed.observedGeometry.items[0].start[0]===8&&trimmed.observedGeometry.items[0].end[0]===15);
 const cutter=await line([0,-15,0],[0,15,0]);const arc=await mutate('acad_edit_curve',{mode:'trim',entityRef:circle,boundaries:[cutter],keepPoint:[8,0,0]});
 check('circle trim kept right semicircle',arc.observedGeometry.items[0].type==='ARC'&&Math.abs(arc.observedGeometry.items[0].length-10*Math.PI)<1e-6&&arc.observedGeometry.items[0].radius===10);
 const extendLine=await line([0,70,0],[5,70,0]),right=await line([12,65,0],[12,75,0]),left=await line([-5,65,0],[-5,75,0]);
 const end=await mutate('acad_edit_curve',{mode:'extend',entityRef:extendLine,boundaries:[right],end:'end'});check('extension stops at nearest forward boundary',end.observedGeometry.items[0].end[0]===12);
 const start=await mutate('acad_edit_curve',{mode:'extend',entityRef:extendLine,boundaries:[left],end:'start'});check('start extension preserves opposite endpoint',start.observedGeometry.items[0].start[0]===-5&&start.observedGeometry.items[0].end[0]===12);
 const fa=await line([100,0,0],[120,0,0]),fb=await line([100,0,0],[100,20,0]);
 await mutate('acad_corner',{kind:'fillet',targets:[fa,fb],radius:100},'VALIDATION_FAILED');
 const fillet=await mutate('acad_corner',{kind:'fillet',targets:[fa,fb],radius:5});const filletArc=fillet.observedGeometry.items.find((x:any)=>x.type==='ARC');
 check('fillet radius, center and tangent lengths',fillet.modified.length===2&&filletArc.radius===5&&Math.abs(filletArc.center[0]-105)<1e-6&&Math.abs(filletArc.center[1]-5)<1e-6&&fillet.observedGeometry.items.filter((x:any)=>x.type==='LINE').every((x:any)=>Math.abs(x.length-15)<1e-6));
 const ca=await line([140,0,0],[160,0,0]),cb=await line([140,0,0],[140,20,0]);const chamfer=await mutate('acad_corner',{kind:'chamfer',targets:[ca,cb],distanceA:3,distanceB:4});
 check('chamfer3-4-5 and atomic line trims',chamfer.created.length===1&&chamfer.modified.length===2&&chamfer.observedGeometry.items[0].length===5);
 const all=await query();check('20 final supported entities with complete query',all.items.length===20&&all.scanned===20&&all.cursor===null);
 const boundaries=all.items.filter((x:any)=>[cutA.handle,cutB.handle,cutter.handle,right.handle,left.handle].includes(x.handle));check('all5 boundaries preserved',boundaries.length===5&&boundaries.every((x:any)=>x.type==='LINE'));
 const save=await mutate('acad_save_copy',{coordinateSystem:undefined,lengthUnit:undefined,outputRootId:'test-output',relativePath:'curve-edits.dwg',overwrite:false});check('save verifies all curve results',save.verification.supportedGeometryCount===20);
 const output=join(session.output,'curve-edits.dwg'),outputHash=await hash(output),exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});const exported=join(exportRoot,'curve-edits.dwg');await copyFile(output,exported);
 await session.close();s=undefined;check('source file preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);
 const again=await r.call('acad_query_entities',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection,limit:1000});
 check('reopened curve count and fillet measured radius preserved',again.items.length===20&&again.scanned===20&&again.items.some((x:any)=>x.type==='ARC'&&x.radius===5));
 await r.close();r=undefined;check('saved DWG bytes preserved',await hash(input)===outputHash&&await hash(exported)===outputHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,output:exported,items:again.items},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
