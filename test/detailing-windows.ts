import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { copyFile,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const source=join(root,'source.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};const near=(a:number,b:number)=>Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-7);
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const query=()=>session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection:['handle','type','area','rows','columnWidths','rowHeights','position'],limit:1000});
 const mutate=async(name:ToolName,args:any,spatial=true,error?:string)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(error){check(name+' rejects '+error,reply.isError&&result.error.code===error&&result.applied===false);return result;}
  if(reply.isError){await writeFile(join(root,'failed-readback.json'),JSON.stringify(await query(),null,2));throw Error(name+': '+result?.error?.code);}
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const rect=await mutate('acad_create_polyline',{vertices:[[0,0,0],[40,0,0],[40,20,0],[0,20,0]],closed:true}),hole=await mutate('acad_create_circle',{center:[20,10,0],radius:3});
 const hatch=await mutate('acad_create_hatch',{targets:[rect.created[0],hole.created[0]],pattern:'ANSI31',scale:1,angle:Math.PI/6});check('hatch uses outer boundary minus hole',near(hatch.observedGeometry.items[0].area,800-9*Math.PI)&&hatch.observedGeometry.items[0].loopCount===2);
 const outside=await mutate('acad_create_circle',{center:[100,10,0],radius:2}),revision=(await info()).revision;
 await mutate('acad_create_hatch',{targets:[rect.created[0],outside.created[0]],pattern:'SOLID'},true,'VALIDATION_FAILED');check('invalid hatch causes no revision change',(await info()).revision===revision);
 const box=await mutate('acad_create_box',{center:[100,100,10],size:[20,30,20]});
 const section=await mutate('acad_section_solid',{entityRef:box.created[0],origin:[100,100,10],normal:[0,0,1]});check('horizontal solid section is a real region of area 600',section.observedGeometry.items[0].type==='REGION'&&near(section.observedGeometry.items[0].area,600));
 const vertical=await mutate('acad_section_solid',{entityRef:box.created[0],origin:[100,100,10],normal:[1,0,0]});check('vertical solid section area is 600',near(vertical.observedGeometry.items[0].area,600));
 await mutate('acad_define_block',{name:'PLATE',basePoint:[0,0,0],targets:rect.created,attributes:[{tag:'PART_NO',prompt:'Part',defaultValue:'P-001',position:[0,-5,0],height:2.5},{tag:'MATERIAL',prompt:'Material',defaultValue:'STEEL',position:[0,-9,0],height:2.5}]});
 const a=await mutate('acad_insert_block',{name:'PLATE',position:[0,100,0]}),b=await mutate('acad_insert_block',{name:'PLATE',position:[50,100,0]}),c=await mutate('acad_insert_block',{name:'PLATE',position:[0,150,0],attributes:{MATERIAL:'ALUMINIUM'}});
 const bom=await session.call('acad_get_bom',{...session.target,targets:[...a.created,...b.created,...c.created],groupBy:['PART_NO','MATERIAL']});check('BOM groups actual attributes into quantities 2 and 1',bom.selectedCount===3&&bom.rows.length===2&&bom.rows.some((x:any)=>x.quantity===2&&x.attributes.MATERIAL==='STEEL')&&bom.rows.some((x:any)=>x.quantity===1&&x.attributes.MATERIAL==='ALUMINIUM'));
 const rows=[['PART','MATERIAL','QTY'],...bom.rows.map((x:any)=>[x.attributes.PART_NO,x.attributes.MATERIAL,String(x.quantity)])];
 const table=await mutate('acad_create_table',{position:[150,150,0],rows,columnWidths:[30,35,15],rowHeight:10,textHeight:2.5});check('native table preserves explicit cells',table.observedGeometry.items[0].type==='TABLE'&&JSON.stringify(table.observedGeometry.items[0].rows)===JSON.stringify(rows));
 await mutate('acad_move_entities',{targets:table.created,delta:[10,0,0]});
 const beforeSmall=await query(),smallRevision=(await info()).revision;
 const small=await session.client.callTool({name:'acad_create_table',arguments:{...session.target,operationId:randomUUID(),expectedRevision:smallRevision,coordinateSystem:'WCS',lengthUnit:'mm',position:[300,150,0],rows:[['TOO TALL']],columnWidths:[100],rowHeight:0.1,textHeight:20}});const smallResult=small.structuredContent as any;
 check('native table rejects silently expanded row dimensions',small.isError&&smallResult.applied===false&&['EXECUTION_FAILED','VALIDATION_FAILED'].includes(smallResult.error.code));
 const afterSmall=await query(),afterSmallInfo=await info();calls.push({name:'rejected-table-readback',result:smallResult,beforeRevision:smallRevision,afterRevision:afterSmallInfo.revision,before:beforeSmall.items,after:afterSmall.items});
 if(afterSmallInfo.revision!==smallRevision||JSON.stringify(afterSmall.items)!==JSON.stringify(beforeSmall.items))await writeFile(join(root,'table-rollback.json'),JSON.stringify(calls.at(-1),null,2));
 check('rejected table leaves geometry and revision unchanged',afterSmallInfo.revision===smallRevision&&JSON.stringify(afterSmall.items)===JSON.stringify(beforeSmall.items));
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'mechanical-detailing.dwg',overwrite:false},false);
 const output=join(session.output,'mechanical-detailing.dwg'),outputHash=await hash(output),exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});const exported=join(exportRoot,'mechanical-detailing.dwg');await copyFile(output,exported);
 await session.close();s=undefined;check('source file bytes preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);
 const again=await r.call('acad_query_entities',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection:['handle','type','area','rows','position'],limit:1000});
 check('reopened hatch area preserved',near(again.items.find((e:any)=>e.type==='HATCH').area,800-9*Math.PI));check('both region sections preserved',again.items.filter((e:any)=>e.type==='REGION').length===2);
 const t=again.items.find((e:any)=>e.type==='TABLE');check('reopened table cells and moved location preserved',JSON.stringify(t.rows)===JSON.stringify(rows)&&near(t.position[0],160));
 await r.close();r=undefined;check('saved DWG bytes preserved',await hash(input)===outputHash&&await hash(exported)===outputHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,bom,output:exported},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
