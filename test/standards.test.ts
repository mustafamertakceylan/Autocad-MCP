import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTool, mutating } from '../src/tools.js';
const target={instanceId:'inst-test',documentId:'doc-test',documentEpoch:1};
const base={...target,operationId:'standard-1',expectedRevision:0};

test('ISO profile accepts only listed line groups and lettering heights',()=>{
 const profile={...base,standard:'ISO',lineGroup:0.5,textHeight:3.5,decimalSeparator:'comma',precision:2};
 const value=validateTool('acad_setup_drawing_standard',profile);
 assert.equal(value.viewScale,1);assert.equal(value.prefix,'ISO');assert.ok(mutating.has('acad_setup_drawing_standard'));
 for(const invalid of [{lineGroup:0.45},{textHeight:3},{standard:'ASME'},{precision:5},{viewScale:0},{prefix:'iso'},{prefix:'ISO-1'},{decimalSeparator:'space'},{coordinateSystem:'WCS'}])
  assert.throws(()=>validateTool('acad_setup_drawing_standard',{...profile,...invalid}));
});
test('leader requires explicit terminator, reference line and typed content',()=>{
 const leader={...base,coordinateSystem:'WCS',lengthUnit:'mm',vertices:[[0,0,0],[10,10,0]],terminator:'arrow',terminatorSize:3.5,landingLength:8,landingDirection:'right',content:{kind:'text',text:'4x M6',height:3.5,placement:'above'}};
 assert.equal(validateTool('acad_create_leader',leader).terminator,'arrow');assert.ok(mutating.has('acad_create_leader'));
 assert.deepEqual(validateTool('acad_create_leader',{...leader,content:{kind:'block',name:'ISO-DATUM'}}).content,{kind:'block',name:'ISO-DATUM',scale:1,attributes:{}});
 assert.equal((validateTool('acad_create_leader',{...leader,content:{kind:'none'},landingLength:0}).content as any).kind,'none');
 for(const invalid of [{vertices:[[0,0,0]]},{vertices:[[0,0,0],[0,0,0]]},{vertices:[[0,0,1],[10,10,0]]},{terminator:'oblique'},{terminatorSize:0},{landingLength:-1},{landingDirection:'up'},
  {content:{kind:'text',text:'%<\\AcVar Date>%',height:3.5,placement:'above'}},{content:{kind:'text',text:'A',height:3.5}},{content:{kind:'block',name:'X',attributes:{bad:'1'}}},{content:{kind:'none',text:'A'}}])
  assert.throws(()=>validateTool('acad_create_leader',{...leader,...invalid}));
});
