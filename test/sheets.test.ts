import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTool, mutating, descriptions } from '../src/tools.js';
const target={instanceId:'inst-test',documentId:'doc-test',documentEpoch:1};
const base={...target,operationId:'sheet-1',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};
const ref=(handle:string)=>({documentId:'doc-test',documentEpoch:1,handle});

test('drawing sheet and title block schemas',()=>{
 const sheet=validateTool('acad_create_drawing_sheet',{...base,size:'A3',orientation:'landscape',origin:[0,0,0]}) as any;
 assert.equal(sheet.viewScale,1);
 assert.throws(()=>validateTool('acad_create_drawing_sheet',{...base,size:'A5',orientation:'landscape',origin:[0,0,0]}));
 const block=validateTool('acad_create_title_block',{...base,layout:'education_122x31',corner:[410,10,0],projectionSymbol:'first_angle',fields:{title:'BODY',date:'11 / 11 / 2026'}}) as any;
 assert.equal(block.lineGroup,0.5);assert.equal(block.textHeight,2.5);assert.equal(block.titleHeight,5);assert.deepEqual(block.fields,{title:'BODY',date:'11 / 11 / 2026'});
 assert.deepEqual((validateTool('acad_create_title_block',{...base,layout:'education_122x31',corner:[0,0,0],projectionSymbol:'third_angle'}) as any).fields,{});
 for(const bad of [{fields:{owner:'x'}},{projectionSymbol:'first'},{layout:'iso7200'},{textHeight:5},{fields:{title:'a%<b'}}])
  assert.throws(()=>validateTool('acad_create_title_block',{...base,layout:'education_122x31',corner:[0,0,0],projectionSymbol:'first_angle',...bad}),JSON.stringify(bad));
 for(const name of ['acad_create_drawing_sheet','acad_create_title_block'] as const){assert.ok(mutating.has(name));assert.ok(descriptions[name].length>80);}
 assert.match(descriptions.acad_create_title_block,/must not be invented/);
});
test('monochrome layout, text justification, extrusion planes and query defaults',()=>{
 const viewport={paperCenter:[210,148.5],paperSize:[420,297],modelCenter:[210,148.5,0],direction:'top',scale:1};
 assert.equal((validateTool('acad_create_layout',{...base,name:'A3',device:'DWG To PDF.pc3',media:'m',viewport,plotStyle:'monochrome.ctb'}) as any).plotStyle,'monochrome.ctb');
 assert.throws(()=>validateTool('acad_create_layout',{...base,name:'A3',device:'DWG To PDF.pc3',media:'m',viewport,plotStyle:'../x.ctb'}));
 assert.equal((validateTool('acad_create_text',{...base,position:[0,0,0],text:'A',height:2.5,justification:'middle_center'}) as any).justification,'middle_center');
 assert.throws(()=>validateTool('acad_create_text',{...base,position:[0,0,0],text:'A',height:2.5,justification:'fit'}));
 assert.equal((validateTool('acad_extrude',{...base,entityRef:ref('1A'),height:4,profilePlane:'XZ'}) as any).profilePlane,'XZ');
 assert.throws(()=>validateTool('acad_extrude',{...base,entityRef:ref('1A'),height:4,profilePlane:'XY2'}));
 assert.deepEqual((validateTool('acad_query_entities',{...target,coordinateSystem:'WCS'}) as any).filter,{});
 assert.match(descriptions.acad_create_text,/İ, ı, Ş, Ğ/);
});
test('leader side and dimension text position rules',()=>{
 const leader={...base,vertices:[[0,0,0],[10,0,0]],terminator:'arrow',terminatorSize:4,landingLength:0};
 assert.doesNotThrow(()=>validateTool('acad_create_leader',{...leader,content:{kind:'none'}}));
 assert.throws(()=>validateTool('acad_create_leader',{...leader,content:{kind:'text',text:'A',height:3.5}}));
 assert.throws(()=>validateTool('acad_create_leader',{...leader,landingLength:5,content:{kind:'none'}}));
 const linear=validateTool('acad_create_dimension',{...base,kind:'linear',start:[0,0,0],end:[3,0,0],linePoint:[1.5,-8,0],textPosition:[10,-12,0]}) as any;
 assert.deepEqual(linear.textPosition,[10,-12,0]);
 assert.throws(()=>validateTool('acad_create_dimension',{...base,kind:'diameter',start:[10,0,0],end:[-10,0,0],linePoint:[25,0,0],textPosition:[30,0,0]}));
 assert.match(descriptions.acad_create_dimension,/linePoint is the text location/);
});
