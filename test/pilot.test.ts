import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { configureWorkspace, sessionGrant, bindSession } from '../src/pilot.js';
import { mockPlugin, cleanupFixture } from './fixture.js';

test('operator setup emits compatible client configs and skills without copying pairing secret or overwriting files', async()=>{
 const plugin=await mockPlugin();
 try{
  const folder=join(plugin.folder,'clients');await configureWorkspace(folder,plugin.grantFile);
  assert.equal(await sessionGrant(join(folder,'autocad-session.json')),plugin.grantFile);
  const files=['codex/.codex/config.toml','claude/.mcp.json','opencode/opencode.json','autocad-session.json','codex/.agents/skills/autocad-mcp/SKILL.md','claude/.claude/skills/autocad-mcp/SKILL.md'];
  const content=await Promise.all(files.map(f=>readFile(join(folder,f),'utf8')));
  assert.ok(content.every(s=>!s.includes(plugin.grant.secret)));
  assert.ok(content[0]!.includes('\nargs = '));
  const claude=JSON.parse(content[1]!),open=JSON.parse(content[2]!);
  assert.equal(claude.mcpServers.autocad.type,'stdio');
  assert.deepEqual(open.mcp.autocad.command,[claude.mcpServers.autocad.command,...claude.mcpServers.autocad.args]);
  assert.equal(content[4],content[5]);
  await assert.rejects(configureWorkspace(folder,plugin.grantFile),/new or empty/);
  assert.equal(await readFile(join(folder,'claude/.mcp.json'),'utf8'),content[1]);
  await writeFile(join(folder,'autocad-session.json'),JSON.stringify({version:1,grantFile:plugin.grantFile,instanceId:'replacement'}));
  await assert.rejects(sessionGrant(join(folder,'autocad-session.json')),/instance changed/);
 }finally{await plugin.close();await cleanupFixture(plugin.folder);}
});

test('generated pilot entrypoint serves actual MCP stdio and all 14 tools',async()=>{
 const plugin=await mockPlugin(),client=new Client({name:'pilot-test',version:'0.1.0'});
 try{
  const folder=join(plugin.folder,'clients');await configureWorkspace(folder,plugin.grantFile);
  const transport=new StdioClientTransport({command:process.execPath,args:[resolve('dist/src/pilot.js'),'serve','--session-file',join(folder,'autocad-session.json')],stderr:'pipe'});
  await client.connect(transport);assert.equal((await client.listTools()).tools.length,14);
  assert.equal((await client.listResources()).resources.length,2);
  const resource=await client.readResource({uri:'skill://autocad-mcp/autocad-mcp/SKILL.md'});
  assert.ok('text' in resource.contents[0]! && resource.contents[0].text.includes('name: autocad-mcp'));
  assert.ok(!JSON.stringify(resource).includes(plugin.grant.secret));
  await assert.rejects(client.readResource({uri:'skill://autocad-mcp/autocad-mcp/../../pairing.json'}));
  const response=await client.callTool({name:'acad_get_status',arguments:{instanceId:plugin.grant.instanceId}});
  assert.equal((response.structuredContent as any).backend,'mock');
 }finally{await client.close();await plugin.close();await cleanupFixture(plugin.folder);}
});


test('explicit re-pair changes only the pointer and preserves installed client configuration',async()=>{
 const one=await mockPlugin(),two=await mockPlugin();
 try{
  const folder=join(one.folder,'clients');await configureWorkspace(folder,one.grantFile);
  const config=await readFile(join(folder,'codex/.codex/config.toml'),'utf8');
  await bindSession(join(folder,'autocad-session.json'),two.grantFile);
  assert.equal(await sessionGrant(join(folder,'autocad-session.json')),two.grantFile);
  assert.equal(await readFile(join(folder,'codex/.codex/config.toml'),'utf8'),config);
  assert.ok(!(await readFile(join(folder,'autocad-session.json'),'utf8')).includes(two.grant.secret));
 }finally{await one.close();await two.close();await cleanupFixture(one.folder);await cleanupFixture(two.folder);}
});
