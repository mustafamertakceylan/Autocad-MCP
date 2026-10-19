import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile,mkdir,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const source=join(root,'source.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};const near=(a:number,b:number)=>Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-7);
let s:Awaited<ReturnType<typeof windowsSession>>|undefined;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const query=()=>session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection:['handle','type','volume','text','position','textHeight'],limit:1000});
 const mutate=async(name:ToolName,args:any,spatial=true,error?:string)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(error){check(name+' rejects '+error,reply.isError&&result.error.code===error&&result.applied===false);return result;}
  if(reply.isError){await writeFile(join(root,'failed-readback.json'),JSON.stringify(await query(),null,2));throw Error(name+': '+JSON.stringify(result?.error));}
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const shaft=await mutate('acad_create_shaft',{base:[0,0,0],segments:[{length:20,diameter:20},{length:30,diameter:12},{length:10,diameter:16}]});check('stepped shaft exact analytic volume and bounds',near(shaft.observedGeometry.items[0].volume,3720*Math.PI)&&near(shaft.observedGeometry.items[0].extents.max[2],60));
 const plate=await mutate('acad_create_box',{center:[100,0,5],size:[80,80,10]});const centers=[[120,0,10],[100,20,10],[80,0,10],[100,-20,10]];
 const holes=await mutate('acad_drill_holes',{entityRef:plate.created[0],centers,diameter:6,depth:10,direction:'negative_z'});check('four-hole bolt circle removes four exact cylinders',near(holes.observedGeometry.items[0].volume,64000-360*Math.PI));
 const p2=await mutate('acad_create_box',{center:[200,0,5],size:[40,40,10]});const counter=await mutate('acad_drill_holes',{entityRef:p2.created[0],centers:[[200,0,10]],diameter:6,depth:10,direction:'negative_z',entry:{kind:'counterbore',diameter:12,depth:3}});check('counterbore removes exact stepped volume',near(counter.observedGeometry.items[0].volume,16000-171*Math.PI));
 const p3=await mutate('acad_create_box',{center:[250,0,5],size:[40,40,10]});const sink=await mutate('acad_drill_holes',{entityRef:p3.created[0],centers:[[250,0,10]],diameter:6,depth:10,direction:'negative_z',entry:{kind:'countersink',diameter:12,depth:3}});check('countersink removes exact frustum and cylinder volume',near(sink.observedGeometry.items[0].volume,16000-126*Math.PI));
 const before=JSON.stringify((await query()).items),revision=(await info()).revision;await mutate('acad_drill_holes',{entityRef:holes.created[0],centers:[[110,10,10],[1000,0,10]],diameter:4,depth:10,direction:'negative_z'},true,'VALIDATION_FAILED');check('invalid second hole leaves first hole unapplied and revision unchanged',revision===(await info()).revision&&before===JSON.stringify((await query()).items));
 const fcf=await mutate('acad_create_feature_control_frame',{position:[0,100,0],characteristic:'position',tolerance:0.05,diameterZone:true,materialCondition:'MMC',datums:['A','B','C'],textHeight:3});const value=fcf.observedGeometry.items[0];check('native FCF encodes explicit symbol tolerance and datums',value.type==='FCF'&&value.text.includes('0.05')&&value.text.includes('A')&&value.text.includes('B')&&value.text.includes('C')&&near(value.textHeight,3));
 await mutate('acad_move_entities',{targets:fcf.created,delta:[5,0,0]});
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'mechanical-features.dwg',overwrite:false},false);
 const reopened=join(root,'reopened.dwg');await copyFile(join(session.output,'mechanical-features.dwg'),reopened);await session.close();s=undefined;
 s=await windowsSession(join(root,'reopen'),reopened);const again=await s.call('acad_query_entities',{...s.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{type:'FCF'},projection:['text','position','textHeight','dimensionScale','style','extents'],limit:10});
 check('native FCF data preserved in a fresh AutoCAD process',again.items.length===1&&again.items[0].text===value.text&&near(again.items[0].textHeight,3)&&near(again.items[0].position[0],5)&&near(again.items[0].dimensionScale,1));
 check('unregenerated FCF visual extents are explicitly unavailable',again.items[0].unavailableFields.includes('extents'));
 await s.close();s=undefined;await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();}
