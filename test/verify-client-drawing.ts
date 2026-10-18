// Independent geometry/reopen acceptance. No model or geometry mutation.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream, constants } from 'node:fs';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { BridgeClient, readGrant } from '../src/bridge.js';
import { verifyNotchedPlate, observedSvg, type Observed } from './notched-plate.js';
import type { ToolName } from '../src/tools.js';
if(process.platform!=='win32'||process.env.AUTOCAD_MCP_CLIENT_TEST!=='1')throw Error('Explicit live verification opt-in required');
const mode=process.argv[2];if(!['opencode','both'].includes(mode??''))throw Error('Pass opencode or both');
const config=JSON.parse((await readFile('tmp/phase4-current.json','utf8')).replace(/^\uFEFF/,''));
assert.equal(dirname(resolve(config.root)),resolve('tmp/desktop-runs'));
const hash=async(file:string)=>createHash('sha256').update(await readFile(file)).digest('hex');
const projection=['handle','type','start','end','center','radius'];
async function inspect(file:string){
 const grant=await readGrant(file),client=new Client({name:'independent-drawing-verifier',version:'0.1.0'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve('dist/src/main.js'),'--grant-file',file],stderr:'pipe'}));
 try{
  const call=async(name:ToolName,args:Record<string,unknown>)=>{const reply=await client.callTool({name,arguments:args});assert.ok(!reply.isError,name+' must succeed');return reply.structuredContent as Record<string,any>;};
  const documents=(await call('acad_list_documents',{instanceId:grant.instanceId})).documents;assert.equal(documents.length,1);
  const target={instanceId:grant.instanceId,documentId:documents[0].documentId,documentEpoch:documents[0].documentEpoch};
  const info=await call('acad_get_document_info',target);assert.equal(info.insunits,4);
  const query=await call('acad_query_entities',{...target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},projection,limit:1000});
  assert.equal(query.cursor,null);assert.equal(query.scanned,21,'No unsupported or unobserved entity may be hidden');
  const measured=verifyNotchedPlate(query.items as Observed[]);
  return {measured,items:query.items as Observed[],target,revision:info.revision,dirty:info.dirty};
 }finally{await client.close();}
}
async function reopen(source:string){
 const root=resolve('tmp/reopen-runs',randomUUID());await mkdir(join(root,'runtime'),{recursive:true});
 const input=join(root,'copy.dwg');await copyFile(source,input,constants.COPYFILE_EXCL);const before=await hash(input);
 const module=resolve('tmp/AutocadMcp-phase4.crx');await copyFile('build/native/Release/AutocadMcp.arx',module);
 const slash=(p:string)=>p.replaceAll('\\','/');const script=join(root,'inspect.scr');
 // Core Console asks "Really want to discard all changes?"; Yes discards.
 // No refuses discard and can save the scratch input on script termination.
 await writeFile(script,`(setvar "TRUSTEDPATHS" "${slash(dirname(module))}")\n(arxload "${slash(module)}")\nMCPSTART\nMCPPUMP\nMCPSTOP\n_.QUIT\n_Y\n`);
 const log=createWriteStream(join(root,'autocad.log'));
 const child=spawn('C:\\Program Files\\Autodesk\\AutoCAD 2027\\accoreconsole.exe',['/i',input,'/s',script,'/isolate','AutocadMcpPhase4',resolve('tmp/phase4-reopen-profile'),'/l','en-US'],{cwd:root,windowsHide:true,env:{...process.env,MCP_RUNTIME_DIR:join(root,'runtime'),MCP_TEST_MODE:'1'},stdio:['ignore','pipe','pipe']});
 child.stdout!.pipe(log,{end:false});child.stderr!.pipe(log,{end:false});
 let closed=false;const exit=new Promise<number|null>((ok,fail)=>{child.on('error',fail);child.on('close',code=>{closed=true;ok(code);});});
 let grantFile='';
 try{
  for(let i=0;i<600&&!grantFile;i++){
   if(closed)throw Error('Core Console closed before plugin initialization');
   for(const n of await readdir(join(root,'runtime'))){const file=join(root,'runtime',n,'pairing.json');if(await readGrant(file).then(()=>true).catch(()=>false))grantFile=file;}
   if(!grantFile)await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(grantFile,'Reopen pairing required');const inspected=await inspect(grantFile);
  const grant=await readGrant(grantFile);await new BridgeClient(grantFile).call('bridge.test_done' as ToolName,{instanceId:grant.instanceId});
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  try{await Promise.race([exit,new Promise((_,reject)=>{exitTimer=setTimeout(()=>reject(Error('Core Console exit timeout')),15000);})]);}
  finally{clearTimeout(exitTimer);}
  assert.equal(await hash(input),before,'Read-only reopen must preserve saved DWG bytes');
  await writeFile(join(root,'verification.json'),JSON.stringify({sourceHash:await hash(source),measured:inspected.measured,sourceBytesPreserved:true},null,2));
  return {root,measured:inspected.measured,sourceBytesPreserved:true};
 }finally{if(!closed)child.kill('SIGTERM');log.end();}
}
const original=await inspect(config.grantFile);
const template=join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt');
assert.equal(await hash(join(config.root,'primary.dwg')),await hash(template),'Original template copy must remain unchanged');
const output=join(dirname(config.grantFile),'output');
const names=mode==='both'?['teknik-resim-opencode.dwg','teknik-resim-codex.dwg']:['teknik-resim-opencode.dwg'];
const reopens=[];
for(const name of names){const result=await reopen(join(output,name));assert.deepEqual(result.measured,original.measured);reopens.push({name,...result});}
const exportRoot=resolve('runtime/exports',config.root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});
for(const name of names){const target=join(exportRoot,name);try{await copyFile(join(output,name),target,constants.COPYFILE_EXCL);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;assert.equal(await hash(target),await hash(join(output,name)));}}
await writeFile(join(exportRoot,'observed-geometry.json'),JSON.stringify({measured:original.measured,items:original.items},null,2));
await writeFile(join(exportRoot,'teknik-resim.svg'),observedSvg(original.items));
const report={mode,actualBackend:'objectarx',original:original.measured,sourceBytesPreserved:true,reopens,exportRoot,annotations:'Native dimensions and text are not supported; DWG contains only the measured profile and circle.'};
await writeFile(join(config.root,`verification-${mode}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
