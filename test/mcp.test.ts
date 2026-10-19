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
    const style = list.tools.find(x => x.name === 'acad_create_style')!.inputSchema as any;
    assert.equal(style.properties.documentEpoch.type, 'integer');
    assert.equal(style.properties.dashes.items.type, 'number');
    assert.equal(style.oneOf, undefined);
    const line = list.tools.find(x => x.name === 'acad_create_line')!.inputSchema as any;
    assert.equal(line.properties.start.items.type, 'number');
    const beforeInvalid = plugin.calls();
    const invalidStyle = await client.callTool({ name: 'acad_create_style', arguments: {
      instanceId: plugin.grant.instanceId, documentId: 'doc-1', documentEpoch: 1,
      operationId: 'invalid-style', expectedRevision: 0, kind: 'text', name: 'FONT'
    } });
    assert.equal(invalidStyle.isError, true);
    const invalidLine = await client.callTool({ name: 'acad_create_line', arguments: {
      instanceId: plugin.grant.instanceId, documentId: 'doc-1', documentEpoch: 1,
      operationId: 'invalid-line', expectedRevision: 0, coordinateSystem: 'WCS', lengthUnit: 'mm', start: '[0,0,0]', end: [1,0,0]
    } });
    assert.equal(invalidLine.isError, true);
    assert.equal(plugin.calls(), beforeInvalid, 'Compatible advertisement cannot send invalid values to the backend');
    const status = await client.callTool({ name: 'acad_get_status', arguments: { instanceId: plugin.grant.instanceId } });
    assert.equal(status.isError, false);
    assert.equal((status.structuredContent as Record<string, unknown>).simulation, true);
    const error = await client.callTool({ name: 'acad_get_status', arguments: { instanceId: 'wrong' } });
    assert.equal(error.isError, true);
    const unresolved = await client.callTool({ name: 'acad_get_operation_status', arguments: { instanceId: 'wrong', documentId: 'doc-1', documentEpoch: 1, operationId: 'unknown-op' } });
    assert.equal(unresolved.isError, true);
    assert.equal((unresolved.structuredContent as Record<string, unknown>).status, 'unknown');
    assert.equal((unresolved.structuredContent as Record<string, unknown>).applied, null, 'Status transport/auth failure cannot prove original mutation had no effect');
    assert.equal(stderr.includes(plugin.grant.secret), false);
  } finally { await client.close(); await plugin.close(); await cleanupFixture(plugin.folder); }
});
