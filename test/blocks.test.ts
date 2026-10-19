import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTool } from '../src/tools.js';
import { grantSchema } from '../src/bridge.js';
const base={instanceId:'inst-1',documentId:'doc-1',documentEpoch:1,operationId:'block-1',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};
const entityRef={documentId:'doc-1',documentEpoch:1,handle:'1'};
test('block definitions and attributes reject ambiguous tags, fields and implicit file access',()=>{
 const definition={...base,name:'PART',basePoint:[0,0,0],targets:[entityRef]};
 const a={tag:'PART_NO',prompt:'Part number',defaultValue:'P-001',position:[0,-4,0],height:2};
 assert.equal((validateTool('acad_define_block',{...definition,attributes:[a]}).attributes as any[]).length,1);
 assert.throws(()=>validateTool('acad_define_block',{...definition,attributes:[a,a]}));
 assert.throws(()=>validateTool('acad_insert_block',{...base,name:'PART',position:[0,0,0],attributes:{PART_NO:'%<field>%'}}));
 assert.throws(()=>validateTool('acad_insert_block',{...base,name:'../file.dwg',position:[0,0,0]}));
 assert.throws(()=>validateTool('acad_insert_block',{...base,name:'PART',position:[0,0,1]}));
 const {coordinateSystem,lengthUnit,...target}=base;
 assert.throws(()=>validateTool('acad_set_attributes',{...target,entityRef,attributes:{}}));
 assert.throws(()=>validateTool('acad_set_attributes',{...target,entityRef:{...entityRef,documentId:'other'},attributes:{PART_NO:'P-002'}}));
});
test('expanded bounded grant catalog still rejects oversized operation lists and names',()=>{
 const grant={bridgeVersion:'0.1.0',instanceId:'inst-1',endpoint:'local',secret:'1'.repeat(64),backend:'mock',expiresAt:Date.now()+60000,operations:Array(64).fill('acad_get_status')};
 assert.equal(grantSchema.parse(grant).operations.length,64);
 assert.throws(()=>grantSchema.parse({...grant,operations:Array(65).fill('acad_get_status')}));
 assert.throws(()=>grantSchema.parse({...grant,operations:['x'.repeat(129)]}));
});
