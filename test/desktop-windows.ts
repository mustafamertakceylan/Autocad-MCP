// Explicit desktop acceptance. Never included by node --test *.test.js.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { watch } from 'node:fs';
import { readFile, readdir, mkdir, writeFile, rename, symlink, lstat, rmdir } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { BridgeClient, readGrant } from '../src/bridge.js';
import type { ToolName } from '../src/tools.js';

if (process.platform !== 'win32' || process.env.AUTOCAD_MCP_DESKTOP_TEST !== '1') throw new Error('Explicit Windows desktop opt-in required');
const [configuration] = process.argv.slice(2);
if (!configuration) throw new Error('Pass --new or an owned configuration from start-desktop.ps1');
const launched = configuration === '--new' ? JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-File', resolve('test/start-desktop.ps1'), '-TestRoot', resolve('tmp/desktop-runs', randomUUID()), '-AutoCADRoot', 'C:\\Program Files\\Autodesk\\AutoCAD 2027', '-Template', join(process.env.LOCALAPPDATA!, 'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt'), '-Plugin', resolve('build/desktop-tests/Release/AutocadMcp.arx')], { encoding: 'utf8', windowsHide: true })) : undefined;
const config = (launched ?? JSON.parse(await readFile(configuration, 'utf8'))) as { root: string; pid: number; profileName: string };
if (launched) await writeFile('tmp/desktop-current.json', JSON.stringify(config));
const root = resolve(config.root);
assert.equal(dirname(root), resolve('tmp/desktop-runs'));
assert.match(basename(root), /^[a-f0-9-]{36}$/);
assert.match(config.profileName, /^AutocadMcpDesktop-[a-f0-9]{32}$/);
let folders: string[] = [];
for (let i = 0; i < 600; i++) {
  folders = await readdir(join(root, 'runtime'));
  if (folders.length && await readGrant(join(root, 'runtime', folders[0]!, 'pairing.json')).then(() => true).catch(() => false)) break;
  await new Promise(ok => setTimeout(ok, 100));
}
assert.equal(folders.length, 1, 'Fresh owned test session required');
const grantFile = join(root, 'runtime', folders[0]!, 'pairing.json');
const grant = await readGrant(grantFile);
const direct = new BridgeClient(grantFile);
const client = new Client({ name: 'windows-desktop-acceptance', version: '0.1.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/src/main.js'), '--grant-file', grantFile], stderr: 'pipe' });
const checks: Array<{ name: string; passed: true }> = [];
const check = (name: string, condition: unknown) => { assert.ok(condition, name); checks.push({ name, passed: true }); console.log('PASS ' + name); };
const sleep = (ms: number) => new Promise(ok => setTimeout(ok, ms));
const hash = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex');
const primaryFile = join(root, 'primary.dwg'), secondaryFile = join(root, 'secondary.dwg');
const hashes = [await hash(primaryFile), await hash(secondaryFile)];
const control = async (action: string) => {
  const result = await direct.call('bridge.test_action' as ToolName, { instanceId: grant.instanceId, action });
  if (result.error) throw new Error('Test control: ' + JSON.stringify(result.error));
  return result as Record<string, any>;
};
const raw = async (name: ToolName, args: Record<string, unknown>) => {
  const reply = await client.callTool({ name, arguments: args });
  return reply.structuredContent as Record<string, any>;
};
const call = async (name: ToolName, args: Record<string, unknown>) => {
  const data = await raw(name, args);
  if (data.error) throw new Error(name + ': ' + data.error.code);
  return data;
};
const waitIdle = async () => {
  for (let i = 0; i < 50; i++) { const state = await control('context'); if (!state.commandActive && state.primaryQuiescent) return state; await sleep(100); }
  throw new Error('Owned desktop drawing did not become idle');
};
let failure: string | undefined;
try {
  await client.connect(transport);
  check('desktop backend is real ObjectARX', (await call('acad_get_status', { instanceId: grant.instanceId })).simulation === false);
  check('desktop idle dispatcher works without MCPPUMP', (await waitIdle()).commandActive === 0);
  const docs = (await call('acad_list_documents', { instanceId: grant.instanceId })).documents;
  check('fresh desktop has exactly one synthetic drawing', docs.length === 1);
  const a = { instanceId: grant.instanceId, documentId: docs[0].documentId, documentEpoch: docs[0].documentEpoch };
  const info = () => call('acad_get_document_info', a);
  const mutation = async (operationId: string) => ({ ...a, expectedRevision: (await info()).revision, operationId, coordinateSystem: 'WCS', lengthUnit: 'mm' });
  const query = (target = a) => call('acad_query_entities', { ...target, coordinateSystem: 'WCS', filter: {}, limit: 100 });
  const line = await call('acad_create_line', { ...await mutation('desktop-line'), start: [0, 0, 0], end: [100, 0, 0] });
  check('desktop line created and measured', line.verified && line.observedGeometry.items[0].length === 100);
  const secondary = await control('open_secondary');
  const b = { instanceId: grant.instanceId, documentId: secondary.documentId, documentEpoch: secondary.documentEpoch };
  await control('activate_secondary');
  check('secondary drawing is the visible active tab', (await control('context')).active.documentId === b.documentId);
  const circle = await call('acad_create_circle', { ...await mutation('inactive-primary-circle'), center: [0, 100, 0], radius: 25 });
  check('explicit inactive primary receives the circle', circle.verified && circle.documentId === a.documentId && (await query()).items.length === 2);
  check('visible secondary remains empty', (await query(b)).items.length === 0);
  check('target operation restores prior current context and active tab', (await control('context')).current.documentId === b.documentId && (await control('context')).active.documentId === b.documentId);
  check('tab change preserves primary document epoch', (await info()).documentEpoch === a.documentEpoch);
  const stale = await raw('acad_get_document_info', { ...a, documentEpoch: a.documentEpoch + 1 });
  check('wrong epoch is rejected while another tab is active', stale.error.code === 'STALE_DOCUMENT');
  await control('activate_primary');
  const moved = await call('acad_move_entities', { ...await mutation('desktop-move'), targets: line.created, delta: [10, 0, 0] });
  check('desktop move verified', moved.verified && moved.observedGeometry.items[0].start[0] === 10);
  await control('undo_primary');
  let restored: Record<string, any> = {};
  for (let i = 0; i < 50; i++) {
    restored = await raw('acad_get_entity', { ...a, entityRef: line.created[0], coordinateSystem: 'WCS', lengthUnit: 'mm', projection: ['start', 'end'] });
    if (restored.entity?.start[0] === 0 && restored.entity?.end[0] === 100 && restored.revision > moved.revision) break;
    await sleep(100);
  }
  check('desktop UNDO restores only the move', restored.entity.start[0] === 0 && restored.entity.end[0] === 100 && (await query()).items.length === 2);
  const busyArgs = { ...await mutation('busy-line'), start: [0, 0, 0], end: [50, 0, 0] };
  await control('begin_line');
  let busy: Record<string, any> = {};
  for (let i = 0; i < 30; i++) { busy = await control('context'); if (busy.commandActive > 0) break; await sleep(100); }
  check('real LINE command is waiting for user input', busy.commandActive > 0 && busy.primaryQuiescent === false);
  const denied = await raw('acad_create_line', busyArgs);
  check('busy drawing mutation is rejected before application', denied.error.code === 'DOC_BUSY' && denied.applied === false);
  check('MCP call does not cancel the waiting LINE command', (await control('context')).commandActive > 0);
  await control('cancel_line'); await sleep(100); await waitIdle();
  check('explicit test cleanup cancels only its own LINE', (await query()).items.length === 2);
  await control('lock_layer');
  const locked = await raw('acad_create_line', { ...await mutation('locked-layer'), layer: 'MCP_LOCKED', start: [0, 0, 0], end: [5, 0, 0] });
  check('locked layer rejects mutation with no geometry change', locked.error.code === 'SECURITY_DENIED' && locked.applied === false && (await query()).items.length === 2);
  await control('unlock_layer');
  await control('close_secondary');
  const oldDocument = await raw('acad_get_document_info', b);
  check('closed document identity is rejected', oldDocument.error.code === 'DOC_NOT_FOUND');
  const reopened = await control('open_secondary');
  check('reopened file gets a new identity and epoch', reopened.documentId !== b.documentId && reopened.documentEpoch !== b.documentEpoch);
  await control('activate_primary');
  const saveArgs = async (name: string) => ({ ...a, operationId: randomUUID(), expectedRevision: (await info()).revision, outputRootId: 'test-output', relativePath: name, overwrite: false });
  const invalidPath = await direct.call('acad_save_copy', await saveArgs('../escape.dwg'));
  check('native save rejects parent traversal', (invalidPath.error as any).code === 'OUTPUT_PATH_DENIED');
  const output = join(dirname(grantFile), 'output'); const backup = join(dirname(grantFile), 'output-owned-backup');
  const outside = join(root, 'outside-output'); await mkdir(outside);
  await rename(output, backup);
  try {
    await symlink(outside, output, 'junction');
    const escaped = await raw('acad_save_copy', await saveArgs('junction.dwg'));
    check('junction output root is rejected', escaped.error.code === 'OUTPUT_PATH_DENIED');
    check('junction target receives no DWG', (await readdir(outside)).length === 0);
  } finally {
    if ((await lstat(output).catch(() => undefined))?.isSymbolicLink()) await rmdir(output);
    await rename(backup, output);
  }
  const marker = 'synthetic-race-sentinel'; const raceFile = join(output, 'race.dwg');
  let raceWrite: Promise<void> | undefined; let raceError: unknown;
  const watcher = watch(output, (_event, file) => { if (String(file).startsWith('staging-') && !raceWrite) raceWrite = writeFile(raceFile, marker, { flag: 'wx' }).catch(error => { raceError = error; }); });
  let race: Record<string, any>;
  try { race = await raw('acad_save_copy', await saveArgs('race.dwg')); await raceWrite; }
  finally { watcher.close(); }
  check('target created during snapshot is not overwritten', raceWrite && !raceError && race!.error?.code === 'FILE_EXISTS' && await readFile(raceFile, 'utf8') === marker);
  const beforeSave = await info();
  const saved = await call('acad_save_copy', await saveArgs('desktop-copy.dwg'));
  check('desktop DWG copy reopens with matching geometry', saved.verified && saved.verification.supportedGeometryCount === 2);
  check('desktop snapshot preserves dirty state', (await info()).dirty === beforeSave.dirty);
  check('both source DWG hashes are preserved', await hash(primaryFile) === hashes[0] && await hash(secondaryFile) === hashes[1]);
  await control('close_secondary');
} catch (error) {
  failure = error instanceof Error ? error.message : 'Desktop acceptance failed';
  console.error(failure); process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
  // Only the process created by our setup configuration is eligible for cleanup.
  if (process.env.AUTOCAD_MCP_DESKTOP_CLOSE === '1') {
    await control('activate_primary').catch(() => {});
    await control('cancel_line').catch(() => {});
    await sleep(100);
    await control('quit').catch(() => {});
  }
  await writeFile(join(root, 'desktop-results.json'), JSON.stringify({ host: 'AutoCAD 2027 desktop', simulation: false, usesTestPump: false, checks, ...(failure ? { error: failure } : {}) }, null, 2));
  console.log('Evidence: ' + root);
}
