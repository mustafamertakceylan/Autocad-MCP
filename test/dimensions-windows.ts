import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { copyFile,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
// B1-B4: dimension kinds, ISO notation, dimension series and hole callouts on a synthetic stock-template copy.
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});
const source=join(root,'source.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
const near=(a:number,b:number,t=1e-7)=>Math.abs(a-b)<Math.max(t,Math.abs(b)*1e-7);
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const mutate=async(name:ToolName,args:any,spatial=true,error?:string)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(error){check(name+' rejects '+error,reply.isError&&result.error.code===error&&result.applied===false);return result;}
  if(reply.isError)throw Error(name+': '+result?.error?.code+' '+result?.error?.message);
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const dim=async(args:any)=>(await mutate('acad_create_dimension',{style:'ISO-ISO129',layer:'ISO-DIMENSION',...args})).observedGeometry.items[0];
 await mutate('acad_setup_drawing_standard',{standard:'ISO',lineGroup:0.5,textHeight:3.5,decimalSeparator:'comma',precision:2},false);
 await mutate('acad_create_polyline',{vertices:[[0,0,0],[80,0,0],[80,40,0],[0,40,0]],closed:true,layer:'ISO-VISIBLE'});
 const hole=await mutate('acad_create_circle',{center:[20,20,0],radius:3.3,layer:'ISO-VISIBLE'});
 // B2/B3 notation: the live measurement "<>" is always kept.
 const fit=await dim({kind:'linear',start:[0,0,0],end:[80,0,0],linePoint:[40,-12,0],notation:{prefix:'diameter',fit:'H7',fitDeviations:{upper:'+0,021',lower:'0'}}});
 check('fit class keeps the measurement and adds Ø, H7 and stacked deviations',near(fit.measurement,80)&&fit.dimensionText==='%%c<>H7(\\S+0,021^0;)'&&fit.decimalSeparator===',');
 check('stated precision keeps trailing zeros (80,00 is not 80)',fit.trailingZeros==='kept'&&fit.precision===2);
 const loose=await dim({kind:'linear',start:[0,0,0],end:[80,0,0],linePoint:[40,-70,0],precision:0});check('precision 0 states a free-decimal size',loose.precision===0&&loose.trailingZeros==='kept');
 const deviation=await dim({kind:'linear',start:[0,40,0],end:[80,40,0],linePoint:[40,80,0],precision:0,tolerance:{lower:-0.1,upper:0.1},tolerancePrecision:1});
 check('deviations keep their own stated precision',deviation.tolerancePrecision===1&&deviation.precision===0);
 const ted=await dim({kind:'linear',start:[0,0,0],end:[0,40,0],linePoint:[-12,20,0],rotation:Math.PI/2,notation:{kind:'theoretical_exact'}});
 check('theoretically exact dimension is framed (negative gap) with plain measurement',ted.basic===true&&ted.dimensionText===''&&near(ted.measurement,40));
 const reference=await dim({kind:'aligned',start:[0,40,0],end:[80,40,0],linePoint:[40,52,0],notation:{kind:'reference'}});check('reference dimension is in parentheses',reference.dimensionText==='(<>)');
 const nts=await dim({kind:'linear',start:[80,0,0],end:[80,40,0],linePoint:[95,20,0],rotation:Math.PI/2,notation:{kind:'not_to_scale'}});check('not-to-scale dimension is underlined',nts.dimensionText==='\\L<>\\l');
 const limit=await dim({kind:'linear',start:[0,0,0],end:[20,0,0],linePoint:[10,-25,0],tolerance:{lower:-0.1,upper:0.2},notation:{limits:true}});
 check('limit dimension uses native DIMLIM from explicit deviations',limit.limits===true&&limit.tolerance.upper===0.2&&limit.tolerance.lower===-0.1);
 const single=await dim({kind:'linear',start:[20,0,0],end:[80,0,0],linePoint:[50,-25,0],notation:{singleLimit:'max'}});check('single limit suffix',single.dimensionText==='<> max');
 const modifiers=await dim({kind:'diameter',start:[16.7,20,0],end:[23.3,20,0],linePoint:[35,30,0],notation:{prefix:'diameter',sizeModifiers:['E','LP']}});
 check('ISO 14405 modifiers follow the measured diameter without a second Ø',near(modifiers.measurement,6.6)&&modifiers.dimensionText==='<> Ⓔ LP');
 const sphere=await dim({kind:'radius',start:[20,20,0],end:[23.3,20,0],linePoint:[30,10,0],notation:{prefix:'spherical_radius'}});check('spherical radius adds only S before the native R',sphere.dimensionText==='S<>');
 const square=await dim({kind:'linear',start:[0,40,0],end:[20,40,0],linePoint:[10,60,0],notation:{count:4,prefix:'square'}});check('count and square prefix',square.dimensionText==='4× {\\Fgdt;o}<>');
 const half=await dim({kind:'linear',start:[40,0,0],end:[80,0,0],linePoint:[60,-38,0],notation:{suppress:'first'}});check('half dimension suppresses the first line',half.suppressed==='first');
 // B1 kinds
 const angular=await dim({kind:'angular',start:[0,0,0],end:[80,0,0],start2:[0,0,0],end2:[0,40,0],linePoint:[12,12,0]});
 check('two-line angular dimension measures 90 degrees',near(angular.measurement,Math.PI/2,1e-9)&&near(angular.displayValue,90)&&angular.measurementUnit==='rad');
 const angle3=await dim({kind:'angular3',center:[120,0,0],start:[140,0,0],end:[120+20*Math.cos(Math.PI/6),20*Math.sin(Math.PI/6),0],linePoint:[135,4,0]});
 check('three-point angular dimension measures 30 degrees',near(angle3.displayValue,30));
 await mutate('acad_create_arc',{center:[120,60,0],radius:10,startAngle:0,endAngle:Math.PI/2,layer:'ISO-VISIBLE'});
 const arc=await dim({kind:'arc_length',center:[120,60,0],start:[130,60,0],end:[120,70,0],linePoint:[129,69,0]});check('arc length of a quarter circle r10',near(arc.measurement,5*Math.PI,1e-6));
 const ordX=await dim({kind:'ordinate',start:[20,20,0],end:[20,-45,0],axis:'x'}),ordY=await dim({kind:'ordinate',start:[20,20,0],end:[-20,20,0],axis:'y'});
 check('ordinate dimensions measure from the origin',near(ordX.measurement,20)&&ordX.axis==='x'&&near(ordY.measurement,20)&&ordY.axis==='y');
 // B1 series
 const chain=await mutate('acad_create_dimension_series',{mode:'chain',points:[[0,40,0],[20,40,0],[50,40,0],[80,40,0]],linePoint:[0,70,0],style:'ISO-ISO129',layer:'ISO-DIMENSION'});
 const c=chain.observedGeometry.items;check('chain series creates three consecutive dimensions',c.length===3&&near(c[0].measurement,20)&&near(c[1].measurement,30)&&near(c[2].measurement,30));
 const baseline=await mutate('acad_create_dimension_series',{mode:'baseline',points:[[0,0,0],[20,0,0],[50,0,0],[80,0,0]],linePoint:[0,-55,0],spacing:8,style:'ISO-ISO129',layer:'ISO-DIMENSION'});
 const b=baseline.observedGeometry.items;check('baseline series shares the origin and steps outward',b.length===3&&near(b[0].measurement,20)&&near(b[1].measurement,50)&&near(b[2].measurement,80)&&b[2].start[0]===0);
 // B4 hole callouts
 const callout=await mutate('acad_create_hole_callout',{vertices:[[22.33,22.33,0],[45,30,0]],terminator:'arrow',terminatorSize:3.5,landingLength:10,landingDirection:'right',textHeight:3.5,style:'ISO-ISO3098',layer:'ISO-DIMENSION',decimalSeparator:'comma',hole:{count:4,diameter:'6,6',counterbore:{diameter:'11',depth:'6,8'}},circle:hole.created[0]});
 check('counterbore callout matches the real circle and reads back formatted',callout.callout.formattedText==='4× %%c6,6\\P{\\Fgdt;v}%%c11×6,8'&&callout.observedGeometry.items[0].formattedText===callout.callout.formattedText);
 const before=(await info()).revision;
 await mutate('acad_create_hole_callout',{vertices:[[22.33,22.33,0],[45,30,0]],terminator:'arrow',terminatorSize:3.5,landingLength:10,landingDirection:'right',textHeight:3.5,decimalSeparator:'comma',hole:{diameter:'7',depth:'10'},circle:hole.created[0]},true,'VALIDATION_FAILED');
 check('wrong noted diameter is rejected without a drawing change',(await info()).revision===before);
 const precise=await mutate('acad_create_hole_callout',{vertices:[[17.67,17.67,0],[5,30,0]],terminator:'arrow',terminatorSize:3.5,landingLength:10,landingDirection:'left',textHeight:3.5,decimalSeparator:'comma',hole:{diameter:'6,60',depth:'11,00'},circle:hole.created[0]});
 check('written precision is kept exactly: 6,60 and 11,00 are not shortened',precise.callout.formattedText==='%%c6,60×11,00');
 const thread=await mutate('acad_create_hole_callout',{vertices:[[60,20,0],[70,30,0]],terminator:'arrow',terminatorSize:3.5,landingLength:10,landingDirection:'right',textHeight:3.5,decimalSeparator:'comma',hole:{thread:{designation:'M10-6H',depth:'15'},diameter:'8,5',depth:'20'}});
 check('threaded callout with tap drill',thread.callout.formattedText==='M10-6H×15 / %%c8,5×20');
 const sink=await mutate('acad_create_hole_callout',{vertices:[[20,10,0],[5,-5,0]],terminator:'arrow',terminatorSize:3.5,landingLength:8,landingDirection:'left',textHeight:3.5,decimalSeparator:'comma',hole:{diameter:'6,6',countersink:{diameter:'12',angle:'90'}}});
 check('countersink callout with angle',sink.callout.formattedText==='%%c6,6\\P{\\Fgdt;w}%%c12×90%%d');
 const invalid=await session.client.callTool({name:'acad_create_dimension',arguments:{...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,coordinateSystem:'WCS',lengthUnit:'mm',kind:'linear',start:[0,0,0],end:[10,0,0],linePoint:[5,-5,0],tolerance:{lower:0,upper:0.1},notation:{kind:'theoretical_exact'}}});
 check('contradictory notation is rejected before AutoCAD',invalid.isError&&(invalid.structuredContent as any)?.applied!==true);
 // PDF for visual inspection of symbols and frames.
 const devices=await session.call('acad_get_plot_devices',session.target),device=devices.devices.find((x:any)=>x.device==='DWG To PDF.pc3');
 const media=device?.media.find((m:string)=>m==='ISO_full_bleed_A4_(297.00_x_210.00_MM)');check('full-bleed A4 PDF media available',Boolean(media));
 await mutate('acad_create_layout',{name:'DIM_A4',device:device.device,media,rotation:'0',viewport:{paperCenter:[148.5,105],paperSize:[277,190],modelCenter:[65,10,0],direction:'top',scale:1}});
 await mutate('acad_export_pdf',{layoutName:'DIM_A4',outputRootId:'test-output',relativePath:'dimensions.pdf',overwrite:false},false);
 const exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});await copyFile(join(session.output,'dimensions.pdf'),join(exportRoot,'dimensions.pdf'));
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'dimensions.dwg',overwrite:false},false);
 const output=join(session.output,'dimensions.dwg'),outputHash=await hash(output),exported=join(exportRoot,'dimensions.dwg');await copyFile(output,exported);
 await session.close();s=undefined;check('source file bytes preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);
 const again=await r.call('acad_query_entities',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{type:'DIMENSION'},projection:['handle','dimensionKind','dimensionText','basic','limits','measurement'],limit:1000});
 check('reopened drawing keeps all dimensions',again.items.length===23);
 check('reopened notation and kinds preserved',again.items.some((x:any)=>x.dimensionText==='%%c<>H7(\\S+0,021^0;)')&&again.items.some((x:any)=>x.basic===true)&&again.items.some((x:any)=>x.limits===true)&&['angular','angular3','arc_length','ordinate'].every(k=>again.items.some((x:any)=>x.dimensionKind===k)));
 await r.close();r=undefined;check('saved DWG bytes preserved',await hash(input)===outputHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,output:exported},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
