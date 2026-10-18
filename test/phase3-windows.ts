// Explicit synthetic desktop fault injection; never part of npm test.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { readFile, writeFile, readdir, rename, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { connect } from 'node:net';
import { BridgeClient, readGrant } from '../src/bridge.js';
import { FrameReader, sign, encodeBody, decodeBody } from '../src/protocol.js';
import type { ToolName } from '../src/tools.js';
if (process.platform !== 'win32' || process.env.AUTOCAD_MCP_PHASE3_TEST !== '1') throw new Error('Explicit Windows test opt-in required');
const config = JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-File', resolve('test/start-desktop.ps1'), '-TestRoot', resolve('tmp/desktop-runs', randomUUID()), '-AutoCADRoot', 'C:\\Program Files\\Autodesk\\AutoCAD 2027', '-Template', join(process.env.LOCALAPPDATA!, 'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'), '-Plugin', resolve(process.argv[2] ?? 'build/test-controls-check/Release/AutocadMcp.arx')], { encoding: 'utf8', windowsHide: true })) as {root:string;pid:number};
const root = config.root;
await writeFile('tmp/desktop-current.json', JSON.stringify(config));
console.log('Evidence: '+root);
const sleep = (ms:number) => new Promise(ok=>setTimeout(ok,ms));
let grantFile='';
for(let i=0;i<600&&!grantFile;i++) {
  for (const name of await readdir(join(root,'runtime'))) {
    const file=join(root,'runtime',name,'pairing.json');
    if(await readGrant(file).then(()=>true).catch(()=>false)) grantFile=file;
  }
  if(!grantFile) await sleep(100);
}
assert.ok(grantFile,'Plugin must start');
const grant=await readGrant(grantFile), bridge=new BridgeClient(grantFile);
assert.ok(grant.controlEndpoint);
const checks:Array<{name:string;passed:true}>=[];
const check=(name:string, condition:unknown)=>{assert.ok(condition,name);checks.push({name,passed:true});console.log('PASS '+name);};
const raw=async(name:string,args:Record<string,unknown>,client=bridge)=>await client.call(name as ToolName,args) as Record<string,any>;
const call=async(name:string,args:Record<string,unknown>)=>{const r=await raw(name,args);assert.ok(!r.error,name+': '+r.error?.code);return r;};
const control=(action:string)=>call('bridge.test_action',{instanceId:grant.instanceId,action});
const source=join(root,'primary.dwg');const sourceHash=createHash('sha256').update(await readFile(source)).digest('hex');
let failure:string|undefined; let processKilled=false;
try {
 const docs=await call('acad_list_documents',{instanceId:grant.instanceId});assert.equal(docs.documents.length,1);
 const a={instanceId:grant.instanceId,documentId:docs.documents[0].documentId,documentEpoch:docs.documents[0].documentEpoch};
 const info=()=>call('acad_get_document_info',a);
 const query=(extra={})=>call('acad_query_entities',{...a,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},limit:1000,...extra});
 const args=async(operationId:string)=>({...a,operationId,expectedRevision:(await info()).revision,coordinateSystem:'WCS',lengthUnit:'mm',start:[0,0,0],end:[100,0,0]});
 const status=(operationId:string)=>raw('acad_get_operation_status',{...a,operationId});
 const terminal=async(operationId:string)=>{for(let i=0;i<80;i++){const r=await status(operationId);if(!['running','queued'].includes(r.status))return r;await sleep(25);}throw Error('Terminal status not reached');};
 const running=async(operationId:string)=>{for(let i=0;i<50;i++){const r=await status(operationId);if(r.status==='running')return r;await sleep(10);}throw Error('Running status not observed');};
 check('real desktop and independent control endpoint', (await call('acad_get_status',{instanceId:grant.instanceId})).backend==='objectarx');
 const line=await call('acad_create_line',await args('p3-line'));
 await call('acad_create_circle',{...await args('p3-circle'),start:undefined,end:undefined,center:[0,100,0],radius:25});
 // Undefined fields are omitted by JSON serialization.
 const first=await query({limit:1,projection:['handle','start','volume']});
 const second=await query({limit:1,projection:['handle','start','volume'],cursor:first.cursor});
 check('paging returns distinct handles and projection marks unavailable fields', first.cursor&&first.items[0].handle!==second.items[0].handle&&first.items[0].unavailableFields.includes('volume'));
 check('cursor is bound to exact projection', (await raw('acad_query_entities',{...a,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},limit:1,projection:['type'],cursor:first.cursor})).error.code==='STALE_CURSOR');
 const missing={documentId:a.documentId,documentEpoch:a.documentEpoch,handle:'FFFFFFFFFFFFFFFE'};
 check('missing handle rejected', (await raw('acad_get_entity',{...a,coordinateSystem:'WCS',entityRef:missing})).error.code==='TARGET_NOT_FOUND');
 const beforeExternal=await info();await control('external_edit');
 check('external API edit invalidates revision and cursor', (await raw('acad_create_line',{...await args('p3-external-stale'),expectedRevision:beforeExternal.revision})).error.code==='STALE_REVISION'&&(await raw('acad_query_entities',{...a,coordinateSystem:'WCS',lengthUnit:'mm',filter:{},limit:1,projection:['handle','start','volume'],cursor:first.cursor})).error.code==='STALE_CURSOR');
 const seed=await control('seed_arc');
 check('unsupported entity rejected explicitly', (await raw('acad_move_entities',{...await args('p3-unsupported'),start:undefined,end:undefined,targets:[seed.entityRef],delta:[1,0,0]})).error.code==='UNSUPPORTED_ON_PLATFORM');
 const outerArgs=await args('p3-outer-transaction');await control('begin_outer_transaction');
 const outerRejected=await raw('acad_create_line',outerArgs);await control('end_outer_transaction');
 check('foreign unfinished transaction blocks a new mutation',outerRejected.error?.code==='DOC_BUSY'&&outerRejected.applied===false);
 const beforeAbort=(await query()).items.length;
 await control('abort_before_commit');const abortArgs=await args('p3-abort');const aborted=await raw('acad_create_line',abortArgs);
 check('failure after append aborts entire transaction', aborted.error.code==='EXECUTION_FAILED'&&aborted.applied===false&&(await query()).items.length===beforeAbort);
 check('terminal failure stays cached and queryable', JSON.stringify(await status('p3-abort'))===JSON.stringify(aborted)&&JSON.stringify(await raw('acad_create_line',abortArgs))===JSON.stringify(aborted));
 const atomicArgs={...await args('p3-group-invalid'),start:undefined,end:undefined,targets:[...line.created,missing],delta:[50,0,0]};
 const invalid=await raw('acad_move_entities',atomicArgs);
 const geometry=await call('acad_get_entity',{...a,coordinateSystem:'WCS',entityRef:line.created[0],projection:['start','end']});
 check('invalid second target leaves first target unchanged', invalid.applied===false&&geometry.entity.start[0]===0);
 await control('verify_after_commit');const verify=await raw('acad_create_line',await args('p3-verify'));
 check('post-commit verification failure reports applied true', verify.error.code==='VERIFICATION_FAILED'&&verify.applied===true&&verify.verified===false&&(await query()).items.length===beforeAbort+1);
 check('verification failure status preserves real effect', (await status('p3-verify')).applied===true);
 await control('delay_before_commit');const duplicateArgs=await args('p3-concurrent');
 const one=raw('acad_create_line',duplicateArgs,new BridgeClient(grantFile));
 await running('p3-concurrent');
 const conflict=raw('acad_create_line',{...duplicateArgs,end:[150,0,0]},new BridgeClient(grantFile));
 check('concurrent conflicting request rejected before effect', (await conflict).error.code==='IDEMPOTENCY_CONFLICT');
 const two=raw('acad_create_line',duplicateArgs,new BridgeClient(grantFile));
 check('status is responsive during running CAD work', (await status('p3-concurrent')).status==='running');
 const [r1,r2]=await Promise.all([one,two]);
 check('concurrent duplicate applies once and returns identical record', r1.verified&&JSON.stringify(r1)===JSON.stringify(r2)&&(await query()).items.length===beforeAbort+2);
 const beforeCancel=(await query()).items.length;
 await control('delay_before_commit');const cancelArgs=await args('p3-cancel'),abort=new AbortController();
 const waiting=assert.rejects(bridge.call('acad_create_line',cancelArgs,abort.signal),{code:'TIMEOUT_UNKNOWN'});
 await running('p3-cancel');abort.abort();await waiting;
 const cancelled=await terminal('p3-cancel');
 check('running abort reaches native and rolls transaction back', cancelled.status==='cancelled'&&cancelled.applied===false&&(await query()).items.length===beforeCancel);
 await control('delay_after_commit');const timeoutArgs=await args('p3-timeout');
 await assert.rejects(new BridgeClient(grantFile,100).call('acad_create_line',timeoutArgs),{code:'TIMEOUT_UNKNOWN'});
 check('timeout does not replace native state with unknown', ['queued','running','succeeded'].includes((await status('p3-timeout')).status));
 const reconciled=await terminal('p3-timeout');
 check('post-commit timeout reconciles to measured success', reconciled.applied===true&&reconciled.verified===true);
 check('retry after reconciliation returns same object', JSON.stringify(await raw('acad_create_line',timeoutArgs))===JSON.stringify(reconciled));
 const queuedBefore=(await query()).items.length;
 const blocker=await args('p3-queue-blocker'), queuedArgs={...blocker,operationId:'p3-native-queued'};
 await control('delay_before_commit');
 const blocking=raw('acad_create_line',blocker,new BridgeClient(grantFile));
 await running('p3-queue-blocker');
 const queuedAbort=new AbortController();
 const queuedWait=assert.rejects(new BridgeClient(grantFile).call('acad_create_line',queuedArgs,queuedAbort.signal),{code:'TIMEOUT_UNKNOWN'});
 let observedQueued=false;
 for(let i=0;i<50;i++){const r=await status('p3-native-queued');if(r.status==='queued'){observedQueued=true;break;}await sleep(10);}
 assert.ok(observedQueued,'Actual native queued state must be observed');queuedAbort.abort();await queuedWait;
 const queuedResult=await terminal('p3-native-queued');
 check('native queued cancellation is terminal before CAD execution',queuedResult.status==='cancelled'&&queuedResult.applied===false);
 await blocking;
 check('cancelled native queued mutation never changes geometry',(await query()).items.length===queuedBefore+1);
 const revokeBefore=(await query()).items.length, revokeArgs=await args('p3-active-revoke');
 const revokeQueued={...revokeArgs,operationId:'p3-queued-revoke'};
 await control('delay_before_commit');const activeRevoke=raw('acad_create_line',revokeArgs,new BridgeClient(grantFile));
 await running('p3-active-revoke');const queuedRevoke=raw('acad_create_line',revokeQueued,new BridgeClient(grantFile));
 let accepted=false;
 for(let i=0;i<50;i++){if((await status('p3-queued-revoke')).status==='queued'){accepted=true;break;}await sleep(10);}
 assert.ok(accepted);
 await rename(grantFile,grantFile+'.paused');
 let revokedResults:Record<string,any>[];
 try{revokedResults=await Promise.all([activeRevoke,queuedRevoke]);}finally{await rename(grantFile+'.paused',grantFile);}
 check('revocation is rechecked before commit and queued CAD execution',revokedResults.every(r=>r.error?.code==='IPC_AUTH_FAILED'&&r.applied===false));
 check('revoked queued and running writes leave geometry unchanged',(await query()).items.length===revokeBefore);
 await control('veto_on');const vetoArgs={...a,operationId:'p3-veto',expectedRevision:(await info()).revision,coordinateSystem:'WCS',lengthUnit:'mm',start:[0,0,0],end:[10,0,0]};
 const veto=await raw('acad_create_line',vetoArgs);await control('veto_off');
 check('external lock veto returns busy without mutation', veto.error?.code==='DOC_BUSY'&&veto.applied===false);
 await control('modal');
 let modalSeen=false;
 for(let i=0;i<100;i++){const probe=await raw('bridge.test_probe',{instanceId:grant.instanceId});if(probe.modalActive&&!probe.mainEnabled){modalSeen=true;break;}await sleep(10);}
 assert.ok(modalSeen,'Actual OS modal and disabled owner must be observed');
 const modal=await raw('acad_get_document_info',a);
 check('OS modal dialog blocks CAD work without dismissing it', modal.error?.code==='DOC_BUSY');
 for(let i=0;i<200;i++){if((await raw('bridge.test_probe',{instanceId:grant.instanceId})).mainEnabled)break;await sleep(15);}
 const ro=await control('open_readonly');
 check('secondary really opened read-only',ro.readOnly===true);
 const readOnly=await raw('acad_create_line',{...await args('p3-readonly'),documentId:ro.documentId,documentEpoch:ro.documentEpoch,expectedRevision:ro.revision});
 check('read-only drawing mutation rejected',readOnly.error?.code==='DOC_READ_ONLY'&&readOnly.applied===false);
 await control('close_secondary');await control('activate_primary');
 let stableIdle=0;for(let i=0;i<80;i++){const c=await control('context');stableIdle=c.primaryQuiescent&&!c.commandActive&&c.active.documentId===a.documentId?stableIdle+1:0;if(stableIdle>=3)break;await sleep(50);}assert.ok(stableIdle>=3,'Synthetic primary must finish activation');
 await info();
 const saveArgs=async(operationId:string,relativePath:string)=>({...a,operationId,expectedRevision:(await info()).revision,outputRootId:'test-output',relativePath,overwrite:false});
 await control('reopen_failure');const reopen=await raw('acad_save_copy',await saveArgs('p3-reopen','reopen-fail.dwg'));
 const output=join(root,'runtime',grant.instanceId,'output');
 check('snapshot reopen failure leaves no published file',reopen.error?.code==='EXECUTION_FAILED'&&reopen.applied===false&&!(await readdir(output)).includes('reopen-fail.dwg'));
 await control('source_side_effect');
 const partial=await raw('acad_save_copy',await saveArgs('p3-partial','partial-no-output.dwg'));
 check('known source side effect is reported as partial with applied true',partial.status==='partial'&&partial.error?.code==='PARTIAL_APPLY'&&partial.applied===true&&(await info()).insunits===6);
 check('partial snapshot never publishes an unverified output',!(await readdir(output)).includes('partial-no-output.dwg'));
 await control('restore_units');
 check('partial terminal result stays immutable after test-only repair',(await status('p3-partial')).status==='partial'&&(await info()).insunits===4);
 let attempted=false,blocked=false;
 const parent=resolve(output,'..');
 const watcher=watch(output,(_event,name)=>{if(attempted||!name?.toString().startsWith('staging-'))return;attempted=true;void rename(parent,parent+'-race').then(()=>{},()=>{blocked=true;});});
 await call('acad_save_copy',await saveArgs('p3-parent-race','parent-race.dwg'));watcher.close();await sleep(50);
 check('pinned output ancestor cannot be renamed while saving',attempted&&blocked);
 await control('delay_after_publish');const lostSave=await saveArgs('p3-save-lost','saved-once.dwg');
 await assert.rejects(new BridgeClient(grantFile,100).call('acad_save_copy',lostSave),{code:'TIMEOUT_UNKNOWN'});
 const saved=await terminal('p3-save-lost');
 check('lost save response reconciles without second publication',saved.applied===true&&saved.verified===true&&JSON.stringify(await raw('acad_save_copy',lostSave))===JSON.stringify(saved)&&(await stat(join(output,'saved-once.dwg'))).size>0);
 // Exercise the actual ObjectARX transport with malformed peers. Secrets stay only in memory.
 const attack=async(make:(nonce:string)=>string|Buffer,endpoint=grant.endpoint):Promise<any>=>new Promise((ok,fail)=>{
   const socket=connect(endpoint),frames=new FrameReader();let sent=false,answer:any;
   const timer=setTimeout(()=>{socket.destroy();fail(Error('Malformed peer did not disconnect'));},2500);
   socket.on('error',()=>{});socket.on('close',()=>{clearTimeout(timer);ok(answer);});
   socket.on('data',(chunk:Buffer)=>{for(const frame of frames.push(chunk)){const packet=JSON.parse(frame);if(!sent){sent=true;socket.write(make(packet.nonce));}else{answer=decodeBody(packet.body);socket.destroy();}}});
 });
 const envelope=(nonce:string,body:string)=>JSON.stringify({nonce,body,mac:sign(grant.secret,'request',nonce,body)})+'\n';
 check('control channel refuses mutation methods',(await attack(n=>envelope(n,encodeBody({jsonrpc:'2.0',id:1,method:'acad_create_line',params:timeoutArgs})),grant.controlEndpoint)).result.error.code==='SECURITY_DENIED');
 check('native transport rejects wrong instance',(await attack(n=>envelope(n,encodeBody({jsonrpc:'2.0',id:1,method:'acad_get_status',params:{instanceId:'wrong-instance'}})))).result.error.code==='INSTANCE_NOT_FOUND');
 check('wrong HMAC rejected by real native pipe',await attack(n=>JSON.stringify({nonce:n,body:encodeBody({}),mac:'0'.repeat(64)})+'\n')===undefined);
 check('duplicate envelope keys rejected',await attack(n=>`{"nonce":"${n}","nonce":"${n}","body":"e30=","mac":"00"}\n`)===undefined);
 for(const [name,body] of [['duplicate body','{"x":1,"x":2}'],['deep body','['.repeat(12)+'0'+']'.repeat(12)],['nonfinite body','{"x":1e400}'],['invalid UTF8',Buffer.from([0xff]).toString('base64')]] as const){
   const b=name==='invalid UTF8'?body:Buffer.from(body).toString('base64');
   check(name+' rejected before CAD API',(await attack(n=>envelope(n,b))).result.error.code==='VALIDATION_FAILED');
 }
 check('oversize frame rejected',await attack(()=>Buffer.alloc(1024*1024+2,65))===undefined);
 const originalGrant=await readFile(grantFile);
 await rename(grantFile,grantFile+'.revoked');
 try { const rejected=await attack(n=>envelope(n,encodeBody({jsonrpc:'2.0',id:1,method:'acad_get_operation_status',params:{...a,operationId:'p3-line'}})),grant.controlEndpoint);
 check('revoked pairing denies cached status to authenticated peer',rejected.result.error.code==='IPC_AUTH_FAILED'); }
 finally{await rename(grantFile+'.revoked',grantFile);assert.deepEqual(await readFile(grantFile),originalGrant);}
 check('unknown record never asserts no effect',(await status('p3-never-submitted')).applied===null);
 check('source DWG bytes preserved',createHash('sha256').update(await readFile(source)).digest('hex')===sourceHash);
 const known=await status('p3-timeout');await control('seal_records');
 const quota=await raw('acad_create_line',await args('p3-quota'));
 check('native record capacity refuses new mutation before effect',quota.error?.code==='DOC_BUSY'&&quota.applied===false);
 check('known retry survives full capacity and old revision',JSON.stringify(await raw('acad_create_line',timeoutArgs))===JSON.stringify(known));
 check('known terminal failure survives full capacity',JSON.stringify(await raw('acad_create_line',abortArgs))===JSON.stringify(aborted));
 // Rollback uncertainty is injected only in the test build, after the real abort call.
 // It tests conservative reporting and write quarantine, not an actual SDK abort failure.
 // Full-capacity test above has sealed the ledger: use the already-known records first,
 // then restart below and inject uncertainty in the fresh session instead.
 await control('assert_owned');
 try { await control('restart'); } catch { /* Stop may close the reply socket; never resubmit a mutation. */ }
 let replacement='';
 for(let i=0;i<200&&!replacement;i++) {
   for(const name of await readdir(join(root,'runtime'))) {
     if(name===grant.instanceId)continue;
     const file=join(root,'runtime',name,'pairing.json');
     if(await readGrant(file).then(()=>true).catch(()=>false))replacement=file;
   }
   if(!replacement)await sleep(50);
 }
 assert.ok(replacement,'Restarted plugin must publish fresh pairing');
 const fresh=await readGrant(replacement), next=new BridgeClient(replacement);
 check('restart revokes old pairing and rotates instance',fresh.instanceId!==grant.instanceId&&!await readGrant(grantFile).then(()=>true).catch(()=>false));
 await assert.rejects(next.call('acad_get_status',{instanceId:grant.instanceId}),{code:'INSTANCE_NOT_FOUND'});
 check('old instance never silently retargeted after restart',true);
 const after=(await next.call('acad_list_documents',{instanceId:fresh.instanceId})).documents as any[];
 check('restart gives fresh document identity and epoch',after.length===1&&after[0].documentId!==a.documentId&&after[0].documentEpoch>a.documentEpoch);
 const target={instanceId:fresh.instanceId,documentId:after[0].documentId,documentEpoch:after[0].documentEpoch};
 const lost=await next.call('acad_get_operation_status',{...target,operationId:'p3-timeout'});
 check('missing record after restart is unknown, never a replay',lost.status==='unknown'&&lost.applied===null);
 await next.call('bridge.test_action' as ToolName,{instanceId:fresh.instanceId,action:'abort_unconfirmed'});
 const uncertain=await next.call('acad_create_line',{...target,operationId:'p3-unconfirmed',expectedRevision:after[0].revision,coordinateSystem:'WCS',lengthUnit:'mm',start:[0,0,0],end:[9,0,0]});
 check('unconfirmed rollback reports unknown effect, never false rollback',uncertain.status==='unknown'&&uncertain.applied===null&&uncertain.error!=null);
 const quarantined=await next.call('acad_create_line',{...target,operationId:'p3-quarantine',expectedRevision:after[0].revision,coordinateSystem:'WCS',lengthUnit:'mm',start:[0,0,0],end:[8,0,0]});
 check('unconfirmed rollback quarantines further writes',quarantined.status==='failed'&&(quarantined.error as any)?.code==='DOC_BUSY');
 // Restart the owned plugin after the confirmed test abort; remaining foreign
 // transactions would still block writes through the normal transaction guard.
 try{await next.call('bridge.test_action' as ToolName,{instanceId:fresh.instanceId,action:'restart'});}catch{}
 let finalFile='';
 for(let i=0;i<200&&!finalFile;i++){
   for(const name of await readdir(join(root,'runtime'))){if(name===grant.instanceId||name===fresh.instanceId)continue;const file=join(root,'runtime',name,'pairing.json');if(await readGrant(file).then(()=>true).catch(()=>false))finalFile=file;}
   if(!finalFile)await sleep(50);
 }
 assert.ok(finalFile);const finalGrant=await readGrant(finalFile), finalClient=new BridgeClient(finalFile);
 const finalDocs=(await finalClient.call('acad_list_documents',{instanceId:finalGrant.instanceId})).documents as any[];
 const finalTarget={instanceId:finalGrant.instanceId,documentId:finalDocs[0].documentId,documentEpoch:finalDocs[0].documentEpoch};
 // End by killing only this owned synthetic process during actual native work.
 assert.equal((await finalClient.call('bridge.test_action' as ToolName,{instanceId:finalGrant.instanceId,action:'assert_owned'})).owned,true);
 await finalClient.call('bridge.test_action' as ToolName,{instanceId:finalGrant.instanceId,action:'delay_before_commit'});
 const deathArgs={...finalTarget,operationId:'p3-process-death',expectedRevision:finalDocs[0].revision,coordinateSystem:'WCS',lengthUnit:'mm',start:[0,0,0],end:[70,0,0]};
 const death=assert.rejects(finalClient.call('acad_create_line',deathArgs),{code:'TIMEOUT_UNKNOWN'});
 let started=false;
 for(let i=0;i<50;i++) {
   const r=await finalClient.call('acad_get_operation_status',{...finalTarget,operationId:deathArgs.operationId});
   if(r.status==='running'){started=true;break;}await sleep(10);
 }
 assert.ok(started,'Owned process death must occur after native execution started');
 execFileSync('pwsh.exe',['-NoProfile','-File',resolve('test/stop-owned-desktop.ps1'),'-Configuration',resolve('tmp/desktop-current.json')],{windowsHide:true});
 processKilled=true;await death;
 check('process death after submission preserves unknown effect',true);
 await assert.rejects(finalClient.call('acad_get_status',{instanceId:finalGrant.instanceId}),{code:'IPC_UNAVAILABLE'});
 check('dead native endpoint reports unavailable without mutation replay',true);

} catch(error){ failure=error instanceof Error?error.message:'Unknown failure';process.exitCode=1;console.error(failure); }
finally {
 await writeFile(join(root,'phase3-results.json'),JSON.stringify({platform:'windows-x64',host:'AutoCAD 2027 desktop',checks,failure,mac:'not-run'},null,2));
 console.log(`Phase 3 checks: ${checks.length}`);
 if(!failure&&!processKilled&&process.env.AUTOCAD_MCP_DESKTOP_CLOSE==='1')await control('quit');
}
