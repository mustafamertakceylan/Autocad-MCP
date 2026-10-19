import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTool, mutating } from '../src/tools.js';
const target={instanceId:'inst-test',documentId:'doc-test',documentEpoch:1};
const mutation={...target,operationId:'annotation-1',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};

test('engineering annotations require explicit measured geometry and reject false text overrides',()=>{
 const dimension={...mutation,kind:'linear',start:[0,0,0],end:[80,0,0],linePoint:[40,-30,0]};
 const value=validateTool('acad_create_dimension',dimension);assert.equal(value.precision,undefined);
 assert.throws(()=>validateTool('acad_create_dimension',{...dimension,text:'100'}));
 assert.throws(()=>validateTool('acad_create_dimension',{...dimension,end:[0,40,0]}));
 assert.throws(()=>validateTool('acad_create_dimension',{...dimension,start:[0,0,1]}));
 assert.throws(()=>validateTool('acad_create_dimension',{...dimension,tolerance:{lower:0.2,upper:0.1}}));
 assert.deepEqual(validateTool('acad_create_dimension',{...dimension,tolerance:{lower:-0.1,upper:0.2}}).tolerance,{lower:-0.1,upper:0.2});
 assert.throws(()=>validateTool('acad_create_dimension',{...dimension,documentEpoch:0}));
 assert.ok(mutating.has('acad_create_dimension'));assert.ok(mutating.has('acad_create_layer'));
});
test('plain text prevents executable fields and layer creation bounds native enums',()=>{
 const single={...mutation,position:[0,0,0],height:3,text:'PLAKA Ø10 — Çelik'};
 assert.equal(validateTool('acad_create_text',single).text,single.text);
 assert.throws(()=>validateTool('acad_create_text',{...single,text:'%<\\AcVar Filename>%'}));
 assert.throws(()=>validateTool('acad_create_text',{...single,text:'A\nB'}));
 assert.throws(()=>validateTool('acad_create_mtext',{...single,width:-1}));
 assert.equal(validateTool('acad_create_mtext',{...single,text:'A\nB',width:50}).width,50);
 const {coordinateSystem,lengthUnit,...base}=mutation;
 assert.equal(validateTool('acad_create_layer',{...base,name:'ÖLÇÜ',colorIndex:2}).lineweight,25);
 for(const invalid of [{name:'../bad'}, {colorIndex:256}, {lineweight:42}])
  assert.throws(()=>validateTool('acad_create_layer',{...base,name:'DIM',colorIndex:2,...invalid}));
 assert.throws(()=>validateTool('acad_list_layers',{...target,activeTab:true}));
});
