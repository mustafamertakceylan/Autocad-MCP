import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTool} from '../src/tools.js';
const base={instanceId:'i',documentId:'d',documentEpoch:1,operationId:'o',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};
const entityRef={documentId:'d',documentEpoch:1,handle:'A'};
test('mechanical helpers reject invalid hole entries, tables and sections',()=>{
 assert.throws(()=>validateTool('acad_drill_holes',{...base,entityRef,centers:[[0,0,0]],diameter:10,depth:5,direction:'negative_z',entry:{kind:'counterbore',diameter:8,depth:3}}));
 assert.throws(()=>validateTool('acad_drill_holes',{...base,entityRef,centers:[[0,0,0]],diameter:10,depth:5,direction:'negative_z',entry:{kind:'countersink',diameter:20,depth:6}}));
 assert.throws(()=>validateTool('acad_create_table',{...base,position:[0,0,0],rows:[['A','B']],columnWidths:[10],rowHeight:5,textHeight:2}));
 assert.throws(()=>validateTool('acad_create_table',{...base,position:[0,0,0],rows:[['%<field>']],columnWidths:[10],rowHeight:5,textHeight:2}));
 assert.throws(()=>validateTool('acad_section_solid',{...base,entityRef,origin:[0,0,0],normal:[0,0,0]}));
 assert.throws(()=>validateTool('acad_create_feature_control_frame',{...base,position:[0,0,0],characteristic:'made_up',tolerance:0.05,textHeight:2.5}));
});
