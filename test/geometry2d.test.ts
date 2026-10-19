import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTool } from '../src/tools.js';
const base={instanceId:'inst-1',documentId:'doc-1',documentEpoch:1,operationId:'2d-1',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};
const targets=[{documentId:'doc-1',documentEpoch:1,handle:'1'}];
test('bounded native 2D geometry rejects degenerate closure, arcs and unsafe transform arrays',()=>{
 assert.throws(()=>validateTool('acad_create_arc',{...base,center:[0,0,0],radius:1,startAngle:0,endAngle:2*Math.PI}));
 assert.throws(()=>validateTool('acad_create_polyline',{...base,vertices:[[0,0,0],[1,0,0],[0,0,0]],closed:true}));
 assert.throws(()=>validateTool('acad_create_polyline',{...base,vertices:[[0,0,0],[0,0,0]],closed:false}));
 assert.throws(()=>validateTool('acad_transform_entities',{...base,targets,mode:'mirror',lineStart:[0,0,0],lineEnd:[0,0,0]}));
 assert.throws(()=>validateTool('acad_transform_entities',{...base,targets,mode:'linear_array',count:1000,step:[1,0,0]}));
 assert.throws(()=>validateTool('acad_transform_entities',{...base,targets,mode:'circular_array',count:4,center:[0,0,0],angleStep:0}));
 assert.throws(()=>validateTool('acad_transform_entities',{...base,targets:[...targets,...targets],mode:'copy',delta:[1,0,0]}));
 assert.throws(()=>validateTool('acad_create_style',{...base,kind:'text',name:'FONT',font:'../external.ttf'}));
 assert.throws(()=>validateTool('acad_create_style',{...base,kind:'linetype',name:'CENTER',dashes:[1,1]}));
 const {coordinateSystem,lengthUnit,...target}=base;
 assert.equal(validateTool('acad_create_style',{...target,kind:'text',name:'FONT',font:'arial.ttf'}).widthFactor,1);
});
test('curve edits retain explicit boundary identity and reject implicit or degenerate corners',()=>{
 const entityRef=targets[0];
 assert.throws(()=>validateTool('acad_offset_entity',{...base,entityRef,distance:0,sidePoint:[0,0,0]}));
 assert.throws(()=>validateTool('acad_edit_curve',{...base,entityRef,boundaries:targets,mode:'trim',keepPoint:[0,0,0]}));
 assert.throws(()=>validateTool('acad_edit_curve',{...base,entityRef,boundaries:[{...entityRef,documentId:'other',handle:'2'}],mode:'extend',end:'end'}));
 assert.throws(()=>validateTool('acad_corner',{...base,targets:[entityRef,entityRef],kind:'fillet',radius:2}));
 assert.throws(()=>validateTool('acad_corner',{...base,targets:[entityRef,{...entityRef,handle:'2'}],kind:'chamfer',distanceA:2,distanceB:-1}));
});
