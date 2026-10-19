import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { copyFile,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const source=join(root,'source.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const mutate=async(name:ToolName,args:any,spatial=true,error?:string)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(error){check(name+' rejects '+error,reply.isError&&result.error.code===error&&result.applied===false);return result;}
  if(reply.isError)throw Error(name+': '+JSON.stringify(result?.error));
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const devices=await session.call('acad_get_plot_devices',session.target);await writeFile(join(root,'devices.json'),JSON.stringify(devices,null,2));const device=devices.devices.find((d:any)=>d.device==='DWG To PDF.pc3');check('native PDF device is installed',Boolean(device));
 const media=device.media.find((m:string)=>m==='ISO_full_bleed_A4_(297.00_x_210.00_MM)')??device.media.find((m:string)=>m.includes('ISO_A4_')&&m.includes('297.00_x_210.00'));
 check('canonical A4 landscape media available',Boolean(media));
 await mutate('acad_create_style',{kind:'text',name:'PLOT_FONT',font:'arial.ttf'},false);
 await mutate('acad_create_polyline',{vertices:[[-40,-20,0],[40,-20,0],[40,20,0],[-40,20,0]],closed:true});
 await mutate('acad_create_circle',{center:[0,0,0],radius:5});
 await mutate('acad_create_dimension',{kind:'linear',start:[-40,-20,0],end:[40,-20,0],linePoint:[0,-35,0],precision:0});
 await mutate('acad_create_dimension',{kind:'linear',start:[40,-20,0],end:[40,20,0],linePoint:[55,0,0],rotation:Math.PI/2,precision:0});
 await mutate('acad_create_text',{position:[-40,40,0],text:'AUTOCAD MCP - 1:1 mm',height:4,style:'PLOT_FONT'});
 // Near-edge markers expose printable-margin shifts that a small centred part
 // cannot reveal. Their physical PDF positions are checked separately as well.
 for(const [text,x,y] of [['MCP_TL',-100,72],['MCP_TR',90,72],['MCP_BL',-100,-70],['MCP_BR',90,-70]] as const)
  await mutate('acad_create_text',{position:[x,y,0],text,height:2.5,style:'PLOT_FONT'});
 const layoutArgs={name:'MECHANICAL_A4',device:device.device,media,rotation:'0',viewport:{paperCenter:[148.5,105],paperSize:[240,150],modelCenter:[0,0,0],direction:'top',scale:1}};
 const layout=await mutate('acad_create_layout',layoutArgs);const viewport=layout.createdLayouts[0].viewports[0];check('native paper viewport has explicit 1:1 scale',Math.abs(viewport.customScale-1)<1e-9&&viewport.locked&&viewport.paperSize[0]===240);
 const before=await session.call('acad_list_layouts',session.target);check('new layout is listed',Boolean(before.layouts.MECHANICAL_A4));
 check('viewport frame uses a nonplot layer',(await session.call('acad_list_layers',session.target)).layers.some((x:any)=>x.name==='_MCP_VIEWPORT_NONPLOT'&&x.plottable===false));
 const standardMedia=device.media.find((m:string)=>m==='ISO_A4_(297.00_x_210.00_MM)');check('standard A4 with printable margins available',Boolean(standardMedia));
 const standard=await mutate('acad_create_layout',{...layoutArgs,name:'MECHANICAL_STANDARD_A4',media:standardMedia});
 const sd=standard.createdLayouts[0];check('standard media has nonzero native margins',sd.plotMarginsMm[1]>0);
 check('absolute paper coordinates compensate printable origin',sd.plotOriginMm[0]===-sd.plotMarginsMm[0]&&sd.plotOriginMm[1]===-sd.plotMarginsMm[1]);
 const rotatedMedia=device.media.find((m:string)=>m==='ISO_A4_(210.00_x_297.00_MM)');check('portrait A4 canonical media available',Boolean(rotatedMedia));
 await mutate('acad_create_layout',{...layoutArgs,name:'MECHANICAL_ROTATED_A4',media:rotatedMedia,rotation:'90'});
 await mutate('acad_create_layout',layoutArgs,true,'VALIDATION_FAILED');
 await mutate('acad_export_pdf',{layoutName:'MECHANICAL_A4',outputRootId:'test-output',relativePath:'mechanical-a4.pdf',overwrite:false},false);
 const pdf=join(session.output,'mechanical-a4.pdf'),pdfHash=await hash(pdf);check('native PDF header and nonempty output',(await readFile(pdf)).subarray(0,5).toString()==='%PDF-'&&(await readFile(pdf)).length>1000);
 await mutate('acad_export_pdf',{layoutName:'MECHANICAL_STANDARD_A4',outputRootId:'test-output',relativePath:'mechanical-standard-a4.pdf',overwrite:false},false);
 await mutate('acad_export_pdf',{layoutName:'MECHANICAL_ROTATED_A4',outputRootId:'test-output',relativePath:'mechanical-rotated-a4.pdf',overwrite:false},false);
 await mutate('acad_export_pdf',{layoutName:'MECHANICAL_A4',outputRootId:'test-output',relativePath:'mechanical-a4.pdf',overwrite:false},false,'FILE_EXISTS');check('existing PDF never overwritten',await hash(pdf)===pdfHash);
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'mechanical-a4.dwg',overwrite:false},false);
 const exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});for(const name of ['mechanical-a4.pdf','mechanical-standard-a4.pdf','mechanical-rotated-a4.pdf','mechanical-a4.dwg'])await copyFile(join(session.output,name),join(exportRoot,name));
 await session.close();s=undefined;check('source file bytes preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(join(exportRoot,'mechanical-a4.dwg'),input);r=await windowsSession(join(root,'reopen'),input);
 const again=await r.call('acad_list_layouts',r.target);check('paper layout viewport scale survives DWG reopen',again.layouts.MECHANICAL_A4?.viewports[0]?.customScale===1&&again.layouts.MECHANICAL_A4?.device==='DWG To PDF.pc3');
 check('standard origin survives DWG reopen',JSON.stringify(again.layouts.MECHANICAL_STANDARD_A4?.plotOriginMm)===JSON.stringify(sd.plotOriginMm));
 check('nonplot layer survives DWG reopen',(await r.call('acad_list_layers',r.target)).layers.some((x:any)=>x.name==='_MCP_VIEWPORT_NONPLOT'&&x.plottable===false));
 await r.close();r=undefined;await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,output:exportRoot},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
