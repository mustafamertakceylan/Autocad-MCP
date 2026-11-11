import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { copyFile,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
// H1/H2 drawing sheet and title block, monochrome plot style, text justification,
// dimension text position, bare leaders, layer linetypes and vertical-plane extrusion.
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});
const source=join(root,'source.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
const near=(a:number,b:number,t=1e-6)=>Math.abs(a-b)<=t,nearPoint=(a:number[],b:number[],t=1e-6)=>a.every((v,i)=>near(v,b[i]!,t));
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s;
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s;
 const info=()=>session.call('acad_get_document_info',session.target);
 const send=async(name:ToolName,args:any,spatial=true)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};
  const reply=await session.client.callTool({name,arguments:p});calls.push({name,args:p,result:reply.structuredContent});return reply;
 };
 const mutate=async(name:ToolName,args:any,spatial=true)=>{
  const reply=await send(name,args,spatial),result=reply.structuredContent as any;
  if(reply.isError)throw Error(name+': '+result?.error?.code+' '+result?.error?.message+' '+JSON.stringify(reply.content).slice(0,300));
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const rejected=async(name:ToolName,args:any,spatial=true)=>{const reply=await send(name,args,spatial);return reply.isError&&(reply.structuredContent as any)?.applied!==true;};
 await mutate('acad_setup_drawing_standard',{standard:'ISO',lineGroup:0.5,textHeight:3.5,decimalSeparator:'comma',precision:0},false);
 await mutate('acad_create_style',{kind:'text',name:'SHEET-ARIAL',font:'arial.ttf',widthFactor:0.85},false);
 // Layer with an existing ISO linetype.
 const layer=await mutate('acad_create_layer',{name:'SHEET-HIDDEN',colorIndex:7,lineweight:25,linetype:'ISO-DASHED-W025'},false);
 check('layer keeps the requested ISO linetype',layer.createdLayers[0].linetype==='ISO-DASHED-W025');
 // H1 ISO 5457 sheet.
 const sheet=await mutate('acad_create_drawing_sheet',{size:'A3',orientation:'landscape',origin:[0,0,0],layer:'ISO-VISIBLE',edgeLayer:'ISO-THIN'});
 console.log('SHEET',JSON.stringify(sheet.sheet));
 check('A3 frame has 20/10 mm margins and the title block corner at its lower right',nearPoint(sheet.sheet.frame.min,[20,10,0])&&nearPoint(sheet.sheet.frame.max,[410,287,0])&&nearPoint(sheet.sheet.titleBlockCorner,[410,10,0]));
 check('frame, four centring marks and trimmed edge',sheet.created.length===6&&sheet.observedGeometry.items.filter((x:any)=>x.type==='LINE').length===4);
 const half=await mutate('acad_create_drawing_sheet',{size:'A4',orientation:'portrait',origin:[500,0,0],viewScale:0.5,layer:'ISO-VISIBLE'});
 check('viewScale 1:2 doubles the A4 portrait sheet in the model',nearPoint(half.sheet.frame.min,[540,20,0])&&nearPoint(half.sheet.frame.max,[900,574,0]));
 // H2 title block: only given fields are filled.
 const fields={title:'BODY',scale:'1:1',programme:'Mech. Eng.',date:'11 / 11 / 2026',institution:'Example University',department:'Dept. of Mech. Eng.'};
 const block=await mutate('acad_create_title_block',{layout:'education_122x31',corner:sheet.sheet.titleBlockCorner,projectionSymbol:'first_angle',style:'SHEET-ARIAL',layer:'ISO-VISIBLE',fields});
 console.log('TITLE',JSON.stringify(block.titleBlock),JSON.stringify(block.observedGeometry.items[0].attributes));
 const attributes=block.observedGeometry.items[0].attributes;
 check('all ten fields exist; omitted fields are empty',Object.keys(attributes).length===10&&attributes.TITLE==='BODY'&&attributes.SCALE==='1:1'&&attributes.NAME===''&&attributes.CHECKED_BY===''&&attributes.ID_NUMBER===''&&attributes.NUMBER==='');
 check('signed title block inserted at the frame corner',block.titleBlock.blockName.startsWith('MCP-SYM-TITLE-EDU122X31-V1-')&&nearPoint(block.observedGeometry.items[0].position,[410,10,0])&&near(block.titleBlock.bounds.min[0],410-154.7128,1e-4)&&near(block.titleBlock.bounds.max[1],10+30.5952,1e-4));
 const definition=await session.call('acad_get_block',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',name:block.titleBlock.blockName});
 console.log('DEFINITION',JSON.stringify(definition).slice(0,600));
 const named=await mutate('acad_set_attributes',{entityRef:block.created[0],attributes:{NAME:'Example Student'}},false);
 check('fields stay editable with set_attributes',JSON.stringify(named).includes('Example Student'));
 const third=await mutate('acad_create_title_block',{layout:'education_122x31',corner:[900,10,0],viewScale:0.5,projectionSymbol:'third_angle',style:'SHEET-ARIAL',layer:'ISO-VISIBLE'});
 check('third angle at 1:2 is a different signed definition',third.titleBlock.blockName!==block.titleBlock.blockName&&Object.values(third.observedGeometry.items[0].attributes).every(v=>v===''));
 check('a value wider than its cell is rejected, not squeezed',await rejected('acad_create_title_block',{layout:'education_122x31',corner:[0,400,0],projectionSymbol:'first_angle',style:'SHEET-ARIAL',fields:{department:'Department of Mechanical Engineering and Naval Architecture'}}));
 check('unknown title block field rejected',await rejected('acad_create_title_block',{layout:'education_122x31',corner:[0,400,0],projectionSymbol:'first_angle',fields:{owner:'x'}}));
 // Text justification and the style width factor.
 const centred=await mutate('acad_create_text',{position:[200,150,0],text:'İTÜ Ş Ğ ı',height:2.5,style:'SHEET-ARIAL',justification:'middle_center',layer:'ISO-TEXT'});
 const t=centred.observedGeometry.items[0];
 check('middle-centred text keeps its anchor and the style width factor',t.justification==='middle_center'&&nearPoint(t.position,[200,150,0])&&near(t.widthFactor,0.85,1e-9));
 // Dimension text: diameter linePoint and linear textPosition.
 const c=await mutate('acad_create_circle',{center:[100,200,0],radius:10,layer:'ISO-VISIBLE'});
 const dia=await mutate('acad_create_dimension',{kind:'diameter',start:[100+10*Math.cos(0.5),200+10*Math.sin(0.5),0],end:[100-10*Math.cos(0.5),200-10*Math.sin(0.5),0],linePoint:[100+25*Math.cos(0.5),200+25*Math.sin(0.5),0],style:'ISO-ISO129',layer:'ISO-DIMENSION'});
 check('diameter text sits at linePoint on the diameter line outside the circle',nearPoint(dia.observedGeometry.items[0].textPosition,[100+25*Math.cos(0.5),200+25*Math.sin(0.5),0],1e-6));
 const lin=await mutate('acad_create_dimension',{kind:'linear',start:[90,170,0],end:[93,170,0],linePoint:[91.5,162,0],rotation:0,textPosition:[100,158,0],style:'ISO-ISO129',layer:'ISO-DIMENSION'});
 check('linear textPosition moves only the text',nearPoint(lin.observedGeometry.items[0].textPosition,[100,158,0])&&near(lin.observedGeometry.items[0].linePoint[1],162));
 // Bare leader without landingDirection; content still needs it.
 const bare=await mutate('acad_create_leader',{vertices:[[150,100,0],[160,100,0]],terminator:'arrow',terminatorSize:4,landingLength:0,content:{kind:'none'},layer:'ISO-THIN'});
 check('bare leader defaults its side',bare.observedGeometry.items[0].terminator==='arrow');
 check('leader with text and no landingDirection is rejected',await rejected('acad_create_leader',{vertices:[[150,110,0],[160,110,0]],terminator:'arrow',terminatorSize:4,landingLength:0,content:{kind:'text',text:'A',height:3.5},layer:'ISO-THIN'}));
 // Query without a filter.
 const all=await session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',projection:['handle','type'],limit:1000});
 check('query without filter returns every entity',all.items.length>=15);
 // Vertical-plane extrusion.
 const profile=await mutate('acad_create_polyline',{vertices:[[0,0,0],[10,0,0],[10,5,0],[0,5,0]],closed:true,layer:'ISO-THIN'});
 const xz=await mutate('acad_extrude',{entityRef:profile.created[0],height:4,profilePlane:'XZ',layer:'ISO-VISIBLE'});
 const xzSolid=xz.observedGeometry.items[0];console.log('XZ',JSON.stringify(xzSolid));
 check('XZ profile extruded along +Y',near(xzSolid.volume,200,1e-6)&&nearPoint(xzSolid.extents.min,[0,0,0])&&nearPoint(xzSolid.extents.max,[10,4,5]));
 const yz=await mutate('acad_extrude',{entityRef:profile.created[0],height:-4,profilePlane:'YZ',layer:'ISO-VISIBLE'});
 const yzSolid=yz.observedGeometry.items[0];
 check('YZ profile extruded along -X',near(yzSolid.volume,200,1e-6)&&nearPoint(yzSolid.extents.min,[-4,0,0])&&nearPoint(yzSolid.extents.max,[0,10,5]));
 // Monochrome layout and PDF.
 const devices=await session.call('acad_get_plot_devices',session.target),device=devices.devices.find((x:any)=>x.device==='DWG To PDF.pc3');
 const media=device?.media.find((m:string)=>m==='ISO_full_bleed_A3_(420.00_x_297.00_MM)');check('full-bleed A3 media available',Boolean(media));
 const layout=await mutate('acad_create_layout',{name:'SHEET_A3',device:device.device,media,rotation:'0',plotStyle:'monochrome.ctb',viewport:{paperCenter:[210,148.5],paperSize:[420,297],modelCenter:[210,148.5,0],direction:'top',scale:1}});
 check('layout uses monochrome.ctb',layout.createdLayouts[0].plotStyle==='monochrome.ctb');
 check('uninstalled plot style rejected',await rejected('acad_create_layout',{name:'BAD',device:device.device,media,plotStyle:'custom.ctb',viewport:{paperCenter:[210,148.5],paperSize:[420,297],modelCenter:[210,148.5,0],direction:'top',scale:1}}));
 await mutate('acad_export_pdf',{layoutName:'SHEET_A3',outputRootId:'test-output',relativePath:'sheets.pdf',overwrite:false},false);
 const exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});await copyFile(join(session.output,'sheets.pdf'),join(exportRoot,'sheets.pdf'));
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'sheets.dwg',overwrite:false},false);
 const output=join(session.output,'sheets.dwg'),outputHash=await hash(output),exported=join(exportRoot,'sheets.dwg');await copyFile(output,exported);
 await session.close();s=undefined;check('source file bytes preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);
 const inserts=(await r.call('acad_query_entities',{...r.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{type:'INSERT'},projection:['blockName','attributes'],limit:100})).items;
 check('reopened title blocks keep their fields',inserts.length===2&&inserts.some((x:any)=>x.attributes.NAME==='Example Student'&&x.attributes.TITLE==='BODY'));
 const layouts=await r.call('acad_list_layouts',r.target);
 check('reopened layout keeps the monochrome plot style',layouts.layouts.SHEET_A3?.plotStyle==='monochrome.ctb');
 await r.close();r=undefined;check('saved DWG bytes preserved',await hash(input)===outputHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,output:exported},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
