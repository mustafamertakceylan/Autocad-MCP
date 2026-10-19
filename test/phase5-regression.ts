// Explicit native acceptance runner. Each suite owns a new synthetic session.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
if(process.platform!=='win32'||process.env.AUTOCAD_MCP_PHASE5_TEST!=='1')throw Error('Explicit Windows native acceptance opt-in required');
const root=resolve('tmp/phase5-regressions',randomUUID());await mkdir(root,{recursive:true});const run=promisify(execFile),suites:any[]=[];
try{
 for(const name of ['annotations','geometry2d','curve-edits','blocks','solids','detailing','machining','plotting','xrefs','batch','views']){
  try{
   const result=await run(process.execPath,[resolve('dist/test/'+name+'-windows.js')],{windowsHide:true,maxBuffer:1024*1024});await writeFile(join(root,name+'.log'),result.stdout+result.stderr);
   const match=result.stdout.match(/Evidence: ([^\r\n]+)/);if(!match)throw Error('Missing suite evidence');const data=JSON.parse(await readFile(join(match[1]!,'results.json'),'utf8'));if(data.passed!==true)throw Error('Failed suite evidence');
   suites.push({name,passed:true,checks:data.checks.length,evidence:match[1]});console.log('PASS '+name+': '+data.checks.length+' checks');
  }catch(error){const e=error as Error&{stdout?:string;stderr?:string};await writeFile(join(root,name+'.log'),(e.stdout??'')+(e.stderr??'')+'\n'+String(e));throw error;}
 }
 await writeFile(join(root,'results.json'),JSON.stringify({passed:true,suites,totalChecks:suites.reduce((n,s)=>n+s.checks,0)},null,2));console.log('Evidence: '+root);
}catch(error){await writeFile(join(root,'results.json'),JSON.stringify({passed:false,suites,error:String(error)},null,2));console.error('Failed regression evidence: '+root);throw error;}
