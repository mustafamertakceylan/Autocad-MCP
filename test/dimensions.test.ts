import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTool, mutating } from '../src/tools.js';
const target={instanceId:'inst-test',documentId:'doc-test',documentEpoch:1};
const base={...target,operationId:'dimension-1',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};

test('new dimension kinds require their own defining points',()=>{
 assert.equal(validateTool('acad_create_dimension',{...base,kind:'angular',start:[0,0,0],end:[10,0,0],start2:[0,0,0],end2:[0,10,0],linePoint:[5,5,0]}).kind,'angular');
 assert.equal(validateTool('acad_create_dimension',{...base,kind:'angular3',center:[0,0,0],start:[10,0,0],end:[0,10,0],linePoint:[7,7,0]}).kind,'angular3');
 assert.equal(validateTool('acad_create_dimension',{...base,kind:'arc_length',center:[0,0,0],start:[10,0,0],end:[0,10,0],linePoint:[9,9,0]}).kind,'arc_length');
 assert.equal(validateTool('acad_create_dimension',{...base,kind:'ordinate',start:[25,10,0],end:[25,-15,0],axis:'x'}).axis,'x');
 for(const invalid of [{kind:'angular',start:[0,0,0],end:[10,0,0],linePoint:[5,5,0]},{kind:'angular3',start:[10,0,0],end:[0,10,0],linePoint:[7,7,0]},
  {kind:'ordinate',start:[25,10,0],end:[25,-15,0]},{kind:'ordinate',start:[25,10,0],end:[25,-15,0],axis:'z'},{kind:'linear',start:[0,0,0],end:[10,0,0],linePoint:[5,5,0],start2:[0,0,0]}])
  assert.throws(()=>validateTool('acad_create_dimension',{...base,...invalid}));
 const legacy=validateTool('acad_create_dimension',{...base,kind:'diameter',start:[0,0,0],end:[10,0,0],linePoint:[15,5,0]});assert.equal(legacy.leaderLength,0);
});
test('notation adds ISO symbols but rejects contradictory tolerances',()=>{
 const linear={...base,kind:'linear',start:[0,0,0],end:[20,0,0],linePoint:[10,-10,0]};
 const ok=[{prefix:'diameter',fit:'H7',fitDeviations:{upper:'+0,021',lower:'0'}},{prefix:'diameter',fit:'H7/g6'},{kind:'theoretical_exact'},{kind:'reference'},{kind:'not_to_scale'},
  {singleLimit:'max'},{sizeModifiers:['E','LP']},{count:4,prefix:'square'},{suppress:'first'},{fit:'g6',fitDeviations:{upper:'-0,007',lower:'-0,020'}}];
 for(const notation of ok)assert.deepEqual((validateTool('acad_create_dimension',{...linear,notation}) as any).notation,notation);
 assert.equal((validateTool('acad_create_dimension',{...linear,tolerance:{lower:-0.1,upper:0.1},notation:{limits:true}}) as any).notation.limits,true);
 assert.equal((validateTool('acad_create_dimension',{...linear,tolerance:{lower:-0.1,upper:0.1},tolerancePrecision:1}) as any).tolerancePrecision,1);
 const bad=[{fit:'h7x'},{fit:'H7',tolerance:true},{fitDeviations:{upper:'+0,1',lower:'0'}},{limits:true},{kind:'theoretical_exact',tolerance:true},{kind:'reference',fit:'H7'},
  {singleLimit:'max',tolerance:true},{sizeModifiers:['E','E']},{sizeModifiers:['XX']},{count:1},{prefix:'diameter',text:'Ø'},
  {fit:'H7',fitDeviations:{upper:'0',lower:'+0,1'}},{fit:'H7',fitDeviations:{upper:0.021,lower:0}},{fit:'H7',fitDeviations:{upper:'0,021',lower:'0'}}];
 for(const {tolerance,...notation} of bad as any[])
  assert.throws(()=>validateTool('acad_create_dimension',{...linear,...(tolerance?{tolerance:{lower:-0.1,upper:0.1}}:{}),notation}),JSON.stringify(notation));
 assert.throws(()=>validateTool('acad_create_dimension',{...base,kind:'diameter',start:[0,0,0],end:[10,0,0],linePoint:[15,5,0],notation:{suppress:'first'}}));
 // AutoCAD renders Ø/R itself for diameter/radius dimensions: other prefixes would double or contradict it.
 for(const [kind,prefix] of [['diameter','square'],['diameter','radius'],['radius','diameter'],['radius','thickness']])
  assert.throws(()=>validateTool('acad_create_dimension',{...base,kind,start:[0,0,0],end:[10,0,0],linePoint:[15,5,0],notation:{prefix}}),kind+' '+prefix);
 assert.ok(validateTool('acad_create_dimension',{...base,kind:'diameter',start:[0,0,0],end:[10,0,0],linePoint:[15,5,0],notation:{prefix:'spherical_diameter'}}));
 assert.throws(()=>validateTool('acad_create_dimension',{...base,kind:'angular3',center:[0,0,0],start:[10,0,0],end:[0,10,0],linePoint:[7,7,0],notation:{prefix:'diameter'}}));
});
test('dimension series and hole callouts validate typed input',()=>{
 const series={...base,mode:'chain',points:[[0,0,0],[20,0,0],[45,0,0]],linePoint:[0,-10,0]};
 assert.equal(validateTool('acad_create_dimension_series',series).rotation,0);assert.ok(mutating.has('acad_create_dimension_series'));
 assert.throws(()=>validateTool('acad_create_dimension_series',{...series,spacing:7}));
 assert.throws(()=>validateTool('acad_create_dimension_series',{...series,mode:'baseline'}));
 assert.equal(validateTool('acad_create_dimension_series',{...series,mode:'baseline',spacing:7}).spacing,7);
 assert.throws(()=>validateTool('acad_create_dimension_series',{...series,points:[[0,0,0],[0,10,0]]}));
 const callout={...base,vertices:[[0,0,0],[10,10,0]],terminator:'arrow',terminatorSize:3.5,landingLength:8,landingDirection:'right',textHeight:3.5,decimalSeparator:'comma',hole:{count:4,diameter:'6,6',counterbore:{diameter:'11',depth:'6,8'}}};
 assert.ok(validateTool('acad_create_hole_callout',callout));assert.ok(mutating.has('acad_create_hole_callout'));
 // The written form is the stated precision: 11 and 11,00 are different requirements and pass through unchanged.
 assert.equal((validateTool('acad_create_hole_callout',{...callout,hole:{diameter:'6,60',depth:'11,00'}}) as any).hole.depth,'11,00');
 for(const hole of [{},{diameter:'6,6',counterbore:{diameter:'5',depth:'2'}},{diameter:'6,6',counterbore:{diameter:'11',depth:'6'},countersink:{diameter:'12',angle:'90'}},
  {thread:{designation:'M10-6H'},counterbore:{diameter:'11',depth:'6'}},{thread:{designation:'10mm'}},{diameter:'6,6',countersink:{diameter:'12',angle:'180'}},{diameter:'6,6',fit:'g6'},
  {diameter:6.6},{diameter:'6,6',depth:'-3'},{diameter:'6.6.6'},{diameter:'0'}])
  assert.throws(()=>validateTool('acad_create_hole_callout',{...callout,hole}),JSON.stringify(hole));
 assert.ok(validateTool('acad_create_hole_callout',{...callout,hole:{thread:{designation:'M10-6H',depth:'15'},diameter:'8,5',depth:'20'}}));
 assert.throws(()=>validateTool('acad_create_hole_callout',{...callout,hole:{thread:{designation:'M10'}},circle:{documentId:'doc-test',documentEpoch:1,handle:'2A'}}));
 assert.throws(()=>validateTool('acad_create_hole_callout',{...callout,circle:{documentId:'other',documentEpoch:1,handle:'2A'}}));
});
