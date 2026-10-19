import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {windowsSession} from './windows-session.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const input=join(root,'input.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),input);
const checks:any[]=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};let s:Awaited<ReturnType<typeof windowsSession>>|undefined;
try{
 s=await windowsSession(join(root,'draw'),input,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target),query=()=>session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},limit:1000});
 const revision=(await info()).revision,operationId=randomUUID(),args={...session.target,operationId,expectedRevision:revision,coordinateSystem:'WCS',lengthUnit:'mm',steps:[{tool:'acad_create_line',start:[0,0,0],end:[20,0,0]},{tool:'acad_create_circle',center:[10,10,0],radius:3},{tool:'acad_create_polyline',vertices:[[0,20,0],[20,20,0],[20,30,0],[0,30,0]],closed:true}]};
 const reply=await session.client.callTool({name:'acad_run_batch',arguments:args}),result=reply.structuredContent as any;calls.push({args,result});check('typed batch succeeds and verifies all three creations',!reply.isError&&result.verified&&result.created.length===3&&result.stepCount===3);check('batch publishes only one final revision',(await info()).revision===revision+1);
 const duplicate=await session.call('acad_run_batch',args);check('same operationId returns recorded result without duplicate geometry',duplicate.revision===result.revision&&(await query()).items.length===3);
 const failing={...args,operationId:randomUUID(),expectedRevision:(await info()).revision,steps:[{tool:'acad_create_line',start:[100,0,0],end:[120,0,0]},{tool:'acad_create_circle',center:[110,10,0],radius:3,layer:'MISSING_LAYER'}]};
 const bad=await session.client.callTool({name:'acad_run_batch',arguments:failing}),error=bad.structuredContent as any;calls.push({args:failing,result:error});check('failing second native step reports no effect',bad.isError&&error.applied===false&&error.error.code==='EXECUTION_FAILED');check('first step was rolled back and revision preserved',(await query()).items.length===3&&(await info()).revision===revision+1);
 const saved=await session.call('acad_save_copy',{...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,outputRootId:'test-output',relativePath:'batch.dwg',overwrite:false});check('batch drawing saves with verified reopen',saved.verified===true);
 await session.close();s=undefined;await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}finally{await s?.terminate();}
