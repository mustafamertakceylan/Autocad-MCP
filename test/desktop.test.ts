import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { bindDesktop, configureDesktopWorkspace, DesktopBridgeClient, desktopClientCount, desktopWrite } from '../src/desktop-state.js';
import { DesktopManager, desktopHostFiles } from '../src/desktop-agent.js';
import { mockPlugin, cleanupFixture } from './fixture.js';
import { toolNames } from '../src/tools.js';

const tick = () => new Promise(ok => setTimeout(ok, 15));
async function controller(folder: string) {
  const root = join(folder, 'desktop'), manager = new DesktopManager(root, join(folder, 'hosts'), folder, undefined, async pid => pid === process.pid ? 'test-process-start' : null);
  await manager.initialize(); return { root, manager };
}
test('desktop routing reconnects an existing MCP transport without rewriting configuration or carrying old target identities', async () => {
  const one = await mockPlugin(), two = await mockPlugin(), { root, manager } = await controller(one.folder), client = new Client({ name: 'desktop-test', version: '0.1.0' });
  try {
    const workspace = join(one.folder, 'workspace'); await configureDesktopWorkspace(root, workspace);
    const configFile = join(workspace, 'claude/.mcp.json'), configText = await readFile(configFile, 'utf8'), config = JSON.parse(configText).mcpServers.autocad;
    await client.connect(new StdioClientTransport({ command: config.command, args: config.args, stderr: 'pipe' }));
    assert.equal((await client.listTools()).tools.length, toolNames.length);
    assert.deepEqual((await client.callTool({ name: 'acad_list_instances', arguments: {} })).structuredContent, { instances: [] });
    for (let i = 0; i < 100 && await desktopClientCount(root) !== 1; i++) await tick();
    assert.equal(await desktopClientCount(root), 1, 'Only initialized MCP clients count as connected');
    await bindDesktop(root, manager.controllerId, one.grantFile);
    assert.equal(((await client.callTool({ name: 'acad_get_status', arguments: { instanceId: one.grant.instanceId } })).structuredContent as any).backend, 'mock');
    await bindDesktop(root, manager.controllerId, two.grantFile);
    const stale = await client.callTool({ name: 'acad_get_status', arguments: { instanceId: one.grant.instanceId } });
    assert.equal((stale.structuredContent as any).error.code, 'INSTANCE_NOT_FOUND');
    assert.equal(((await client.callTool({ name: 'acad_get_status', arguments: { instanceId: two.grant.instanceId } })).structuredContent as any).backend, 'mock');
    assert.equal(await readFile(configFile, 'utf8'), configText);
    assert.equal((await configureDesktopWorkspace(root, workspace)).created, false);
    const receiptFile = join(workspace, '.autocad-desktop-workspace.json'), receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
    await writeFile(receiptFile, JSON.stringify({ ...receipt, serverRoot: join(one.folder, 'different-installation') }));
    await assert.rejects(configureDesktopWorkspace(root, workspace), /new workspace/);
    assert.equal(await readFile(configFile, 'utf8'), configText, 'A different installation must never rewrite existing client settings');
    await writeFile(receiptFile, JSON.stringify(receipt));
    await writeFile(join(workspace, 'codex/.codex/config.toml'), '');
    await assert.rejects(configureDesktopWorkspace(root, workspace), /Incomplete workspace/);
    await manager.disconnect();
    assert.deepEqual((await client.callTool({ name: 'acad_list_instances', arguments: {} })).structuredContent, { instances: [] });
    assert.equal(one.mutations() + two.mutations(), 0);
  } finally { await client.close(); await manager.close(); await one.close(); await two.close(); await cleanupFixture(one.folder); await cleanupFixture(two.folder); }
});
test('desktop selection invalidates queued requests rather than silently dispatching them after a reconnect', async () => {
  const plugin = await mockPlugin({ hang: true, control: true }), other = await mockPlugin(), { root, manager } = await controller(plugin.folder);
  try {
    await bindDesktop(root, manager.controllerId, plugin.grantFile); const bridge = new DesktopBridgeClient(root), abort = new AbortController();
    const first = bridge.call('acad_create_line', { instanceId: plugin.grant.instanceId, documentId: 'doc-1', documentEpoch: 1, operationId: 'first', expectedRevision: 0 }, abort.signal).catch(e => e);
    for (let i = 0; i < 100 && !plugin.calls(); i++) await tick(); assert.ok(plugin.calls());
    const second = bridge.call('acad_create_circle', { instanceId: plugin.grant.instanceId, documentId: 'doc-1', documentEpoch: 1, operationId: 'second', expectedRevision: 0 }).catch(e => e);
    await new Promise(ok => setTimeout(ok, 40)); await bindDesktop(root, manager.controllerId, other.grantFile); abort.abort();
    assert.equal((await first).code, 'TIMEOUT_UNKNOWN'); assert.equal((await second).code, 'SESSION_CHANGED'); assert.equal(other.mutations(), 0);
  } finally { await manager.close(); await plugin.close(); await other.close(); await cleanupFixture(plugin.folder); await cleanupFixture(other.folder); }
});
test('desktop controller lifecycle prevents duplicates, recovers an ended process and never reports a mock backend as AutoCAD', async () => {
  const plugin = await mockPlugin(), { root, manager } = await controller(plugin.folder);
  const other = new DesktopManager(root, join(plugin.folder, 'hosts'), plugin.folder, undefined, async pid => pid === process.pid ? 'test-process-start' : null);
  try {
    await assert.rejects(other.initialize(), /already running/);
    assert.deepEqual((await manager.snapshot()).hosts, []); assert.equal((await manager.snapshot()).connected, false);
    await assert.rejects(manager.connect('../outside'), /Invalid host/);
    const folder = join(plugin.folder, 'personal'); await mkdir(folder); await writeFile(join(folder, 'drawing.txt'), 'preserve');
    await assert.rejects(configureDesktopWorkspace(root, folder)); assert.equal(await readFile(join(folder, 'drawing.txt'), 'utf8'), 'preserve');
    await manager.close();
    await desktopWrite(join(root, 'controller.lock'), { version: 1, controllerId: randomUUID(), pid: 2147483647, processMarker: 'ended-process', lastSeenAt: Date.now() });
    await other.initialize(); assert.equal((await other.snapshot()).connected, false);
    await bindDesktop(root, other.controllerId, plugin.grantFile); const bridge = new DesktopBridgeClient(root);
    await other.close(); await assert.rejects(bridge.call('acad_get_status', { instanceId: plugin.grant.instanceId }), e => (e as any).code === 'IPC_UNAVAILABLE');
  } finally { await manager.close(); await other.close(); await plugin.close(); await cleanupFixture(plugin.folder); }
});

