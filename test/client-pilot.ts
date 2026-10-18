// Operator-only live model acceptance. Never runs with npm test.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { BridgeClient } from '../src/bridge.js';
if(process.platform!=='win32'||process.env.AUTOCAD_MCP_CLIENT_TEST!=='1')throw Error('Explicit client test opt-in required');
const [client,phase]=process.argv.slice(2);
if(!['opencode','codex'].includes(client??'')||!['probe','draw','edit'].includes(phase??''))throw Error('Arguments: opencode|codex probe|draw|edit');
const config=JSON.parse((await readFile('tmp/phase4-current.json','utf8')).replace(/^\uFEFF/,'')) as {workspace:string;root:string;grantFile:string;instanceId:string};
const bridge=new BridgeClient(config.grantFile);
const docs=await bridge.call('acad_list_documents',{instanceId:config.instanceId});
if(!Array.isArray(docs.documents)||docs.documents.length!==1)throw Error('Exactly one operator-owned synthetic drawing required');
const d=docs.documents[0] as Record<string,unknown>;
const target={instanceId:config.instanceId,documentId:d.documentId,documentEpoch:d.documentEpoch};
const fixture=JSON.parse(await readFile('test/fixtures/notched-plate.json','utf8'));
const common=`This is an explicitly authorized AutoCAD MCP client acceptance exercise, not a coding/delegation task. Use the autocad-mcp skill. Never delegate, use shell or other CAD APIs, edit configuration/code, read pairing.json/credentials/personal files, or commit/push. Only the autocad MCP server may read/change geometry. The only authorized target is ${JSON.stringify(target)}. Millimetres, WCS, symmetry and hole diameter 10 mm are confirmed by the user. No photo is attached or sent. Unsupported native dimensions/text must be reported as omitted. Use fresh document_info revisions, unique operationIds and reconcile unknown results; never blindly repeat a mutation.\n`;
const readSkill=client==='codex'?`Read the skill through the autocad MCP resource skill://autocad-mcp/autocad-mcp/SKILL.md, and references/tools.md if needed, using MCP resource access; do not try filesystem/shell reads. This avoids a known shell policy rejection.\n`:`Load the autocad-mcp skill with the skill tool.\n`;
let task='Call list_instances, get_status, get_capabilities and list_documents. Report actual backend, tool count and document identity. Do not modify anything.';
if(phase==='draw')task=`First confirm the target drawing has no entities. Then reproduce this exact 2D profile with 20 separate LINE entities joining these vertices in order, with the final vertex joined back to the first: ${JSON.stringify(fixture.vertices)}. Add one CIRCLE center [0,0,0], radius 5, normal [0,0,1]. Use exactly these 21 geometry entities; do not add dimension lines, text or centerlines. Intended dimensions: width 80, height 40, side inner edges at x=-25 and x=25, side opening 20, middle notch width 20, middle inner edges y=-15 and y=15. Outer perimeter 320 mm. Query all 21 using projection handle,type,start,end,center,radius and compare the coordinates. Then move all 21 by [5,0,0], verify, move them back by [-5,0,0], verify the original coordinates. Save a new copy teknik-resim-opencode.dwg with overwrite=false and outputRootId from capabilities. Stop and report known effects on any unresolved error. Prefix operationIds with p4-oc. End with the actual entity count, extents, hole diameter, and save result.`;
if(phase==='edit')task='Inspect the existing 21-entity profile from the other client. Confirm all dimensions from endpoint/radius queries: bounds [-40,-20,0]..[40,20,0], central circle radius 5. Create only one temporary test circle center [100,10,0], radius 2 with operationId p4-cx-create. Move only that circle by [10,0,0] (p4-cx-move) and verify center [110,10,0]. Erase only that temporary circle (p4-cx-erase), independently query the remaining 21 entities and confirm the original profile is unchanged. Save a new copy teknik-resim-codex.dwg using outputRootId from capabilities and overwrite=false, operationId p4-cx-save. Do not erase or alter the 21 profile entities. Report actual measured results and omitted annotations.';
const prompt=common+readSkill+task;
const prefix=join(config.root,`${client}-${phase}`);await writeFile(prefix+'-prompt.txt',prompt);
let executable:string,args:string[];
if(client==='opencode'){
 executable=join(process.env.APPDATA!,'npm/node_modules/opencode-ai/bin/opencode.exe');
 args=['--pure','run','-m','evren/mimo-v2.6-pro','--variant','max','--format','json',prompt];
}else{
 executable=join(process.env.APPDATA!,'npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
 const cliArgs=[resolve('dist/src/pilot.js'),'serve','--session-file',join(config.workspace,'autocad-session.json')];
 args=['exec','--ignore-user-config','--ephemeral','--disable','multi_agent','--disable','multi_agent_v2','-s','read-only','-m','gpt-6.1-sol','-c','model_reasoning_effort="high"','-c',`mcp_servers.autocad.command=${JSON.stringify(process.execPath)}`,'-c',`mcp_servers.autocad.args=${JSON.stringify(cliArgs)}`,'-c','mcp_servers.autocad.required=true','-c','mcp_servers.autocad.default_tools_approval_mode="approve"','--json',prompt];
}
const out=createWriteStream(prefix+'.jsonl'),err=createWriteStream(prefix+'.stderr.log');
const child=spawn(executable,args,{cwd:join(config.workspace,client!),windowsHide:true,env:process.env,stdio:['ignore','pipe','pipe']});
child.stdout!.pipe(out);child.stderr!.pipe(err);
const started=Date.now();let timedOut=false;
const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},15*60*1000);
const exitCode=await new Promise<number|null>((ok,fail)=>{child.once('error',fail);child.once('close',ok);});clearTimeout(timer);
await Promise.all([new Promise<void>(ok=>out.closed?ok():out.once('close',()=>ok())),new Promise<void>(ok=>err.closed?ok():err.once('close',()=>ok()))]);
const events=(await readFile(prefix+'.jsonl','utf8')).split(/\r?\n/).flatMap(line=>{try{return[JSON.parse(line)];}catch{return[];}});
const tools=events.flatMap(e=>e.part?.type==='tool'?[{name:e.part.tool,status:e.part.state?.status}]:e.item?.type==='mcp_tool_call'&&e.type==='item.completed'?[{name:e.item.tool,status:e.item.status}]:[]);
const errors=events.filter(e=>e.type==='error');
// Model completion is not the CAD acceptance verdict. A model may recover a
// rejected request; record tool failures explicitly and verify geometry separately.
const summary={client,phase,exitCode,timedOut,elapsedMs:Date.now()-started,tools,toolFailures:tools.filter(t=>t.status==='failed'||t.status==='error').length,errors:errors.length,sourcePhotoSent:false,claudeTested:false};
await writeFile(prefix+'-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
if(exitCode!==0||timedOut||errors.length)process.exitCode=1;
