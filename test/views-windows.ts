import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {windowsSession} from './windows-session.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const input=join(root,'input.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),input);const checks:any[]=[],calls:any[]=[];let s:Awaited<ReturnType<typeof windowsSession>>|undefined;
const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
try{
 s=await windowsSession(join(root,'draw'),input,{units:4});const session=s;
 for(const direction of ['top','front','right','isometric']){
  const info=await session.call('acad_get_document_info',session.target),args={...session.target,operationId:randomUUID(),expectedRevision:info.revision,coordinateSystem:'WCS',lengthUnit:'mm',center:[20,30,40],direction,height:100};
  const reply=await session.client.callTool({name:'acad_set_view',arguments:args}),data=reply.structuredContent as any;calls.push({args,result:data});if(reply.isError)throw Error(JSON.stringify({error:data.error,view:data.view,read:await session.call('acad_get_view',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm'})}));check(direction+' camera verified',data.verified&&Math.abs(data.view.height-100)<1e-6&&data.view.center[0]===20&&data.view.center[2]===40);
 }
 const metres=await session.call('acad_get_view',{...session.target,coordinateSystem:'WCS',lengthUnit:'m'});check('camera readback converts units',Math.abs(metres.height-0.1)<1e-9&&Math.abs(metres.center[0]-0.02)<1e-9);
 const entities=await session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},limit:1000});check('camera changes preserve drawing entities',entities.items.length===0);
 await session.close();s=undefined;await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}finally{await s?.terminate();}
