import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTool,mutating} from '../src/tools.js';
const base={instanceId:'i',documentId:'d',documentEpoch:1,operationId:'o',expectedRevision:0,coordinateSystem:'WCS',lengthUnit:'mm'};
const entityRef={documentId:'d',documentEpoch:1,handle:'A'},other={...entityRef,handle:'B'};
test('solid schemas enforce profiles, axes and explicit boolean targets',()=>{
 assert.equal(validateTool('acad_extrude',{...base,entityRef,height:-10}).keepProfile,true);
 assert.throws(()=>validateTool('acad_extrude',{...base,entityRef,height:0}));
 assert.throws(()=>validateTool('acad_revolve',{...base,entityRef,axisStart:[0,0,0],axisEnd:[0,0,0],angle:Math.PI}));
 assert.throws(()=>validateTool('acad_boolean',{...base,entityRef,tools:[entityRef],operation:'subtract'}));
 assert.throws(()=>validateTool('acad_boolean',{...base,entityRef,tools:[other,{...other,handle:'b'}],operation:'union'}));
 assert.equal(validateTool('acad_boolean',{...base,entityRef,tools:[other],operation:'subtract'}).keepTools,true);
 assert.ok(mutating.has('acad_boolean'));
});
test('mass density must be explicit and positive',()=>{
 const {operationId,expectedRevision,...read}=base;
 assert.equal(validateTool('acad_get_mass_properties',{...read,entityRef}).densityKgM3,undefined);
 assert.throws(()=>validateTool('acad_get_mass_properties',{...read,entityRef,densityKgM3:0}));
 assert.throws(()=>validateTool('acad_get_mass_properties',{...read,entityRef,densityKgM3:7850,material:'steel'}));
});
