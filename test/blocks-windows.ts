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
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const projection=['handle','type','layer','position','rotation','scale','blockName','attributes','attributeGeometry'];
 const query=()=>session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection,limit:1000});
 const mutate=async(name:ToolName,args:any,spatial=true,error?:string)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(error){check(name+' rejects '+error,reply.isError&&result.error.code===error&&result.applied===false);return result;}
  if(reply.isError){await writeFile(join(root,'failed-readback.json'),JSON.stringify(await query(),null,2));throw Error(name+': '+result?.error?.code);}
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const poly=await mutate('acad_create_polyline',{vertices:[[10,10,0],[30,10,0],[30,20,0],[10,20,0]],closed:true});
 const circle=await mutate('acad_create_circle',{center:[20,15,0],radius:2});
 const targets=[poly.created[0],circle.created[0]],attributes=[{tag:'PART_NO',prompt:'Part number',defaultValue:'P-001',position:[0,-4,0],height:2.5},{tag:'MATERIAL',prompt:'Material',defaultValue:'STEEL',position:[0,-8,0],height:2.5}];
 await mutate('acad_define_block',{name:'MCP_PLATE',basePoint:[10,10,0],targets,attributes});
 await mutate('acad_define_block',{name:'MCP_SPARE',basePoint:[10,10,0],targets,attributes:[]});
 check('defining blocks preserves source entities',(await query()).items.length===2);
 const def=await session.call('acad_get_block',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',name:'MCP_PLATE'});
 check('block local geometry derived from base point',def.items.length===2&&def.items[0].vertices[0][0]===0&&def.items[1].center[0]===10&&def.items[1].center[1]===5);
 check('attribute definitions preserved',def.attributeDefinitions.length===2&&def.attributeDefinitions[0].tag==='PART_NO');
 const inserted=await mutate('acad_insert_block',{name:'MCP_PLATE',position:[100,50,0],scale:2,rotation:Math.PI/2,attributes:{PART_NO:'P-002'}});
 const ref=inserted.created[0],first=inserted.observedGeometry.items[0];
 check('block transform and default/explicit attribute values',first.blockName==='MCP_PLATE'&&first.attributes.PART_NO==='P-002'&&first.attributes.MATERIAL==='STEEL'&&first.scale[0]===2);
 const part=first.attributeGeometry.find((a:any)=>a.tag==='PART_NO');check('attribute position follows scale and rotation',Math.abs(part.position[0]-108)<1e-6&&Math.abs(part.position[1]-50)<1e-6);
 const moved=await mutate('acad_move_entities',{targets:[ref],delta:[5,-2,0]});const movedPart=moved.observedGeometry.items[0].attributeGeometry.find((a:any)=>a.tag==='PART_NO');
 check('moving insertion moves attributes exactly once',Math.abs(movedPart.position[0]-113)<1e-6&&Math.abs(movedPart.position[1]-48)<1e-6);
 await mutate('acad_set_attributes',{entityRef:ref,attributes:{PART_NO:'P-003',MATERIAL:'ALUMINIUM'}},false);
 await mutate('acad_set_attributes',{entityRef:ref,attributes:{PART_NO:'MUST_NOT_APPLY',ZZ_UNKNOWN:'X'}},false,'TARGET_NOT_FOUND');
 const current=(await query()).items.find((x:any)=>x.handle===ref.handle);check('unknown second tag causes no partial update',current.attributes.PART_NO==='P-003'&&current.attributes.MATERIAL==='ALUMINIUM');
 const def2=await session.call('acad_get_block',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',name:'MCP_PLATE'});check('instance attribute edits do not alter definition defaults',def2.attributeDefinitions[0].defaultValue==='P-001');
 await mutate('acad_insert_block',{name:'MCP_PLATE',position:[200,0,0],attributes:{UNKNOWN:'X'}},true,'TARGET_NOT_FOUND');check('failed insertion has no geometry effect',(await query()).items.length===3);
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'mechanical-blocks.dwg',overwrite:false},false);
 const output=join(session.output,'mechanical-blocks.dwg'),outputHash=await hash(output),exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});const exported=join(exportRoot,'mechanical-blocks.dwg');await copyFile(output,exported);
 await session.close();s=undefined;check('source file bytes preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);
 const again=await r.call('acad_query_entities',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{type:'INSERT'},projection,limit:1000});
 check('reopened insertion attributes and position preserved',again.items.length===1&&again.items[0].attributes.PART_NO==='P-003'&&again.items[0].position[0]===105&&again.items[0].position[1]===48);
 const spare=await r.call('acad_get_block',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',name:'MCP_SPARE'});check('unused named block definition preserved in saved copy',spare.items.length===2&&spare.attributeDefinitions.length===0);
 await r.close();r=undefined;check('saved DWG bytes preserved',await hash(input)===outputHash&&await hash(exported)===outputHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,output:exported},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
