import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});
const source=join(root,'source.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),beforeHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const projection=['handle','type','layer','start','end','center','radius','vertices','bulges','closed','length','area','startAngle','endAngle'];
 const query=()=>session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection,limit:1000});
 const mutate=async(name:ToolName,args:any)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,coordinateSystem:'WCS',lengthUnit:'mm',...args};
  const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(reply.isError){await writeFile(join(root,'failed-readback.json'),JSON.stringify(await query(),null,2));throw Error(name+': '+result?.error?.code);}
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const poly=await mutate('acad_create_polyline',{vertices:[[0,0,0],[10,0,0],[10,20,0],[0,20,0]],closed:true});
 check('closed polyline area and perimeter',poly.observedGeometry.items[0].area===200&&poly.observedGeometry.items[0].length===60);
 const arc=await mutate('acad_create_arc',{center:[30,0,0],radius:10,startAngle:0,endAngle:Math.PI/2});
 check('arc actual length',Math.abs(arc.observedGeometry.items[0].length-5*Math.PI)<1e-6);
 const circle=await mutate('acad_create_circle',{center:[60,0,0],radius:3});
 const line=await mutate('acad_create_line',{start:[0,40,0],end:[10,40,0]});
 const copy=await mutate('acad_transform_entities',{mode:'copy',targets:line.created,delta:[20,0,0]});
 check('line copy endpoints',JSON.stringify(copy.observedGeometry.items[0].start)==='[20,40,0]');
 const rotated=await mutate('acad_transform_entities',{mode:'rotate',targets:line.created,center:[0,0,0],angle:Math.PI/2,copy:true});
 check('rotated copy exact geometry',Math.abs(rotated.observedGeometry.items[0].start[0]+40)<1e-6&&Math.abs(rotated.observedGeometry.items[0].end[1]-10)<1e-6);
 const scaled=await mutate('acad_transform_entities',{mode:'scale',targets:poly.created,center:[0,0,0],factor:2,copy:true});
 check('scaled polyline area factor squared',Math.abs(scaled.observedGeometry.items[0].area-800)<1e-6);
 const mirrored=await mutate('acad_transform_entities',{mode:'mirror',targets:arc.created,lineStart:[0,0,0],lineEnd:[0,1,0],copy:true});
 check('mirrored arc center and endpoints',Math.abs(mirrored.observedGeometry.items[0].center[0]+30)<1e-6&&['start','end'].some(k=>Math.abs(mirrored.observedGeometry.items[0][k][0]+40)<1e-6));
 const array=await mutate('acad_transform_entities',{mode:'linear_array',targets:circle.created,count:4,step:[10,10,0]});
 check('linear array count and spacing',array.created.length===3&&JSON.stringify(array.observedGeometry.items.map((x:any)=>x.center))==='[[70,10,0],[80,20,0],[90,30,0]]');
 const circular=await mutate('acad_transform_entities',{mode:'circular_array',targets:circle.created,count:4,center:[60,20,0],angleStep:Math.PI/2});
 const expected=[[80,20,0],[60,40,0],[40,20,0]];check('circular array measured centers',circular.created.length===3&&circular.observedGeometry.items.every((x:any,i:number)=>x.center.every((v:number,a:number)=>Math.abs(v-expected[i]![a]!)<1e-6)));
 await mutate('acad_transform_entities',{mode:'rotate',targets:poly.created,center:[0,0,0],angle:Math.PI/2});
 await mutate('acad_transform_entities',{mode:'mirror',targets:poly.created,lineStart:[0,0,0],lineEnd:[0,1,0],copy:false});
 await mutate('acad_transform_entities',{mode:'scale',targets:circle.created,center:[60,0,0],factor:1.5});
 await mutate('acad_move_entities',{targets:poly.created,delta:[5,5,0]});
 await mutate('acad_move_entities',{targets:poly.created,delta:[-5,-5,0]});
 const all=await query();check('14 supported objects with bounded complete query',all.items.length===14&&all.scanned===14&&all.cursor===null);
 const first=all.items.find((x:any)=>x.handle===poly.created[0].handle);check('in-place polygon geometry remains closed and area preserved',first.closed&&Math.abs(first.area-200)<1e-6);
 const old=await info();const invalid=await session.client.callTool({name:'acad_transform_entities',arguments:{...session.target,operationId:randomUUID(),expectedRevision:old.revision,coordinateSystem:'WCS',lengthUnit:'mm',mode:'copy',targets:[line.created[0],{...line.created[0],handle:'FFFFFE'}],delta:[100,0,0]}});
 check('invalid second target aborts whole copy',invalid.isError&&(await query()).items.length===14&&(await info()).revision===old.revision);
 const save=await mutate('acad_save_copy',{coordinateSystem:undefined,lengthUnit:undefined,outputRootId:'test-output',relativePath:'geometry2d.dwg',overwrite:false});
 check('save verifies arc/polyline geometry',save.verification.supportedGeometryCount===14);
 const output=join(session.output,'geometry2d.dwg'),savedHash=await hash(output),exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});const exported=join(exportRoot,'geometry2d.dwg');await copyFile(output,exported);
 await session.close();s=undefined;check('source hash unchanged',await hash(source)===beforeHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);
 const again=await r.call('acad_query_entities',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection,limit:1000});
 const canonical=(items:any[])=>items.map(({handle,unavailableFields,...e})=>e).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 // Numerical tolerances are applied recursively to survive harmless serialization rounding.
 const near=(a:any,b:any):boolean=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=Math.max(1e-6,Math.abs(a)*1e-8):Array.isArray(a)?Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>near(x,b[i])):a&&typeof a==='object'?b&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>near(a[k],b[k])):a===b;
 check('reopened complete geometry matches',again.items.length===14&&near(canonical(all.items),canonical(again.items)));
 await r.close();r=undefined;check('saved bytes preserved',await hash(input)===savedHash&&await hash(exported)===savedHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,output:exported,items:again.items},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
