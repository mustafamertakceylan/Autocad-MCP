// Explicit opt-in integration harness. Never runs under `npm test`.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { BridgeClient, readGrant } from '../src/bridge.js';
import type { ToolName } from '../src/tools.js';

if (process.platform !== 'win32' || process.env.AUTOCAD_MCP_LIVE_TEST !== '1') throw new Error('Explicit Windows live-test opt-in required');
const [autocadRoot, template, modulePath] = process.argv.slice(2);
if (!autocadRoot || !template || !modulePath) throw new Error('Arguments: <AutoCAD installation> <stock template> <compiled CRX>');
const root = resolve('tmp/live-runs', randomUUID()); await mkdir(root, { recursive: true });
const runtimeRoot = join(root, 'runtime'); await mkdir(runtimeRoot);
const profile = resolve('tmp/live-profile'); await mkdir(profile, { recursive: true });
const input = join(root, 'synthetic.dwg'); await copyFile(template, input);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const beforeHash = hash(await readFile(input));
const script = join(root, 'test.scr');
const slash = (value: string) => resolve(value).replaceAll('\\', '/');
const units = process.env.AUTOCAD_MCP_TEST_INSUNITS ?? '4';
const undoTest = process.env.AUTOCAD_MCP_TEST_UNDO === '1' && units !== '0';
if (!['0', '4', '6'].includes(units)) throw new Error('Test INSUNITS must be 0, 4 or 6');
await writeFile(script, `(setvar "TRUSTEDPATHS" "${slash(dirname(modulePath))}")\n(setvar "INSUNITS" ${units})\n(arxload "${slash(modulePath)}")\nMCPSTART\nMCPPUMP\n${undoTest ? '_.UNDO\n1\nMCPPUMP\n' : ''}MCPSTOP\n_.QUIT\n_N\n`);
const output = createWriteStream(join(root, 'autocad.log'));
const child = spawn(join(autocadRoot, 'accoreconsole.exe'), ['/i', input, '/s', script, '/isolate', 'AutocadMcpPhase2', profile, '/l', 'en-US'], {
  cwd: root, windowsHide: true, env: { ...process.env, MCP_RUNTIME_DIR: runtimeRoot, MCP_TEST_MODE: '1' }, stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout?.pipe(output, { end: false }); child.stderr?.pipe(output, { end: false });
let launchError: Error | undefined; child.on('error', error => { launchError = error; });
const client = new Client({ name: 'autocad-mcp-native-acceptance', version: '0.1.0' });
let bridge: BridgeClient | undefined; let instanceId = ''; let grantFile = '';
const checks: Array<{ name: string; passed: boolean }> = [];
const check = (name: string, condition: unknown) => { assert.ok(condition, name); checks.push({ name, passed: true }); console.log('PASS ' + name); };
const sleep = (ms: number) => new Promise(ok => setTimeout(ok, ms));
try {
  const deadline = Date.now() + 45000;
  while (!grantFile && Date.now() < deadline) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error('AutoCAD exited before plugin startup; inspect isolated log');
    for (const folder of await readdir(runtimeRoot)) { const file = join(runtimeRoot, folder, 'pairing.json'); try { await readGrant(file); grantFile = file; } catch {} }
    if (!grantFile) await sleep(100);
  }
  if (!grantFile) throw new Error('Native plugin startup timed out; inspect isolated log');
  const grant = await readGrant(grantFile); instanceId = grant.instanceId; bridge = new BridgeClient(grantFile);
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/src/main.js'), '--grant-file', grantFile], stderr: 'pipe' });
  await client.connect(transport);
  const call = async (name: ToolName, args: Record<string, unknown>) => {
    const reply = await client.callTool({ name, arguments: args });
    const data = reply.structuredContent as Record<string, any>;
    if (reply.isError) throw new Error(`${name}: ${data?.error?.code ?? 'unknown'}`);
    return data;
  };
  const status = await call('acad_get_status', { instanceId });
  check('real ObjectARX backend (not mock)', status.backend === 'objectarx' && status.simulation === false);
  check('14 MCP tools available', (await client.listTools()).tools.length === 14);
  check('paired instance listed without implicit target', (await call('acad_list_instances', {})).instances[0].instanceId === instanceId);
  const capabilities = await call('acad_get_capabilities', { instanceId });
  check('native capability limits reported', capabilities.operations.length === 14 && capabilities.limits.maxTargets === 100 && capabilities.outputRoots[0].id === 'test-output');
  const docs = await call('acad_list_documents', { instanceId });
  check('one isolated drawing open', docs.documents.length === 1);
  const doc = docs.documents[0]; const target = { instanceId, documentId: doc.documentId, documentEpoch: doc.documentEpoch };
  const info = () => call('acad_get_document_info', target);
  const missing = await client.callTool({ name: 'acad_get_document_info', arguments: { ...target, documentId: 'does-not-exist' } });
  check('missing drawing rejected', (missing.structuredContent as any).error.code === 'DOC_NOT_FOUND');
  const mutation = async (operationId: string) => ({ ...target, operationId, expectedRevision: (await info()).revision, coordinateSystem: 'WCS', lengthUnit: 'mm' });
  const lineArgs = { ...await mutation('line-1'), start: [0, 0, 0], end: [100, 0, 0] };
  if (units === '0') {
    const unknown = await client.callTool({ name: 'acad_create_line', arguments: lineArgs });
    check('unitless drawing rejects physical unit mutation', (unknown.structuredContent as any).error.code === 'UNITS_UNKNOWN');
    const explicit = await call('acad_create_line', { ...lineArgs, operationId: 'unitless-explicit', lengthUnit: 'drawing_unit' });
    check('explicit drawing_unit accepted', explicit.verified && explicit.observedGeometry.items[0].length === 100);
    check('unitless INSUNITS preserved', (await info()).insunits === 0);
    await writeFile(join(root, 'results.json'), JSON.stringify({ platform: 'windows-x64', host: 'AutoCAD 2027 Core Console', drawingUnits: units, checks, mac: 'not-run' }, null, 2));
    console.log('Evidence: ' + root);
    process.exitCode = 0;
  } else {
  const line = await call('acad_create_line', lineArgs);
  check('100 mm line verified', line.verified === true && Math.abs(line.observedGeometry.items[0].length - 100) < 1e-6);
  check('same operation returns cached result', JSON.stringify(await call('acad_create_line', lineArgs)) === JSON.stringify(line));
  check('operation status reconciles cached result', JSON.stringify(await call('acad_get_operation_status', { ...target, operationId: 'line-1' })) === JSON.stringify(line));
  const unknownOperation = await client.callTool({ name: 'acad_get_operation_status', arguments: { ...target, operationId: 'never-submitted' } });
  check('missing operation effect remains unknown', (unknownOperation.structuredContent as any).status === 'unknown' && (unknownOperation.structuredContent as any).applied === null);
  const conflict = await client.callTool({ name: 'acad_create_line', arguments: { ...lineArgs, end: [200, 0, 0] } });
  check('different payload rejected for same ID', (conflict.structuredContent as any).error.code === 'IDEMPOTENCY_CONFLICT');
  const circle = await call('acad_create_circle', { ...await mutation('circle-1'), center: [0, 100, 0], radius: 25 });
  check('25 mm circle radius verified', circle.verified && Math.abs(circle.observedGeometry.items[0].radius - 25) < 1e-6);
  const box = await call('acad_create_box', { ...await mutation('box-1'), center: [200, 0, 0], size: [100, 50, 20] });
  const solid = box.observedGeometry.items[0];
  check('100000 mm^3 box verified', box.verified && Math.abs(solid.volume - 100000) < 0.001);
  const closePoint = (actual: number[], expected: number[]) => actual.length === 3 && expected.every((value, i) => Math.abs(actual[i]! - value) <= 1e-6);
  check('box extents and center', closePoint(solid.extents.min, [150, -25, -10]) && closePoint(solid.extents.max, [250, 25, 10]) && closePoint(solid.center, [200, 0, 0]));
  const moved = await call('acad_move_entities', { ...await mutation('move-1'), targets: line.created, delta: [10, 0, 0] });
  check('line translated 10 mm', moved.verified && closePoint(moved.observedGeometry.items[0].start, [10, 0, 0]) && closePoint(moved.observedGeometry.items[0].end, [110, 0, 0]));
  const metres = await call('acad_get_entity', { ...target, entityRef: line.created[0], coordinateSystem: 'WCS', lengthUnit: 'm', projection: ['start', 'end'] });
  check('millimetres converted to metres', Math.abs(metres.entity.end[0] - .11) < 1e-12);
  if (undoTest) {
    const previousRevision = (await info()).revision;
    await bridge.call('bridge.test_done' as ToolName, { instanceId });
    const restored = await call('acad_get_entity', { ...target, entityRef: line.created[0], coordinateSystem: 'WCS', lengthUnit: 'mm', projection: ['start', 'end'] });
    check('one UNDO restores only the move', closePoint(restored.entity.start, [0, 0, 0]) && closePoint(restored.entity.end, [100, 0, 0]));
    check('UNDO advances revision', (await info()).revision > previousRevision);
    const stale = await client.callTool({ name: 'acad_create_line', arguments: { ...lineArgs, operationId: 'stale-after-undo', expectedRevision: previousRevision } });
    check('pre-UNDO revision cannot write', (stale.structuredContent as any).error.code === 'STALE_REVISION');
    const remaining = await call('acad_query_entities', { ...target, coordinateSystem: 'WCS', filter: {}, limit: 100 });
    check('UNDO preserves circle and box', remaining.items.length === 3);
    await call('acad_move_entities', { ...await mutation('move-after-undo'), targets: line.created, delta: [10, 0, 0] });
  }
  const query = await call('acad_query_entities', { ...target, coordinateSystem: 'WCS', filter: {}, limit: 100 });
  check('three native entities found', query.items.length === 3);
  const firstPage = await call('acad_query_entities', { ...target, coordinateSystem: 'WCS', filter: {}, limit: 1 });
  const nextPage = await call('acad_query_entities', { ...target, coordinateSystem: 'WCS', filter: {}, limit: 1, cursor: firstPage.cursor });
  check('native query pagination advances', firstPage.cursor && nextPage.items.length === 1 && firstPage.items[0].handle !== nextPage.items[0].handle);
  const invalidNative = await bridge.call('acad_create_box', { ...await mutation('invalid-native'), center: [0, 0, 0], size: [-1, 1, 1] });
  check('native backend rejects invalid geometry independently', (invalidNative.error as any).code === 'VALIDATION_FAILED');
  const before = await info();
  const saved = await call('acad_save_copy', { ...target, operationId: 'save-1', expectedRevision: before.revision, outputRootId: 'test-output', relativePath: 'copy.dwg', overwrite: false });
  check('separate DWG geometry verified by native reopen', saved.verified && saved.output.relativePath === 'copy.dwg' && saved.verification.supportedGeometryCount === 3);
  const after = await info();
  check('source dirty state preserved', before.dirty === after.dirty);
  check('source file bytes preserved', hash(await readFile(input)) === beforeHash);
  const existing = await client.callTool({ name: 'acad_save_copy', arguments: { ...target, operationId: 'save-2', expectedRevision: after.revision, outputRootId: 'test-output', relativePath: 'copy.dwg', overwrite: false } });
  check('existing DWG never overwritten', (existing.structuredContent as any).error.code === 'FILE_EXISTS');
  const badEpoch = await client.callTool({ name: 'acad_get_document_info', arguments: { ...target, documentEpoch: target.documentEpoch + 1 } });
  check('stale document rejected', (badEpoch.structuredContent as any).error.code === 'STALE_DOCUMENT');
  const erased = await call('acad_erase_entities', { ...target, operationId: 'erase-1', expectedRevision: (await info()).revision, targets: circle.created });
  check('circle erase verified', erased.verified === true);
  const stalePage = await client.callTool({ name: 'acad_query_entities', arguments: { ...target, coordinateSystem: 'WCS', filter: {}, limit: 1, cursor: firstPage.cursor } });
  check('edit invalidates earlier query cursor', (stalePage.structuredContent as any).error.code === 'STALE_CURSOR');
  await writeFile(join(root, 'results.json'), JSON.stringify({ platform: 'windows-x64', host: 'AutoCAD 2027 Core Console', drawingUnits: units, checks, measurements: { line: line.observedGeometry, circle: circle.observedGeometry, box: box.observedGeometry, movedLine: moved.observedGeometry }, originalPreserved: true, mac: 'not-run' }, null, 2));
  console.log('Evidence: ' + root);
  }
} catch (error) {
  await writeFile(join(root, 'results.json'), JSON.stringify({ checks, error: error instanceof Error ? error.message : 'Failed', mac: 'not-run' }, null, 2));
  console.error('Evidence: ' + root); throw error;
} finally {
  await client.close().catch(() => {});
  if (bridge && instanceId) await bridge.call('bridge.test_done' as ToolName, { instanceId }).catch(() => {});
  for (let i = 0; i < 50 && child.exitCode === null; i++) await sleep(100);
  if (child.exitCode === null) child.kill();
  output.end();
}
