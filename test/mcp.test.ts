import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { toolNames } from '../src/tools.js';
import { mockPlugin, cleanupFixture } from './fixture.js';

test('official SDK client exercises actual stdio process and paired IPC backend', async () => {
  const plugin = await mockPlugin();
  const client = new Client({ name: 'autocad-mcp-test', version: '0.1.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/main.js', import.meta.url)), '--grant-file', plugin.grantFile], stderr: 'pipe' });
  let stderr = ''; transport.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  try {
    await client.connect(transport);
    const list = await client.listTools();
    assert.deepEqual(list.tools.map(x => x.name).sort(), [...toolNames].sort());
    const status = await client.callTool({ name: 'acad_get_status', arguments: { instanceId: plugin.grant.instanceId } });
    assert.equal(status.isError, false);
    assert.equal((status.structuredContent as Record<string, unknown>).simulation, true);
    const error = await client.callTool({ name: 'acad_get_status', arguments: { instanceId: 'wrong' } });
    assert.equal(error.isError, true);
    assert.equal(stderr.includes(plugin.grant.secret), false);
  } finally { await client.close(); await plugin.close(); await cleanupFixture(plugin.folder); }
});
