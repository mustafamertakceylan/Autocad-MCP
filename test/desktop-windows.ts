import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { DesktopManager } from '../src/desktop-agent.js';
import { configureDesktopWorkspace, desktopBindingSchema, desktopClientCount, desktopRead } from '../src/desktop-state.js';
import { sha256 } from '../src/distribution.js';
import { windowsSession } from './windows-session.js';
import { toolNames } from '../src/tools.js';

if(process.env.AUTOCAD_MCP_DESKTOP_TEST!=='1')throw Error('Explicit desktop native acceptance required');
const id=randomUUID(), root=resolve('tmp/phase5-runs',id), evidence=resolve('tmp/desktop-runs',id);await mkdir(root,{recursive:true});await mkdir(evidence,{recursive:true});
const runtimeRoot=join(root,'runtime'), state=join(root,'desktop-state'), workspace=join(root,'workspace');
const module=resolve(process.env.AUTOCAD_MCP_TEST_MODULE??'build/phase6-native/Release/AutocadMcp.arx'), provenance=JSON.parse(await readFile(module+'.json','utf8'));
const stock=join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'), drawing=join(root,'source.dwg');await copyFile(stock,drawing);const sourceHash=sha256(await readFile(drawing));
const manager=new DesktopManager(state,join(runtimeRoot,'desktop-hosts'),runtimeRoot,provenance.buildId);
const checks:{name:string;passed:true}[]=[],check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
let first:Awaited<ReturnType<typeof windowsSession>>|undefined,second:typeof first,third:typeof first,client:Client|undefined;
process.env.AUTOCAD_MCP_PHASE5_TEST='1';
try{
 await manager.initialize();await configureDesktopWorkspace(state,workspace);
 const configText=await readFile(join(workspace,'claude/.mcp.json'),'utf8'),config=JSON.parse(configText).mcpServers.autocad;
 client=new Client({name:'desktop-native-acceptance',version:'0.1.0'});await client.connect(new StdioClientTransport({command:config.command,args:config.args,stderr:'pipe'}));
 check('MCP client initializes while AutoCAD is absent',(await client.listTools()).tools.length===toolNames.length&&(await client.listResources()).resources.length===3);
 for(let i=0;i<100&&await desktopClientCount(state)!==1;i++)await new Promise(ok=>setTimeout(ok,30));check('real initialized MCP client is counted',await desktopClientCount(state)===1);
 check('offline state never reports native connection',(await manager.snapshot()).connected===false);
 const connect=async({processId}:{processId:number})=>{
  let hosts:Awaited<ReturnType<typeof manager.hosts>>=[];
  for(let i=0;i<400;i++){hosts=await manager.hosts();if(hosts.some(h=>h.processId===processId))break;await new Promise(ok=>setTimeout(ok,100));}
  const host=hosts.find(h=>h.processId===processId);assert.ok(host,'New explicit AutoCAD process must be discoverable');
  check('plugin load publishes local management without MCPSTART',host.bridgeStarted===false&&host.compatible);
  const before=await manager.snapshot();if(!before.connected)check('discovery alone does not silently bind an AutoCAD instance',before.selectedInstanceId===null);
  const connected=await manager.connect(host.hostId);check('one-click management starts and authenticates actual ObjectARX',connected.connected&&connected.toolCount===toolNames.length&&connected.documentCount===1);
  return (await desktopRead(join(state,'binding.json'),desktopBindingSchema)).grantFile!;
 };
 first=await windowsSession(join(root,'first'),drawing,{units:4,module,runtimeRoot,desktopOnly:true,prepareBridge:connect});
 const call=async(name:string,args:any)=>{const result=await client!.callTool({name,arguments:args});if(result.isError)throw Error(name+': '+JSON.stringify(result.structuredContent));return result.structuredContent as any;};
 const create=async(s:NonNullable<typeof first>,radius:number)=>{const info=await call('acad_get_document_info',s.target);return call('acad_create_circle',{...s.target,operationId:randomUUID(),expectedRevision:info.revision,coordinateSystem:'WCS',lengthUnit:'mm',center:[0,0,0],radius});};
 check('desktop-bound MCP creates verified real geometry',(await create(first,5)).verified===true);
 const oldTarget=first.target;await first.close();first=undefined;
 check('actual AutoCAD close becomes disconnected',(await manager.snapshot()).connected===false);
 const stale=await client.callTool({name:'acad_get_status',arguments:{instanceId:oldTarget.instanceId}});check('closed session cannot continue accepting CAD calls',stale.isError===true);
 second=await windowsSession(join(root,'second'),drawing,{units:4,module,runtimeRoot,desktopOnly:true,prepareBridge:connect});
 check('same initialized MCP transport works after AutoCAD restart',(await create(second,7)).verified===true);
 const rejected=await client.callTool({name:'acad_get_status',arguments:{instanceId:oldTarget.instanceId}});check('old target is not silently mapped onto new AutoCAD',(rejected.structuredContent as any).error.code==='INSTANCE_NOT_FOUND');
 const thirdDrawing=join(root,'third-source.dwg');await copyFile(drawing,thirdDrawing);
 third=await windowsSession(join(root,'third'),thirdDrawing,{units:4,module,runtimeRoot,desktopOnly:true,prepareBridge:connect});
 check('two real AutoCAD processes appear as distinct explicit choices',(await manager.hosts()).length===2);
 const wrong=await client.callTool({name:'acad_get_status',arguments:{instanceId:second.target.instanceId}});check('choosing another process invalidates old client target',(wrong.structuredContent as any).error.code==='INSTANCE_NOT_FOUND');
 check('newly selected process receives only its own explicit geometry',(await create(third,9)).verified===true);
 check('reconnects preserve existing generated client configuration',await readFile(join(workspace,'claude/.mcp.json'),'utf8')===configText);
 const thirdInfo=await call('acad_get_document_info',third.target);const saved=await call('acad_save_copy',{...third.target,operationId:randomUUID(),expectedRevision:thirdInfo.revision,outputRootId:'test-output',relativePath:'desktop-circle.dwg',overwrite:false});check('desktop route retains separate DWG save verification',saved.verified===true);
 await manager.disconnect();const off=await client.callTool({name:'acad_list_instances',arguments:{}});check('disconnect clears selection without closing CAD',(off.structuredContent as any).instances.length===0&&(await third.call('acad_get_status',{instanceId:third.target.instanceId})).connected===true);
 await client.close();client=undefined;await second.close();second=undefined;await third.close();third=undefined;
 check('synthetic source bytes preserved',sha256(await readFile(drawing))===sourceHash);
 await manager.close();await writeFile(join(evidence,'results.json'),JSON.stringify({passed:true,checks,nativeSha256:provenance.sha256,nativeBuildId:provenance.buildId,modelCalls:0,automaticBundleLoadingTested:false},null,2));console.log('Evidence: '+evidence);
}catch(error){await writeFile(join(evidence,'results.json'),JSON.stringify({passed:false,checks,error:error instanceof Error?error.message:'Failure'},null,2));console.error('Failed desktop evidence: '+evidence);throw error;}
finally{await client?.close();await first?.terminate();await second?.terminate();await third?.terminate();await manager.close();}
