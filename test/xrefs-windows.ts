import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { copyFile,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join,dirname } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const template=join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt');
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex');const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
let s:Awaited<ReturnType<typeof windowsSession>>|undefined;
try{
 const source=join(root,'source.dwg');await copyFile(template,source);s=await windowsSession(join(root,'source'),source,{units:4});
 const mutate=async(name:ToolName,args:any,spatial=true,error?:string)=>{
  const session=s!;const info=await session.call('acad_get_document_info',session.target);const p={...session.target,operationId:randomUUID(),expectedRevision:info.revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(error){check(name+' rejects '+error,reply.isError&&result.error.code===error&&result.applied===false);return result;}
  if(reply.isError)throw Error(name+': '+JSON.stringify(result?.error));check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 await mutate('acad_create_polyline',{vertices:[[0,0,0],[20,0,0],[20,10,0],[0,10,0]],closed:true});await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'part.dwg',overwrite:false},false);const part=join(root,'part.dwg');await copyFile(join(s.output,'part.dwg'),part);const partHash=await hash(part);await s.close();s=undefined;
 const host=join(root,'host.dwg');await copyFile(template,host);const hostHash=await hash(host);s=await windowsSession(join(root,'host'),host,{units:4});const staged=join(dirname(s.grantFile),'input','part.dwg');await copyFile(part,staged);
 const args={inputRootId:'session-input',relativePath:'part.dwg',name:'PART_XREF',position:[100,50,0],scale:2,rotation:Math.PI/2,overlay:true};
 const attached=await mutate('acad_attach_xref',args);check('xref reference has explicit transform and external marker',attached.observedGeometry.items[0].externalReference&&attached.observedGeometry.items[0].position[0]===100&&attached.observedGeometry.items[0].scale[0]===2);
 const list=()=>s!.call('acad_list_xrefs',s!.target);check('xref inventory shows overlay and basename',(await list()).xrefs.some((x:any)=>x.name==='PART_XREF'&&x.overlay&&x.basename==='part.dwg'));
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'nested.dwg',overwrite:false},false);await copyFile(join(s.output,'nested.dwg'),join(dirname(s.grantFile),'input','nested.dwg'));
 await mutate('acad_attach_xref',{...args,name:'NESTED',relativePath:'nested.dwg'},true,'SECURITY_DENIED');check('nested reference rejection leaves inventory unchanged',(await list()).xrefs.length===1);
 await mutate('acad_manage_xref',{name:'PART_XREF',mode:'unload',targets:attached.created},false);check('explicit xref unloaded',(await list()).xrefs[0].unloaded===true);
 await mutate('acad_manage_xref',{name:'PART_XREF',mode:'reload',targets:attached.created},false);check('validated staged xref reloaded',(await list()).xrefs[0].unloaded===false);
 await mutate('acad_manage_xref',{name:'PART_XREF',mode:'bind',targets:attached.created},false);check('bind converts external reference to local block',(await list()).xrefs.length===0);
 const local=await s.call('acad_get_block',{...s.target,coordinateSystem:'WCS',lengthUnit:'mm',name:'PART_XREF'});check('bound geometry is local and preserved',local.items.length===1&&local.items[0].closed&&local.items[0].area===200);
 const second=await mutate('acad_attach_xref',{...args,name:'DETACH_ME',position:[200,0,0]});await mutate('acad_manage_xref',{name:'DETACH_ME',mode:'detach',targets:second.created},false);check('explicit detach removes only the chosen xref',(await list()).xrefs.length===0);
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'bound-host.dwg',overwrite:false},false);
 await s.close();s=undefined;check('staged input and source DWG bytes never changed',await hash(staged)===partHash&&await hash(part)===partHash&&await hash(host)===hostHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();}
