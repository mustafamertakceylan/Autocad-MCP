import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { copyFile,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
// A1-A3: ISO drawing profile, native leaders and the symbol block engine on a synthetic stock-template copy.
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});const template=join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt');
const source=join(root,'source.dwg');await copyFile(template,source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
const near=(a:number,b:number)=>Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-7);const samePoint=(a:number[],b:number[])=>a.every((v,i)=>near(v,b[i]!));
let s:Awaited<ReturnType<typeof windowsSession>>|undefined,r:typeof s,c:typeof s;let symbolEngine:'tested'|'not_run_normal_build'='not_run_normal_build';
type Session=NonNullable<typeof s>;
const helpers=(session:Session)=>{
 const info=()=>session.call('acad_get_document_info',session.target);
 const query=(type?:string)=>session.call('acad_query_entities',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:type?{type}:{},projection:['handle','type','layer','vertices','terminator','terminatorSize','landingLength','landingDirection','contentKind','text','textHeight','blockName','attributes','position','symbol'],limit:1000});
 const mutate=async(name:ToolName,args:any,spatial=true,error?:string)=>{
  const p={...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,...(spatial?{coordinateSystem:'WCS',lengthUnit:'mm'}:{}),...args};const reply=await session.client.callTool({name,arguments:p}),result=reply.structuredContent as any;calls.push({name,args:p,result});
  if(error){check(name+' rejects '+error,reply.isError&&result.error.code===error&&result.applied===false);return result;}
  if(reply.isError)throw Error(name+': '+result?.error?.code+' '+result?.error?.message);
  check(name+' verified',result.status==='succeeded'&&result.applied===true&&result.verified===true);return result;
 };
 const control=async(action:string):Promise<any>=>session.bridge.call('bridge.test_action' as ToolName,{instanceId:session.target.instanceId,action});
 return {info,query,mutate,control};
};
try{
 s=await windowsSession(join(root,'draw'),source,{units:4});const session=s,{info,query,mutate,control}=helpers(session);
 // A2: ISO profile
 const profile=await mutate('acad_setup_drawing_standard',{standard:'ISO',lineGroup:0.5,textHeight:3.5,decimalSeparator:'comma',precision:2},false);
 check('profile reports pending full-text verification and paper-mm patterns',profile.profile.verification==='pending_full_text'&&profile.profile.linetypePatternUnit==='paper_mm'&&near(profile.profile.lineGroup.thinMm,0.25));
 const layers=(await session.call('acad_list_layers',session.target)).layers,layer=(n:string)=>layers.find((x:any)=>x.name==='ISO-'+n);
 check('visible layer is thick 0.50 continuous',layer('VISIBLE')?.lineweight===50&&layer('VISIBLE')?.linetype==='Continuous');
 check('hidden/center/phantom layers are thin 0.25 with ISO linetypes',layer('HIDDEN')?.lineweight===25&&layer('HIDDEN')?.linetype==='ISO-DASHED-W025'&&layer('CENTER')?.linetype==='ISO-LONGDASH-DOT-W025'&&layer('PHANTOM')?.linetype==='ISO-LONGDASH-DDOT-W025');
 check('text and symbol layers use lettering stroke h/10 = 0.35',layer('TEXT')?.lineweight===35&&layer('SYMBOL')?.lineweight===35);
 check('ten profile layers created',layers.filter((x:any)=>x.name.startsWith('ISO-')).length===10);
 const styles=(await session.call('acad_list_styles',session.target)).styles,style=(n:string)=>styles.find((x:any)=>x.name===n);
 check('dashed pattern is 12d,-3d for d=0.25',JSON.stringify(style('ISO-DASHED-W025')?.dashes.map((v:number)=>+v.toFixed(9)))===JSON.stringify([3,-0.75]));
 check('long-dash dot pattern is 24d,-3d,dot,-3d',JSON.stringify(style('ISO-LONGDASH-DOT-W025')?.dashes.map((v:number)=>+v.toFixed(9)))===JSON.stringify([6,-0.75,0,-0.75]));
 check('lettering style uses isocp.shx',style('ISO-ISO3098')?.font?.toLowerCase()==='isocp.shx');
 check('dimension style uses lettering style and 3.5 mm text',style('ISO-ISO129')?.textStyle==='ISO-ISO3098'&&near(style('ISO-ISO129')?.textHeight,3.5));
 const before=(await info()).revision;
 await mutate('acad_setup_drawing_standard',{standard:'ISO',lineGroup:0.5,textHeight:3.5,decimalSeparator:'comma',precision:2},false,'VALIDATION_FAILED');
 check('repeated profile changes nothing',(await info()).revision===before);
 // A1: leaders
 const text=await mutate('acad_create_leader',{vertices:[[0,0,0],[20,15,0]],terminator:'arrow',terminatorSize:3.5,landingLength:10,landingDirection:'right',content:{kind:'text',text:'4x Ø6,6',height:3.5,style:'ISO-ISO3098',placement:'above'},layer:'ISO-DIMENSION'});
 const t=text.observedGeometry.items[0];
 check('text leader keeps exact vertices, filled arrow and reference line',t.type==='MLEADER'&&t.vertices.length===2&&samePoint(t.vertices[0],[0,0,0])&&samePoint(t.vertices[1],[20,15,0])&&t.terminator==='arrow'&&near(t.terminatorSize,3.5)&&near(t.landingLength,10)&&t.landingDirection==='right'&&samePoint(t.contentConnection,[30,15,0]));
 check('text leader content and style read back',t.contentKind==='text'&&t.text==='4x Ø6,6'&&near(t.textHeight,3.5)&&t.style==='ISO-ISO3098'&&t.layer==='ISO-DIMENSION');
 const left=await mutate('acad_create_leader',{vertices:[[0,-150,0],[-15,-140,0]],terminator:'arrow',terminatorSize:3.5,landingLength:6,landingDirection:'left',content:{kind:'text',text:'R2',height:3.5,style:'ISO-ISO3098',placement:'after'}});
 const l=left.observedGeometry.items[0];check('left reference line with text after it joins at the line end',l.landingDirection==='left'&&near(l.landingLength,6)&&samePoint(l.contentConnection,[-21,-140,0])&&samePoint(l.vertices[1],[-15,-140,0]));
 const dot=await mutate('acad_create_leader',{vertices:[[50,0,0],[60,10,0],[70,10,0]],terminator:'dot',terminatorSize:1.5,landingLength:0,landingDirection:'left',content:{kind:'none'}});
 const d=dot.observedGeometry.items[0];check('dot leader keeps three vertices without reference line',d.terminator==='dot'&&d.vertices.length===3&&samePoint(d.vertices[2],[70,10,0])&&near(d.landingLength,0)&&d.contentKind==='none');
 const square=await mutate('acad_create_polyline',{vertices:[[0,0,0],[7,0,0],[7,7,0],[0,7,0]],closed:true});
 const label=await mutate('acad_create_text',{position:[2,2,0],text:'A',height:3.5});
 await mutate('acad_define_block',{name:'TEST-TAG',basePoint:[0,3.5,0],targets:[...square.created,...label.created],attributes:[{tag:'NOTE',prompt:'Note',defaultValue:'-',position:[8,2,0],height:2.5}]});
 const block=await mutate('acad_create_leader',{vertices:[[100,0,0],[110,10,0]],terminator:'none',terminatorSize:2.5,landingLength:5,landingDirection:'right',content:{kind:'block',name:'TEST-TAG',attributes:{NOTE:'KONTROL'}}});
 const b=block.observedGeometry.items[0];check('block leader connects at block base with attribute',b.terminator==='none'&&b.contentKind==='block'&&b.blockName==='TEST-TAG'&&b.attributes.NOTE==='KONTROL'&&samePoint(b.position,[115,10,0])&&samePoint(b.contentConnection,[115,10,0]));
 const rejected=(await info()).revision;
 await mutate('acad_create_leader',{vertices:[[0,50,0],[10,60,0]],terminator:'arrow',terminatorSize:2.5,landingLength:5,landingDirection:'right',content:{kind:'block',name:'TEST-TAG',attributes:{UNKNOWN:'1'}}},true,'VALIDATION_FAILED');
 await mutate('acad_create_leader',{vertices:[[0,50,0],[10,60,0]],terminator:'arrow',terminatorSize:2.5,landingLength:5,landingDirection:'right',content:{kind:'block',name:'MISSING-BLOCK'}},true,'TARGET_NOT_FOUND');
 check('rejected leaders change nothing',(await info()).revision===rejected&&(await query('MLEADER')).items.length===4);
 await mutate('acad_move_entities',{targets:text.created,delta:[0,-40,0]});
 const moved=(await query('MLEADER')).items.find((x:any)=>x.handle===text.created[0].handle);check('moved leader shifts every vertex',samePoint(moved.vertices[0],[0,-40,0])&&samePoint(moved.vertices[1],[20,-25,0]));
 // A3: symbol engine (testing build only)
 let symbolName='';
 try{symbolName=(await control('symbol_name_test')).blockName;}catch{symbolName='';}
 if(symbolName){
  symbolEngine='tested';
  const first=await control('symbol_define_test');check('symbol block is created with signature',first.created===true&&first.blockName===symbolName&&first.symbol.id==='TEST-CROSS'&&first.symbol.version===1);
  const revision=(await info()).revision,second=await control('symbol_define_test');check('identical symbol is reused without a drawing change',second.created===false&&(await info()).revision===revision);
  const definition=await session.call('acad_get_block',{...session.target,coordinateSystem:'WCS',lengthUnit:'mm',name:symbolName});
  check('symbol definition holds generated parts and attribute',definition.items.length===5&&definition.attributeDefinitions.length===1&&definition.attributeDefinitions[0].tag==='LABEL'&&near(definition.attributeDefinitions[0].height,3.5));
  const lead=await mutate('acad_create_leader',{vertices:[[150,0,0],[160,10,0]],terminator:'arrow',terminatorSize:3.5,landingLength:5,landingDirection:'right',content:{kind:'block',name:symbolName,attributes:{LABEL:'B'}},layer:'ISO-SYMBOL'});
  check('symbol leader reports catalog identity',lead.observedGeometry.items[0].symbol?.id==='TEST-CROSS'&&lead.observedGeometry.items[0].attributes.LABEL==='B');
 }
 // Line-type appearance through a 1:1 A4 viewport (PSLTSCALE=1): inspect the PDF visually.
 await mutate('acad_create_polyline',{vertices:[[0,-110,0],[80,-110,0],[80,-70,0],[0,-70,0]],closed:true,layer:'ISO-VISIBLE'});
 await mutate('acad_create_line',{start:[0,-100,0],end:[80,-100,0],layer:'ISO-HIDDEN'});
 await mutate('acad_create_line',{start:[-8,-90,0],end:[88,-90,0],layer:'ISO-CENTER'});
 await mutate('acad_create_line',{start:[0,-60,0],end:[80,-60,0],layer:'ISO-PHANTOM'});
 await mutate('acad_create_dimension',{kind:'linear',start:[0,-110,0],end:[80,-110,0],linePoint:[40,-122,0],style:'ISO-ISO129',layer:'ISO-DIMENSION'});
 const devices=await session.call('acad_get_plot_devices',session.target),device=devices.devices.find((x:any)=>x.device==='DWG To PDF.pc3');
 const media=device?.media.find((m:string)=>m==='ISO_full_bleed_A4_(297.00_x_210.00_MM)');check('full-bleed A4 PDF media available',Boolean(media));
 await mutate('acad_create_layout',{name:'ISO_A4',device:device.device,media,rotation:'0',viewport:{paperCenter:[148.5,105],paperSize:[277,190],modelCenter:[85,-45,0],direction:'top',scale:1}});
 await mutate('acad_export_pdf',{layoutName:'ISO_A4',outputRootId:'test-output',relativePath:'standards-leaders.pdf',overwrite:false},false);
 const pdf=join(session.output,'standards-leaders.pdf');const pdfCopy=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1),'standards-leaders.pdf');await mkdir(resolve(pdfCopy,'..'),{recursive:true});await copyFile(pdf,pdfCopy);
 check('PDF written with a PDF header',(await readFile(pdf)).subarray(0,5).toString()==='%PDF-');
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'standards-leaders.dwg',overwrite:false},false);
 const output=join(session.output,'standards-leaders.dwg'),outputHash=await hash(output),exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});const exported=join(exportRoot,'standards-leaders.dwg');await copyFile(output,exported);
 const symbolNameSaved=symbolName;
 await session.close();s=undefined;check('source file bytes preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);const again=helpers(r);
 const leaders=(await again.query('MLEADER')).items;check('reopened drawing keeps all leaders',leaders.length===(symbolNameSaved?5:4));
 const reText=leaders.find((x:any)=>x.contentKind==='text'&&x.text==='4x Ø6,6');check('reopened text leader keeps text and vertices',reText.text==='4x Ø6,6'&&samePoint(reText.vertices[0],[0,-40,0]));
 if(symbolNameSaved)check('reopened symbol keeps its signature',leaders.some((x:any)=>x.symbol?.id==='TEST-CROSS'));
 const reLayers=(await r.call('acad_list_layers',r.target)).layers;check('reopened profile layers preserved',reLayers.filter((x:any)=>x.name.startsWith('ISO-')).length===10);
 await r.close();r=undefined;check('saved DWG bytes preserved',await hash(input)===outputHash);
 if(symbolNameSaved){
  // A same-named block without the engine signature must never be reused as a symbol.
  const conflictSource=join(root,'conflict.dwg');await copyFile(template,conflictSource);c=await windowsSession(join(root,'conflict'),conflictSource,{units:4});const k=helpers(c);
  const line=await k.mutate('acad_create_line',{start:[0,0,0],end:[5,0,0]});
  await k.mutate('acad_define_block',{name:symbolNameSaved,basePoint:[0,0,0],targets:line.created});
  const revision=(await k.info()).revision;let code='';try{code=(await k.control('symbol_define_test'))?.error?.code??'';}catch(error){code=(error as any).code??String(error);}
  check('foreign block with reserved symbol name is rejected',code.includes('VALIDATION_FAILED')&&(await k.info()).revision===revision);
  await c.close();c=undefined;
 }
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,symbolEngine,output:exported},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,symbolEngine,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();await c?.terminate();}
