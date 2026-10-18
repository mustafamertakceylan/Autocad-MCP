import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { BridgeClient } from '../src/bridge.js';
import { mockPlugin, cleanupFixture } from './fixture.js';

const pause = (ms: number) => new Promise(ok => setTimeout(ok, ms));
async function started(plugin: Awaited<ReturnType<typeof mockPlugin>>) {
  for (let i = 0; i < 100 && plugin.calls() === 0; i++) await pause(5);
  assert.equal(plugin.calls(), 1, 'First native call must have been sent');
}

test('bounded admission rejects excess calls; queued cancellation never reaches native backend', async () => {
  const plugin = await mockPlugin({ hang: true });
  try {
    const bridge = new BridgeClient(plugin.grantFile, 2000, 2);
    const active = new AbortController(), queued = new AbortController();
    const first = assert.rejects(bridge.call('acad_create_line', { instanceId: plugin.grant.instanceId }, active.signal), { code: 'TIMEOUT_UNKNOWN' });
    await started(plugin);
    const second = assert.rejects(bridge.call('acad_create_line', { instanceId: plugin.grant.instanceId }, queued.signal), { code: 'CANCELLED' });
    await pause(10);
    await assert.rejects(bridge.call('acad_get_status', { instanceId: plugin.grant.instanceId }), { code: 'DOC_BUSY' });
    queued.abort();
    await Promise.race([second, pause(300).then(() => { throw new Error('Queued cancellation waited for active native work'); })]);
    assert.equal(plugin.calls(), 1);
    active.abort(); await first;
    assert.equal(plugin.calls(), 1);
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});

test('queued calls recheck operation permissions after earlier work finishes', async () => {
  const plugin = await mockPlugin({ hang: true });
  try {
    const bridge = new BridgeClient(plugin.grantFile, 2000, 2), abort = new AbortController();
    const first = assert.rejects(bridge.call('acad_create_line', { instanceId: plugin.grant.instanceId }, abort.signal), { code: 'TIMEOUT_UNKNOWN' });
    await started(plugin);
    const second = assert.rejects(bridge.call('acad_get_status', { instanceId: plugin.grant.instanceId }), { code: 'SECURITY_DENIED' });
    await pause(10);
    await writeFile(plugin.grantFile, JSON.stringify({ ...plugin.grant, operations: [] }));
    abort.abort(); await Promise.all([first, second]);
    assert.equal(plugin.calls(), 1, 'Revoked queued work must not connect to native');
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});

test('queued calls never silently switch to a replacement pairing', async () => {
  const plugin = await mockPlugin({ hang: true });
  try {
    const bridge = new BridgeClient(plugin.grantFile, 2000, 2), abort = new AbortController();
    const first = assert.rejects(bridge.call('acad_create_line', { instanceId: plugin.grant.instanceId }, abort.signal), { code: 'TIMEOUT_UNKNOWN' });
    await started(plugin);
    const second = assert.rejects(bridge.call('acad_get_status', { instanceId: plugin.grant.instanceId }), { code: 'IPC_AUTH_FAILED' });
    await pause(10);
    await writeFile(plugin.grantFile, JSON.stringify({ ...plugin.grant, instanceId: 'replacement-session' }));
    abort.abort(); await Promise.all([first, second]);
    assert.equal(plugin.calls(), 1);
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
});
