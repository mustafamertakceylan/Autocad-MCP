import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { copyFile,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { windowsSession } from './windows-session.js';
import type { ToolName } from '../src/tools.js';
// C1-C3, C5: ISO feature control frames with leaders, datum features and general specification notes on a synthetic stock-template copy.
if(process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Phase5 live opt-in required');
const root=resolve('tmp/phase5-runs',randomUUID());await mkdir(root,{recursive:true});
const source=join(root,'source.dwg');await copyFile(join(process.env.LOCALAPPDATA!,'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'),source);
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex'),sourceHash=await hash(source);
const checks:Array<{name:string;passed:true}>=[],calls:any[]=[];const check=(name:string,ok:unknown)=>{assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);};
const near=(a:number,b:number,t=1e-6)=>Math.abs(a-b)<=t;
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
 const rejected=async(name:ToolName,args:any)=>{
  const reply=await session.client.callTool({name,arguments:{...session.target,operationId:randomUUID(),expectedRevision:(await info()).revision,coordinateSystem:'WCS',lengthUnit:'mm',...args}});
  return reply.isError&&(reply.structuredContent as any)?.applied!==true;
 };
 await mutate('acad_setup_drawing_standard',{standard:'ISO',lineGroup:0.5,textHeight:3.5,decimalSeparator:'comma',precision:2},false);
 const plate=await mutate('acad_create_polyline',{vertices:[[0,0,0],[80,0,0],[80,40,0],[0,40,0]],closed:true,layer:'ISO-VISIBLE'});
 const height=await mutate('acad_create_dimension',{kind:'linear',start:[0,0,0],end:[0,40,0],linePoint:[-12,20,0],rotation:Math.PI/2,style:'ISO-ISO129',layer:'ISO-DIMENSION'});
 const plateRef=plate.created[0],dimRef=height.created[0];
 const frame={textHeight:3.5,style:'ISO-ISO129',layer:'ISO-DIMENSION',decimalSeparator:'comma'};
 // C1/C2: flatness on the top surface, leader on the outline.
 const flat=await mutate('acad_create_feature_control_frame',{...frame,position:[55,58,0],rows:[{characteristic:'flatness',zone:{value:'0,05'}}],
  leader:{vertices:[[40,40,0],[40,58,0]],terminator:'arrow',terminatorSize:3.5,attachment:{kind:'surface',entityRef:plateRef},allAround:'all_around'}});
 console.log('FLAT',JSON.stringify({text:flat.formattedText,frame:flat.frame,leader:flat.leader,items:flat.observedGeometry.items}));
 check('flatness frame text keeps the written value',flat.formattedText==='{\\Fgdt;c}%%v0,05%%v');
 const leader=flat.observedGeometry.items.find((x:any)=>x.type==='LEADER');
 check('native LEADER is associated with the frame and starts on the surface',leader&&leader.annotation===flat.created[0].handle&&near(leader.vertices[0][0],40)&&near(leader.vertices[0][1],40)&&leader.terminator==='arrow'&&leader.vertices.length===3&&near(leader.vertices[2][0],55)&&near(leader.vertices[2][1],58));
 check('all-around circle on the leader bend',flat.observedGeometry.items.some((x:any)=>x.type==='CIRCLE'&&near(x.center[0],40)&&near(x.center[1],58)));
 // Position: Ø zone, MMR, datum system with modifiers, axis leader in line with the dimension line, adjacent indications.
 const pos=await mutate('acad_create_feature_control_frame',{...frame,position:[-80,70,0],rows:[{characteristic:'position',zone:{value:'0,1',shape:'diameter',material:'MMR'},datums:['A',{letters:['B'],material:'MMR'},{letters:['C','D']}]}],
  adjacent:{count:4,between:{from:'E',to:'F'}},leader:{vertices:[[-12,46,0],[-12,70,0]],terminator:'arrow',terminatorSize:3.5,attachment:{kind:'axis',dimension:dimRef}}});
 console.log('POS',JSON.stringify({text:pos.formattedText,frame:pos.frame,adjacent:pos.adjacent,leader:pos.leader,items:pos.observedGeometry.items}));
 check('position frame: Ø, Ⓜ, datum Ⓜ and common datum C-D',pos.formattedText==='{\\Fgdt;j}%%v{\\Fgdt;n}0,1 {\\Fgdt;m}%%v%%vA%%vB{\\Fgdt;m}%%vC-D');
 check('adjacent indication above the frame',pos.adjacent.formattedText==='4× E{\\Famgdt;#}F');
 // ISO modifier set and stacked rows.
 const mods=await mutate('acad_create_feature_control_frame',{...frame,position:[100,60,0],rows:[
  {characteristic:'surface_profile',zone:{value:'0,2',combined:'CZ',offset:'+0,05',constraint:'OZ'},datums:['A']},
  {characteristic:'position',zone:{value:'0,04',shape:'diameter',derived:true,projected:'12',material:'LMR',reciprocity:true,freeState:true},datums:[{letters:['A'],modifiers:['CF','PL']}]},
  {characteristic:'symmetry',zone:{value:'0,02'},datums:['B']}]});
 console.log('MODS',JSON.stringify({text:mods.formattedText,frame:mods.frame}));
 check('three stacked rows with ISO modifiers',mods.formattedText==='{\\Fgdt;d}%%v0,2 CZ UZ+0,05 OZ%%v%%vA\n{\\Fgdt;j}%%v{\\Fgdt;n}0,04 {\\Famgdt;!} {\\Fgdt;p}12 {\\Fgdt;l}{\\Famgdt;\\}} {\\Famgdt;@}%%v%%vA[CF][PL]\n{\\Fgdt;i}%%v0,02%%v%%vB');
 const same=await mutate('acad_create_feature_control_frame',{...frame,position:[100,20,0],rows:[{characteristic:'position',zone:{value:'0,5',shape:'diameter'},datums:['A','B']},{characteristic:'position',zone:{value:'0,1',shape:'diameter'},datums:['A']}]});
 console.log('SAME',JSON.stringify({text:same.formattedText,frame:same.frame}));
 // Legacy single-line form is unchanged.
 const legacy=await mutate('acad_create_feature_control_frame',{position:[100,-10,0],characteristic:'position',tolerance:0.05,diameterZone:true,materialCondition:'MMC',datums:['A','B'],textHeight:3.5,layer:'ISO-DIMENSION'});
 check('legacy frame text is unchanged',legacy.observedGeometry.items[0].text==='{\\Fgdt;j}%%v{\\Fgdt;n}0.05{\\Fgdt;m}%%v%%vA%%vB');
 // Rejections before any drawing change.
 const before=(await info()).revision;
 check('form tolerance with a datum is rejected before AutoCAD',await rejected('acad_create_feature_control_frame',{...frame,position:[0,0,0],rows:[{characteristic:'flatness',zone:{value:'0,05'},datums:['A']}]}));
 check('orientation tolerance without a datum is rejected',await rejected('acad_create_feature_control_frame',{...frame,position:[0,0,0],rows:[{characteristic:'parallelism',zone:{value:'0,05'}}]}));
 await mutate('acad_create_feature_control_frame',{...frame,position:[55,58,0],rows:[{characteristic:'flatness',zone:{value:'0,05'}}],
  leader:{vertices:[[40,41,0],[40,58,0]],terminator:'arrow',terminatorSize:3.5,attachment:{kind:'surface',entityRef:plateRef}}},true,'VALIDATION_FAILED');
 await mutate('acad_create_feature_control_frame',{...frame,position:[-40,70,0],rows:[{characteristic:'position',zone:{value:'0,1',shape:'diameter'},datums:['A']}],
  leader:{vertices:[[-10,46,0],[-10,70,0]],terminator:'arrow',terminatorSize:3.5,attachment:{kind:'axis',dimension:dimRef}}},true,'VALIDATION_FAILED');
 await mutate('acad_create_feature_control_frame',{...frame,position:[-20,70,0],rows:[{characteristic:'position',zone:{value:'0,1',shape:'diameter'},datums:['A']}],
  leader:{vertices:[[-12,46,0],[-12,70,0]],terminator:'arrow',terminatorSize:3.5,attachment:{kind:'axis',dimension:dimRef}}},true,'VALIDATION_FAILED');
 check('off-feature, misaligned and frame-crossing leaders leave the drawing unchanged',(await info()).revision===before);
 // C3 datum features.
 const datumA=await mutate('acad_create_datum_feature',{letter:'A',triangle:'filled',triangleSize:3.5,vertices:[[30,0,0],[30,-12,0]],textHeight:3.5,style:'ISO-ISO3098',layer:'ISO-SYMBOL',attachment:{kind:'surface',entityRef:plateRef}});
 console.log('DATUM A',JSON.stringify({datum:datumA.datum,items:datumA.observedGeometry.items}));
 const [a,aFrame]=datumA.observedGeometry.items;
 check('datum A: filled triangle on the surface, letter frame below at the leader end',a.terminator==='datum_filled'&&a.contentKind==='none'&&aFrame.type==='INSERT'&&aFrame.attributes.DATUM==='A'&&near(aFrame.position[0],30)&&near(aFrame.position[1],-12)&&datumA.datum.frameSide==='top');
 const datumB=await mutate('acad_create_datum_feature',{letter:'B',triangle:'open',triangleSize:3.5,vertices:[[-12,0,0],[-12,-12,0]],textHeight:3.5,style:'ISO-ISO3098',layer:'ISO-SYMBOL',attachment:{kind:'axis',dimension:dimRef}});
 check('datum B: open triangle in line with the dimension line',datumB.observedGeometry.items[0].terminator==='datum_open'&&datumB.observedGeometry.items[1].attributes.DATUM==='B'&&datumB.datum.frameSide==='top');
 const datumC=await mutate('acad_create_datum_feature',{letter:'C',triangle:'filled',triangleSize:3.5,vertices:[[80,20,0],[92,20,0]],textHeight:3.5,style:'ISO-ISO3098',layer:'ISO-SYMBOL',attachment:{kind:'surface',entityRef:plateRef}});
 check('datum frame blocks are signed symbols, one per side and size',datumC.datum.frameBlock.startsWith('MCP-SYM-DATUM-L-V1-')&&datumA.datum.frameBlock.startsWith('MCP-SYM-DATUM-T-V1-')&&datumB.datum.frameBlock===datumA.datum.frameBlock);
 check('axis datum leader along a crossing direction is rejected',await mutate('acad_create_datum_feature',{letter:'D',triangle:'open',triangleSize:3.5,vertices:[[-12,0,0],[-24,0,0]],textHeight:3.5,attachment:{kind:'axis',dimension:dimRef}},true,'VALIDATION_FAILED'));
 // C5 general specification.
 const general=await mutate('acad_create_general_specification',{position:[0,-30,0],textHeight:3.5,style:'ISO-ISO3098',frameStyle:'ISO-ISO129',decimalSeparator:'comma',layer:'ISO-DIMENSION',
  items:[{kind:'iso8015'},{kind:'iso2768',class:'m'},{kind:'iso14405_envelope'},{kind:'iso10579',restraint:'Restrained at datum A, 6 bolts M8'},{kind:'iso22081_geometrical',tolerance:'1',datums:['A','B','C']}]});
 console.log('GENERAL',JSON.stringify({text:general.formattedText,frame:general.frame,frameText:general.frameText,items:general.observedGeometry.items}));
 check('general specification lists only the selected references',general.formattedText==='ISO 8015\\PISO 2768-m\\PISO 14405 {\\Famgdt;\\{}\\PISO 10579-NR\\PRestrained at datum A, 6 bolts M8\\PISO 22081'&&general.frameText==='{\\Fgdt;d}%%v1%%v%%vA%%vB%%vC');
 // PDF for visual inspection.
 const devices=await session.call('acad_get_plot_devices',session.target),device=devices.devices.find((x:any)=>x.device==='DWG To PDF.pc3');
 const media=device?.media.find((m:string)=>m==='ISO_full_bleed_A4_(297.00_x_210.00_MM)');check('full-bleed A4 PDF media available',Boolean(media));
 await mutate('acad_create_layout',{name:'GDT_A4',device:device.device,media,rotation:'0',viewport:{paperCenter:[148.5,105],paperSize:[277,190],modelCenter:[40,10,0],direction:'top',scale:1}});
 await mutate('acad_export_pdf',{layoutName:'GDT_A4',outputRootId:'test-output',relativePath:'tolerances.pdf',overwrite:false},false);
 const exportRoot=resolve('runtime/exports/phase5-'+root.split(/[/\\]/).at(-1));await mkdir(exportRoot,{recursive:true});await copyFile(join(session.output,'tolerances.pdf'),join(exportRoot,'tolerances.pdf'));
 await mutate('acad_save_copy',{outputRootId:'test-output',relativePath:'tolerances.dwg',overwrite:false},false);
 const output=join(session.output,'tolerances.dwg'),outputHash=await hash(output),exported=join(exportRoot,'tolerances.dwg');await copyFile(output,exported);
 await session.close();s=undefined;check('source file bytes preserved',await hash(source)===sourceHash);
 const input=join(root,'reopen.dwg');await copyFile(exported,input);r=await windowsSession(join(root,'reopen'),input);
 const q=async(type:string)=>(await r!.call('acad_query_entities',{...r!.target,coordinateSystem:'WCS',lengthUnit:'mm',filter:{type},projection:['handle','text','vertices','annotation','attributes','terminator'],limit:1000})).items;
 const frames=await q('FCF'),leaders=await q('LEADER'),mleaders=await q('MLEADER');
 check('reopened drawing keeps frames, associated leaders and datum features',frames.length===6&&leaders.length===2&&leaders.every((l:any)=>frames.some((x:any)=>x.handle===l.annotation))&&mleaders.length===3&&(await q('INSERT')).length===3);
 check('reopened frame text preserved',frames.some((x:any)=>x.text===mods.formattedText));
 await r.close();r=undefined;check('saved DWG bytes preserved',await hash(input)===outputHash);
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,checks,calls,output:exported},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,checks,calls,error:String(error)},null,2));throw error;}
finally{await s?.terminate();await r?.terminate();}
