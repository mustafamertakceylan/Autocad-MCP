import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTool} from '../src/tools.js';
import {writeFile} from 'node:fs/promises';
import {BridgeClient} from '../src/bridge.js';
import {mockPlugin,cleanupFixture} from './fixture.js';
const base={instanceId:'i',documentId:'d',documentEpoch:1,operationId:'o',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};
test('controlled batches reject commands, nested batches and per-step identity overrides',()=>{
 assert.throws(()=>validateTool('acad_run_batch',{...base,steps:[{tool:'command',text:'(load "x")'}]}));
 assert.throws(()=>validateTool('acad_run_batch',{...base,steps:[{tool:'acad_run_batch',steps:[]}]}));
 assert.throws(()=>validateTool('acad_run_batch',{...base,steps:[{tool:'acad_create_line',start:[0,0,0],end:[1,0,0],documentId:'another'}]}));
 assert.throws(()=>validateTool('acad_run_batch',{...base,steps:[{tool:'acad_create_box',center:[0,0,0],size:[1,-1,1]}]}));
 assert.equal((validateTool('acad_run_batch',{...base,steps:[{tool:'acad_create_circle',center:[0,0,0],radius:1}]}).steps as any[]).length,1);
});
test('PDF and staged DWG schemas reject path traversal and external input roots',()=>{
 assert.throws(()=>validateTool('acad_export_pdf',{...base,coordinateSystem:undefined,lengthUnit:undefined,layoutName:'A4',outputRootId:'test-output',relativePath:'../x.pdf',overwrite:false}));
 const {coordinateSystem,lengthUnit,...mutation}=base;
 assert.throws(()=>validateTool('acad_export_pdf',{...mutation,layoutName:'A4',outputRootId:'test-output',relativePath:'CON.pdf',overwrite:false}));
 assert.throws(()=>validateTool('acad_attach_xref',{...base,inputRootId:'C:/private',relativePath:'part.dwg',name:'X',position:[0,0,0]}));
 assert.throws(()=>validateTool('acad_attach_xref',{...base,inputRootId:'session-input',relativePath:'../private.dwg',name:'X',position:[0,0,0]}));
});
test('a batch cannot bypass a revoked constituent tool permission',async()=>{
 const plugin=await mockPlugin();try{
  await writeFile(plugin.grantFile,JSON.stringify({...plugin.grant,operations:['acad_run_batch']}));
  const bridge=new BridgeClient(plugin.grantFile);await assert.rejects(bridge.call('acad_run_batch',{instanceId:plugin.grant.instanceId,steps:[{tool:'acad_create_line'}]}),{code:'SECURITY_DENIED'});
  assert.equal(plugin.calls(),0);
 }finally{await plugin.close();await cleanupFixture(plugin.folder);}
});
