// Isolated, opt-in native acceptance helper. Never changes an existing CAD session.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream, constants } from 'node:fs';
import { mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { BridgeClient, readGrant } from '../src/bridge.js';
import type { ToolName } from '../src/tools.js';

export async function windowsSession(root: string, input: string, options: {units?:number; undo?:boolean; module?:string; defaultRuntime?:boolean; desktopOnly?:boolean; runtimeRoot?:string; prepareBridge?:(paths:{hostsRoot:string;cadRoot:string;processId:number})=>Promise<string>}={}) {
 if(process.platform!=='win32'||process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Windows Phase5 opt-in required');
 root=resolve(root);const parent=resolve('tmp/phase5-runs');
 if(!root.startsWith(parent+'\\'))throw Error('Session must be in a private phase5 test directory');
 await mkdir(root,{recursive:true});
 const runtimeRoot=options.runtimeRoot?resolve(options.runtimeRoot):options.defaultRuntime?join(root,'local-appdata/AutocadMCP/runtime'):join(root,'runtime');
 if(!runtimeRoot.startsWith(parent+'\\'))throw Error('Runtime must stay inside synthetic phase5 test tree');
 await mkdir(runtimeRoot,{recursive:true});
 const module=join(root,'AutocadMcp.crx');await copyFile(options.module??process.env.AUTOCAD_MCP_TEST_MODULE??'build/phase5-native/Release/AutocadMcp.arx',module,constants.COPYFILE_EXCL);
 const slash=(p:string)=>p.replaceAll('\\','/'),script=join(root,'start.scr');
 await writeFile(script,`(setvar "TRUSTEDPATHS" "${slash(root)}")\n${options.units===undefined?'':`(setvar "INSUNITS" ${options.units})\n`}(arxload "${slash(module)}")\n${options.desktopOnly?'':'MCPSTART\n'}MCPPUMP\n${options.undo?'_.UNDO\n1\nMCPPUMP\n':''}MCPSTOP\n_.QUIT\n_Y\n`);
 const log=createWriteStream(join(root,'autocad.log'));
 const cadEnv:NodeJS.ProcessEnv={...process.env,MCP_RUNTIME_DIR:runtimeRoot,MCP_TEST_MODE:'1'};
 if(options.defaultRuntime){delete cadEnv.MCP_RUNTIME_DIR;cadEnv.LOCALAPPDATA=join(root,'local-appdata');}
 const child=spawn('C:/Program Files/Autodesk/AutoCAD 2027/accoreconsole.exe',['/i',resolve(input),'/s',script,'/isolate','AutocadMcpPhase5-'+randomUUID(),join(root,'profile'),'/l','en-US'],{cwd:root,windowsHide:true,env:cadEnv,stdio:['ignore','pipe','pipe']});
 child.stdout!.pipe(log,{end:false});child.stderr!.pipe(log,{end:false});
 let closed=false;const exit=new Promise<number|null>((ok,fail)=>{child.once('error',fail);child.once('close',code=>{closed=true;ok(code);});});
 const client=new Client({name:'phase5-native-acceptance',version:'0.1.0'});
 let grantFile='';
 const terminate=async()=>{await client.close().catch(()=>{});if(!closed)child.kill();log.end();};
 try {
  if(options.prepareBridge)grantFile=await options.prepareBridge({hostsRoot:join(runtimeRoot,'desktop-hosts'),cadRoot:runtimeRoot,processId:child.pid!});
  for(let i=0;i<600&&!grantFile;i++) {
   if(closed)throw Error('AutoCAD closed before MCP startup');
   for(const name of await readdir(runtimeRoot)){const candidate=join(runtimeRoot,name,'pairing.json');if(await readGrant(candidate).then(()=>true).catch(()=>false))grantFile=candidate;}
   if(!grantFile)await new Promise(ok=>setTimeout(ok,100));
  }
  if(!grantFile)throw Error('MCP startup timeout');
  const grant=await readGrant(grantFile),bridge=new BridgeClient(grantFile);
  await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve('dist/src/main.js'),'--grant-file',grantFile],stderr:'pipe'}));
  const call=async(name:ToolName,args:Record<string,unknown>)=>{const reply=await client.callTool({name,arguments:args});const data=reply.structuredContent as Record<string,any>;if(reply.isError)throw Error(name+': '+(data?.error?.code??'MCP error')+' '+(data?.error?.message??''));return data;};
  const status=await call('acad_get_status',{instanceId:grant.instanceId});if(status.backend!=='objectarx'||status.simulation!==false)throw Error('Real backend required');
  const docs=await call('acad_list_documents',{instanceId:grant.instanceId});if(docs.documents.length!==1)throw Error('Exactly one synthetic document required');
  const d=docs.documents[0],target={instanceId:grant.instanceId,documentId:d.documentId,documentEpoch:d.documentEpoch};
  const finishPump=()=>bridge.call('bridge.test_done' as ToolName,{instanceId:grant.instanceId});
  return {root,client,call,target,bridge,grantFile,output:join(dirname(grantFile),'output'),finishPump,terminate,close:async()=>{
   await finishPump();let timer:ReturnType<typeof setTimeout>|undefined;
   try{const code=await Promise.race([exit,new Promise((_,no)=>{timer=setTimeout(()=>no(Error('AutoCAD exit timeout')),15000);})]);if(code!==0)throw Error('AutoCAD did not exit normally');}
   finally{clearTimeout(timer);await terminate();}
  }};
 }catch(error){await terminate();throw error;}
}
