import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyNotchedPlate, type Observed } from './notched-plate.js';

test('confirmed drawing fixture forms a closed 80x40 profile with a centered diameter-10 hole',async()=>{
 const f=JSON.parse(await readFile('test/fixtures/notched-plate.json','utf8'));
 const entities:Observed[]=f.vertices.map((start:any,i:number)=>({type:'LINE',start,end:f.vertices[(i+1)%f.vertices.length]}));
 entities.push({type:'CIRCLE',...f.circle});
 const measured=verifyNotchedPlate(entities);
 assert.equal(measured.perimeter,320);assert.equal(measured.areaWithoutHole,2400);
 assert.ok(Math.abs(measured.areaWithHole-(2400-25*Math.PI))<1e-9);
 const reversed=entities.map(e=>e.type==='LINE'?{...e,start:e.end!,end:e.start!}:e).reverse();
 assert.deepEqual(verifyNotchedPlate(reversed),measured);
 const wrong=structuredClone(entities);wrong[20]!.radius=10;
 assert.throws(()=>verifyNotchedPlate(wrong),/diameter/);
 const duplicate=structuredClone(entities);duplicate[1]=duplicate[0]!;
 assert.throws(()=>verifyNotchedPlate(duplicate),/edge/);
 const shifted=structuredClone(entities);shifted[0]!.start![0]+=1;
 assert.throws(()=>verifyNotchedPlate(shifted),/edge/);
});
