import assert from 'node:assert/strict';
export type Point=[number,number,number];
export type Observed={type:string;handle?:string;start?:Point;end?:Point;center?:Point;radius?:number};
const tolerance=1e-6;
const near=(a:number,b:number)=>Math.abs(a-b)<=tolerance;
const same=(a:Point,b:Point)=>a.every((x,i)=>near(x,b[i]!));
// Derived independently from the user's confirmed dimensions, not the client fixture's vertices.
export function dimensionedOutline():Point[]{
 const halfWidth=80/2,halfHeight=40/2,innerSide=50/2,halfOpening=20/2,halfNotch=20/2,innerMiddle=30/2;
 return [[-halfWidth,-halfHeight,0],[-halfNotch,-halfHeight,0],[-halfNotch,-innerMiddle,0],[halfNotch,-innerMiddle,0],[halfNotch,-halfHeight,0],[halfWidth,-halfHeight,0],[halfWidth,-halfOpening,0],[innerSide,-halfOpening,0],[innerSide,halfOpening,0],[halfWidth,halfOpening,0],[halfWidth,halfHeight,0],[halfNotch,halfHeight,0],[halfNotch,innerMiddle,0],[-halfNotch,innerMiddle,0],[-halfNotch,halfHeight,0],[-halfWidth,halfHeight,0],[-halfWidth,halfOpening,0],[-innerSide,halfOpening,0],[-innerSide,-halfOpening,0],[-halfWidth,-halfOpening,0]];
}
export function verifyNotchedPlate(items:Observed[]){
 assert.equal(items.length,21,'Expected only 20 profile lines and one hole circle');
 const lines=items.filter(x=>x.type==='LINE'),circles=items.filter(x=>x.type==='CIRCLE');
 assert.equal(lines.length,20);assert.equal(circles.length,1);
 const points=dimensionedOutline(),remaining=[...lines];
 for(let i=0;i<points.length;i++){
  const a=points[i]!,b=points[(i+1)%points.length]!;
  const match=remaining.findIndex(e=>e.start&&e.end&&((same(e.start,a)&&same(e.end,b))||(same(e.start,b)&&same(e.end,a))));
  assert.ok(match>=0,'Missing, shifted, duplicate, or incorrectly dimensioned profile edge '+i);remaining.splice(match,1);
 }
 const circle=circles[0]!;assert.ok(circle.center&&same(circle.center,[0,0,0]),'Hole must be centered');
 assert.ok(circle.radius!==undefined&&near(circle.radius,5),'Hole diameter must be 10 mm');
 const all=lines.flatMap(e=>[e.start!,e.end!]);
 const min=[0,1,2].map(axis=>Math.min(...all.map(p=>p[axis]!))) as Point;
 const max=[0,1,2].map(axis=>Math.max(...all.map(p=>p[axis]!))) as Point;
 const perimeter=lines.reduce((sum,e)=>sum+Math.hypot(...e.start!.map((v,i)=>v-e.end![i]!)),0);
 assert.ok(near(perimeter,320));
 // Matching all expected connected edges proves a single closed contour. Compute
 // area from observed endpoints oriented along that contour, not pixel scaling.
 let twiceArea=0;
 for(let i=0;i<points.length;i++){
  const a=points[i]!,b=points[(i+1)%points.length]!;
  const edge=lines.find(e=>same(e.start!,a)&&same(e.end!,b)||same(e.end!,a)&&same(e.start!,b))!;
  const start=same(edge.start!,a)?edge.start!:edge.end!,end=same(edge.start!,a)?edge.end!:edge.start!;
  twiceArea+=start[0]*end[1]-end[0]*start[1];
 }
 const areaWithoutHole=Math.abs(twiceArea)/2;assert.ok(near(areaWithoutHole,2400));
 return {lineCount:20,circleCount:1,lengthUnit:'mm',coordinateSystem:'WCS',bounds:{min,max},width:max[0]-min[0],height:max[1]-min[1],holeDiameter:circle.radius!*2,perimeter,areaWithoutHole,areaWithHole:areaWithoutHole-Math.PI*circle.radius!**2};
}
export function observedSvg(items:Observed[]):string{
 const elements=items.map(e=>e.type==='LINE'?`<line x1="${e.start![0]}" y1="${e.start![1]}" x2="${e.end![0]}" y2="${e.end![1]}"/>`:`<circle cx="${e.center![0]}" cy="${e.center![1]}" r="${e.radius}"/>`).join('\n');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="-50 -32 100 64"><rect x="-50" y="-32" width="100" height="64" fill="white"/><g transform="scale(1,-1)" fill="none" stroke="#111827" stroke-width="0.35">${elements}</g></svg>`;
}