test('accumulated ended sessions cannot hide a new host or a live MCP client', async () => {
  const plugin = await mockPlugin();
  try {
    const hosts = join(plugin.folder, 'hosts'), clients = join(plugin.folder, 'clients'); await mkdir(hosts); await mkdir(clients);
    for (let i = 0; i < 150; i++) {
      const dir = join(hosts, 'inst-' + i.toString(16).padStart(32, '0')); await mkdir(dir);
      if (i < 70) { const file = join(dir, 'pairing.json'); await writeFile(file, '{}'); await utimes(file, 1, 1); }
      await desktopWrite(join(clients, i.toString(16).padStart(8, '0') + '-0000-4000-8000-000000000000.json'), { version: 1, id: i.toString(16).padStart(8, '0') + '-0000-4000-8000-000000000000', pid: 2147483647, lastSeenAt: 1 });
    }
    const newest = join(hosts, 'inst-' + 'f'.repeat(32)); await mkdir(newest); await writeFile(join(newest, 'pairing.json'), '{}');
    const discovered = await desktopHostFiles(hosts); assert.equal(discovered.length, 64); assert.equal(discovered[0], join(newest, 'pairing.json'));
    const id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'; await desktopWrite(join(clients, id + '.json'), { version: 1, id, pid: process.pid, lastSeenAt: Date.now() });
    assert.equal(await desktopClientCount(plugin.folder), 1);
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});
