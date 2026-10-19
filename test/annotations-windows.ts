import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { windowsSession } from './windows-session.js';
import { toolNames, type ToolName } from '../src/tools.js';

if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});
const source=join(root,'source.dwg'),template=join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt');await copyFile(template,source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex');const sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],log:Array<Record<string,unknown>>=[];
const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
let session:Awaited<ReturnType<typeof windowsSession>>|undefined,reopen:typeof session;
try{
 session=await windowsSession(join(root,'creation'),source,{units:4,undo:true});const s=session;
 const info=()=>s.call('acad_get_document_info',s.target);
 const mutate=async(name:ToolName,args:Record<string,unknown>,spatial=true)=>{
  const p={...s.target,expectedRevision:(await info()).revision,operationId:randomUUID(),...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};
  const reply=await s.client.callTool({name,arguments:p});const result=reply.structuredContent as Record<string,any>;log.push({name,args:p,result});
  if(reply.isError){await writeFile(join(root,'failed-readback.json'),JSON.stringify(await query(),null,2));throw Error(name+': '+result?.error?.code);}
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const projection=['handle','type','layer','start','end','center','radius','position','text','height','width','rotation','dimensionKind','measurement','displayValue','textPosition','textHeight','arrowSize','precision','tolerance','style'];
 const query=(type?:string)=>s.call('acad_query_entities',{...s.target,coordinateSystem:'WCS',lengthUnit:'mm',projection,filter:type?{type}:{},limit:1000});
 check('current tools and matching native capabilities',(await s.client.listTools()).tools.length===toolNames.length&&(await s.call('acad_get_capabilities',{instanceId:s.target.instanceId})).operations.length===toolNames.length);
 check('empty synthetic modelspace',(await query()).scanned===0);
 await mutate('acad_create_style',{kind:'text',name:'MCP_FONT',font:'arial.ttf',widthFactor:1},false);
 await mutate('acad_create_style',{kind:'dimension',name:'MCP_MECHANICAL',textStyle:'MCP_FONT',textHeight:3,arrowSize:2,precision:3});
 await mutate('acad_create_style',{kind:'linetype',name:'MCP_CENTER',dashes:[8,-2,1,-2]});
 await mutate('acad_create_style',{kind:'linetype',name:'MCP_HIDDEN',dashes:[3,-1.5]});
 check('native text/dimension/linetype records returned',(await s.call('acad_list_styles',s.target)).styles.filter((x:any)=>x.name.startsWith('MCP_')).length===4);
 for(const [name,colorIndex,lineweight] of [['MCP_PART',7,35],['MCP_DIM',2,18],['MCP_NOTE',3,18]] as const)await mutate('acad_create_layer',{name,colorIndex,lineweight},false);
 check('native layer records returned',(await s.call('acad_list_layers',s.target)).layers.filter((x:any)=>x.name.startsWith('MCP_')).length===3);
 await mutate('acad_create_layer',{name:'MCP_AXIS',colorIndex:1,lineweight:13,linetype:'MCP_CENTER'},false);
 const f=JSON.parse(await readFile('test/fixtures/notched-plate.json','utf8'));
 for(let i=0;i<f.vertices.length;i++)await mutate('acad_create_line',{start:f.vertices[i],end:f.vertices[(i+1)%f.vertices.length],layer:'MCP_PART'});
 await mutate('acad_create_circle',{...f.circle,layer:'MCP_PART'});
 const dimensions=[
  {kind:'linear',start:[-40,-20,0],end:[40,-20,0],linePoint:[0,-40,0],tolerance:{lower:-0.1,upper:0.2}},
  {kind:'linear',start:[40,-20,0],end:[40,20,0],linePoint:[58,0,0],rotation:Math.PI/2},
  {kind:'linear',start:[-25,-10,0],end:[25,-10,0],linePoint:[0,-31,0]},
  {kind:'linear',start:[25,-10,0],end:[25,10,0],linePoint:[48,0,0],rotation:Math.PI/2},
  {kind:'linear',start:[-10,15,0],end:[10,15,0],linePoint:[0,30,0]},
  {kind:'linear',start:[10,-15,0],end:[10,15,0],linePoint:[66,0,0],rotation:Math.PI/2},
  {kind:'diameter',start:[-5,0,0],end:[5,0,0],linePoint:[18,7,0]},
  {kind:'radius',start:[0,0,0],end:[0,5,0],linePoint:[-18,7,0]},
  {kind:'aligned',start:[-40,45,0],end:[-10,85,0],linePoint:[-35,75,0]}
 ];
 const expected=[80,40,50,20,20,30,10,5,50];let firstDimension:any;
 for(let i=0;i<dimensions.length;i++){
  const r=await mutate('acad_create_dimension',{...dimensions[i],layer:'MCP_DIM',style:'MCP_MECHANICAL'});
  if(i===0)firstDimension=r.created[0];check('dimension measured '+expected[i],Math.abs(r.observedGeometry.items[0].measurement-expected[i]!)<1e-6);
  check('dimension inherits native style',r.observedGeometry.items[0].textHeight===3&&r.observedGeometry.items[0].precision===3&&r.observedGeometry.items[0].style==='MCP_MECHANICAL');
 }
 await mutate('acad_create_text',{position:[-40,-51,0],height:3,text:'PLAKA Ø10 - Çelik',layer:'MCP_NOTE',style:'MCP_FONT'});
 await mutate('acad_create_mtext',{position:[-40,-58,0],height:2.5,width:90,text:'Birim: mm\nAlt/üst sapma açık verildi\n{literal} \\P',layer:'MCP_NOTE'});
 const all=await query();check('32 entities, supported native annotations included',all.items.length===32&&all.scanned===32&&all.cursor===null);
 const ds=await query('DIMENSION');check('all 9 dimension kinds and measured values returned',ds.items.length===9&&ds.items.every((x:any,i:number)=>Math.abs(x.measurement-expected[i]!)<1e-6));
 check('explicit engineering deviations preserved',ds.items[0].tolerance.lower===-0.1&&ds.items[0].tolerance.upper===0.2);
 const get=(entityRef:any,unit='mm')=>s.call('acad_get_entity',{...s.target,entityRef,coordinateSystem:'WCS',lengthUnit:unit,projection});
 check('query units change physical length but preserve displayed mm',Math.abs((await get(firstDimension,'m')).entity.measurement-0.08)<1e-9&&(await get(firstDimension,'m')).entity.displayValue===80);
 await mutate('acad_move_entities',{targets:[firstDimension],delta:[3,4,0]});check('dimension move preserves actual measurement',(await get(firstDimension)).entity.measurement===80);
 await mutate('acad_move_entities',{targets:[firstDimension],delta:[-3,-4,0]});
 const bad={...s.target,expectedRevision:(await info()).revision,operationId:randomUUID(),coordinateSystem:'WCS',lengthUnit:'mm',kind:'fake',start:[0,0,0],end:[1,0,0],linePoint:[0,2,0]};
 const nativeReject=await s.bridge.call('acad_create_dimension',bad);check('native rejects invalid kind without SDK schema',(nativeReject.error as any)?.code==='VALIDATION_FAILED');
 const stale=await s.client.callTool({name:'acad_create_layer',arguments:{...s.target,operationId:randomUUID(),expectedRevision:0,name:'MUST_NOT_EXIST',colorIndex:1}});check('stale layer revision rejected',(stale.structuredContent as any).error.code==='STALE_REVISION');
 const temp=await mutate('acad_create_text',{position:[100,0,0],height:3,text:'ERASE TEST'});
 await mutate('acad_erase_entities',{targets:temp.created},false);
 const undoText=await mutate('acad_create_text',{position:[100,0,0],height:3,text:'UNDO TEST'});
 await s.finishPump();let count=33;
 for(let i=0;i<100&&count!==32;i++){await new Promise(r=>setTimeout(r,50));count=(await query()).items.length;}
 check('single native UNDO removed only last annotation',count===32);
 const undone=await s.client.callTool({name:'acad_get_entity',arguments:{...s.target,entityRef:undoText.created[0],coordinateSystem:'WCS'}});check('undone text no longer readable',undone.isError);
 const before=await info();const save=await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'teknik-resim-olculu.dwg',overwrite:false},false);
 check('save scope includes all annotation entities',save.verification.modelspaceEntityCount===32&&save.verification.supportedGeometryCount===32);
 check('save preserves source identity/revision/dirty',JSON.stringify(before)===JSON.stringify(await info()));
 const output=join(s.output,'teknik-resim-olculu.dwg'),exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});const exported=join(exportRoot,'teknik-resim-olculu.dwg');await copyFile(output,exported);
 await s.close();session=undefined;check('source file hash unchanged',await hash(source)===sourceHash);
 const copy=join(root,'reopen.dwg');await copyFile(exported,copy);const outputHash=await hash(exported);
 reopen=await windowsSession(join(root,'reopen-session'),copy);
 const reread=await reopen.call('acad_query_entities',{...reopen.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection,limit:1000});
 check('saved DWG has all 32 real objects',reread.items.length===32&&reread.scanned===32&&reread.cursor===null);
 const dim2=reread.items.filter((x:any)=>x.type==='DIMENSION');check('reopened measurements and tolerance preserved',dim2.every((x:any,i:number)=>Math.abs(x.measurement-expected[i]!)<1e-6)&&dim2[0].tolerance.lower===-0.1);
 const annotationText=(items:any[])=>items.filter(x=>['TEXT','MTEXT'].includes(x.type)).map(x=>({type:x.type,text:x.text,position:x.position,height:x.height,...(x.type==='MTEXT'?{width:x.width}:{})})).sort((a,b)=>a.type.localeCompare(b.type));
 assert.deepEqual(annotationText(reread.items),annotationText(all.items));check('reopened plain TEXT and MTEXT content preserved independent of handle renumbering',true);
 check('reopened layers preserve colors and lineweights',(await reopen.call('acad_list_layers',reopen.target)).layers.some((x:any)=>x.name==='MCP_DIM'&&x.colorIndex===2&&x.lineweight===18));
 check('reopened linetype/dimension styles preserved',(await reopen.call('acad_list_styles',reopen.target)).styles.some((x:any)=>x.name==='MCP_CENTER'&&JSON.stringify(x.dashes)==='[8,-2,1,-2]'));
 await reopen.close();reopen=undefined;check('reopen did not change saved DWG bytes',await hash(copy)===outputHash&&await hash(exported)===outputHash);
 const report={passed:true,checks,output:exported,backend:'objectarx',nativeDimensions:9,entityCount:32,sourcePreserved:true,items:reread.items,mutations:log};
 await writeFile(join(root,'results.json'),JSON.stringify(report,null,2));await writeFile(join(exportRoot,'observed-annotations.json'),JSON.stringify({items:reread.items},null,2));console.log('Evidence: '+root);console.log('DWG: '+exported);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,error:String(error),mutations:log},null,2));throw error;}
finally{await session?.terminate();await reopen?.terminate();}
