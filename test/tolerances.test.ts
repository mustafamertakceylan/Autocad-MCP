import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTool, mutating, descriptions } from '../src/tools.js';
const target={instanceId:'inst-test',documentId:'doc-test',documentEpoch:1};
const base={...target,operationId:'gdt-1',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};
const ref=(handle:string)=>({documentId:'doc-test',documentEpoch:1,handle});
const frame={...base,position:[50,50,0],textHeight:3.5,decimalSeparator:'comma'};

test('ISO frames take written tolerance values and ISO modifiers',()=>{
 const p=validateTool('acad_create_feature_control_frame',{...frame,rows:[
  {characteristic:'position',zone:{value:'0,050',shape:'diameter',material:'MMR',reciprocity:true,projected:'12',derived:true,freeState:true},datums:['A',{letters:['B','C'],modifiers:['CF'],material:'LMR'}]},
  {characteristic:'surface_profile',zone:{value:'0,2',combined:'CZ',offset:'-0,05',constraint:'OZ'}}]}) as any;
 assert.equal(p.rows[0].zone.value,'0,050');assert.deepEqual(p.rows[1].datums,[]);
 for(const characteristic of ['concentricity','coaxiality','symmetry'])
  assert.equal((validateTool('acad_create_feature_control_frame',{...frame,rows:[{characteristic,zone:{value:'0,02'},datums:['A']}]}) as any).rows[0].characteristic,characteristic);
});
test('ISO 1101 datum rules and modifier dependencies are enforced before AutoCAD',()=>{
 const bad=[
  {characteristic:'flatness',zone:{value:'0,05'},datums:['A']},
  {characteristic:'parallelism',zone:{value:'0,05'}},
  {characteristic:'total_runout',zone:{value:'0,05'}},
  {characteristic:'position',zone:{value:'0.05',reciprocity:true},datums:['A']},
  {characteristic:'position',zone:{value:'0',shape:'diameter'},datums:['A']},
  {characteristic:'position',zone:{value:'0,05',offset:'0'},datums:['A']},
  {characteristic:'position',zone:{value:'0,05'},datums:['a']},
  {characteristic:'position',zone:{value:'0,05'},datums:[{letters:['A','A']}]},
  {characteristic:'position',zone:{value:'0,05'},datums:['A','B','C','D']},
  {characteristic:'tangent',zone:{value:'0,05'}}];
 for(const row of bad)assert.throws(()=>validateTool('acad_create_feature_control_frame',{...frame,rows:[row]}),JSON.stringify(row));
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...frame,rows:[]}));
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...frame,rows:[{characteristic:'flatness',zone:{value:'0,05'}}],tolerance:0.05}));
});
test('legacy single-line frames stay valid and cannot mix with ISO rows',()=>{
 const legacy=validateTool('acad_create_feature_control_frame',{...base,position:[0,0,0],characteristic:'position',tolerance:0.05,diameterZone:true,materialCondition:'MMC',datums:['A'],textHeight:3.5}) as any;
 assert.equal(legacy.tolerance,0.05);
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...base,position:[0,0,0],characteristic:'position',tolerance:0.05,textHeight:3.5,decimalSeparator:'comma'}));
});
test('frame leaders check attachment refs and all-around needs a bend',()=>{
 const row=[{characteristic:'flatness',zone:{value:'0,05'}}];
 const ok=validateTool('acad_create_feature_control_frame',{...frame,rows:row,leader:{vertices:[[0,0,0],[0,10,0]],terminator:'arrow',terminatorSize:3.5,attachment:{kind:'surface',entityRef:ref('2A')},allAround:'all_around'}}) as any;
 assert.equal(ok.leader.allAround,'all_around');
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...frame,rows:row,leader:{vertices:[[0,0,0]],terminator:'arrow',terminatorSize:3.5,attachment:{kind:'free'},allAround:'all_over'}}));
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...frame,rows:row,leader:{vertices:[[0,0,0]],terminator:'none',terminatorSize:3.5,attachment:{kind:'free'}}}));
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...frame,rows:row,leader:{vertices:[[0,0,0]],terminator:'arrow',terminatorSize:3.5,attachment:{kind:'axis',dimension:{...ref('2B'),documentId:'other'}}}}),/Invalid entity target/);
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...frame,rows:row,adjacent:{}}));
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...frame,rows:row,adjacent:{between:{from:'A',to:'A'}}}));
});
test('datum features and general specifications are typed mutations',()=>{
 for(const name of ['acad_create_datum_feature','acad_create_general_specification'] as const){assert.ok(mutating.has(name));assert.match(descriptions[name],/pending full-text verification/);}
 const datum={...base,letter:'A',triangle:'filled',triangleSize:3.5,vertices:[[0,0,0],[0,-10,0]],textHeight:3.5,attachment:{kind:'surface',entityRef:ref('2A')}};
 assert.equal((validateTool('acad_create_datum_feature',datum) as any).letter,'A');
 for(const invalid of [{letter:'a'},{letter:'ABC'},{triangle:'half'},{vertices:[[0,0,0],[0,0,0]]},{vertices:[[0,0,0]]},{attachment:{kind:'surface'}}])
  assert.throws(()=>validateTool('acad_create_datum_feature',{...datum,...invalid}));
 const spec={...base,position:[0,0,0],textHeight:3.5,decimalSeparator:'comma'};
 const g=validateTool('acad_create_general_specification',{...spec,items:[{kind:'iso2768',class:'m'},{kind:'iso22081_geometrical',tolerance:'1'},{kind:'iso10579',restraint:'Bolted at A'}]}) as any;
 assert.deepEqual(g.items[1].datums,[]);
 for(const items of [[],[{kind:'iso8015'},{kind:'iso8015'}],[{kind:'iso2768',class:'k'}],[{kind:'iso22081_size',deviation:'-0,2'}],[{kind:'iso10579',restraint:'a\nb'}],[{kind:'asme_y14_5'}]])
  assert.throws(()=>validateTool('acad_create_general_specification',{...spec,items}),JSON.stringify(items));
});
