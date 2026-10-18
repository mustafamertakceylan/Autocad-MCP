import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, chmod } from 'node:fs/promises';
import { BridgeClient } from '../src/bridge.js';
import { validateTool } from '../src/tools.js';
import { mockPlugin, cleanupFixture } from './fixture.js';

test('real local IPC authenticates request/reply; dedup avoids duplicate mutation', async () => {
  const plugin = await mockPlugin();
  try {
    const client = new BridgeClient(plugin.grantFile);
    const status = await client.call('acad_get_status', { instanceId: plugin.grant.instanceId });
    assert.equal(status.simulation, true);
    const input = validateTool('acad_create_line', { instanceId: plugin.grant.instanceId, documentId: 'doc-1', documentEpoch: 1, expectedRevision: 0, operationId: 'op-1', coordinateSystem: 'WCS', lengthUnit: 'mm', start: [0, 0, 0], end: [100, 0, 0] });
    const results = await Promise.all([client.call('acad_create_line', input), client.call('acad_create_line', input)]);
    assert.equal(plugin.mutations(), 1); assert.deepEqual(results[0], results[1]);
    const conflict = await client.call('acad_create_line', { ...input, end: [200, 0, 0] });
    assert.equal((conflict.error as { code: string }).code, 'IDEMPOTENCY_CONFLICT');
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});

test('unauthorized, expired, wrong-instance and invalid-MAC calls do not report success', async () => {
  const plugin = await mockPlugin({ wrongSignature: true });
  try {
    const client = new BridgeClient(plugin.grantFile);
    await assert.rejects(client.call('acad_get_status', { instanceId: 'wrong' }), { code: 'INSTANCE_NOT_FOUND' });
    assert.equal(plugin.calls(), 0);
    await assert.rejects(client.call('acad_get_status', { instanceId: plugin.grant.instanceId }), { code: 'IPC_AUTH_FAILED' });
    await writeFile(plugin.grantFile, JSON.stringify({ ...plugin.grant, operations: [] }));
    await assert.rejects(client.call('acad_get_status', { instanceId: plugin.grant.instanceId }), { code: 'SECURITY_DENIED' });
    await writeFile(plugin.grantFile, JSON.stringify({ ...plugin.grant, expiresAt: 1 }));
    await assert.rejects(client.call('acad_get_status', { instanceId: plugin.grant.instanceId }), { code: 'IPC_AUTH_FAILED' });
    if (process.platform !== 'win32') {
      await writeFile(plugin.grantFile, JSON.stringify(plugin.grant)); await chmod(plugin.grantFile, 0o644);
      await assert.rejects(client.call('acad_get_status', { instanceId: plugin.grant.instanceId }), { code: 'IPC_AUTH_FAILED' });
    }
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});

test('timeout after sending a mutation is unknown; never automatically retries', async () => {
  const plugin = await mockPlugin({ hang: true });
  try {
    await assert.rejects(new BridgeClient(plugin.grantFile, 100).call('acad_create_line', { instanceId: plugin.grant.instanceId }), { code: 'TIMEOUT_UNKNOWN' });
    assert.equal(plugin.calls(), 1);
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});

test('without pairing the server can enumerate safely but cannot connect or mutate', async () => {
  const client = new BridgeClient();
  assert.deepEqual(await client.call('acad_list_instances', {}), { instances: [] });
  await assert.rejects(client.call('acad_get_status', { instanceId: 'none' }), { code: 'IPC_UNAVAILABLE' });
});

test('cancellation before send has no effect; after send preserves unknown mutation outcome', async () => {
  const plugin = await mockPlugin({ hang: true });
  try {
    const client = new BridgeClient(plugin.grantFile, 1000);
    const before = new AbortController(); before.abort();
    await assert.rejects(client.call('acad_create_line', { instanceId: plugin.grant.instanceId }, before.signal), { code: 'CANCELLED' });
    assert.equal(plugin.calls(), 0);
    const after = new AbortController();
    const pending = client.call('acad_create_line', { instanceId: plugin.grant.instanceId }, after.signal);
    const timer = setTimeout(() => after.abort(), 100);
    try { await assert.rejects(pending, { code: 'TIMEOUT_UNKNOWN' }); }
    finally { clearTimeout(timer); }
    assert.equal(plugin.calls(), 1);
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});


test('incompatible handshake is rejected before any mutation submission', async () => {
  const plugin = await mockPlugin({ wrongVersion: true });
  try {
    await assert.rejects(new BridgeClient(plugin.grantFile).call('acad_create_line', { instanceId: plugin.grant.instanceId }), { code: 'IPC_AUTH_FAILED' });
    assert.equal(plugin.calls(), 0);
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});
