// Public MCP metadata only. No AutoCAD instance or pairing is needed.
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const client=new Client({name:'tool-catalog-export',version:'0.1.0'});
try{
 await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve('dist/src/main.js')],stderr:'pipe'}));
 const {tools}=await client.listTools(),{resources}=await client.listResources();
 await writeFile('docs/TOOL_CATALOG.json',JSON.stringify({bridgeVersion:'0.1.0',transport:'stdio',platform:'Windows AutoCAD 2027',toolCount:tools.length,tools,resources},null,2)+'\n');
 console.log('Exported public tool schemas:',tools.length,'resources:',resources.length);
}finally{await client.close();}
