// Local package acceptance, not a clean-machine claim. Uses no model provider.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, copyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { inventory, packageIdentity, readPackage, sha256 } from '../src/distribution.js';
import { readGrant } from '../src/bridge.js';
import { toolNames, type ToolName } from '../src/tools.js';
import { windowsSession } from './windows-session.js';

if (process.platform !== 'win32' || process.env.AUTOCAD_MCP_INSTALL_TEST !== '1' || !process.env.AUTOCAD_MCP_PACKAGE_ROOT) throw Error('Explicit Windows installation test and package root required');
let source = resolve(process.env.AUTOCAD_MCP_PACKAGE_ROOT);
const manifest = await readPackage(source);
const id = randomUUID(), root = resolve('tmp/installation-runs', id), plugins = join(root, 'sandbox boş klasör/ApplicationPlugins');
await mkdir(root, { recursive: true });
const packagedServer = (base: string) => join(base, 'Contents/server');
let pristineServer = packagedServer(source), candidateNode = join(pristineServer, 'runtime/node.exe');
const env: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
env.PATH = join(process.env.SystemRoot!, 'System32'); env.NODE_PATH = ''; env.NODE_OPTIONS = '';
const run = promisify(execFile), checks: { name: string; passed: true }[] = [];
const check = (name: string, condition: unknown) => { assert.ok(condition, name); checks.push({ name, passed: true }); console.log('PASS ' + name); };
const setup = async (mode: string, ...args: string[]) => {
  const result = await run(candidateNode, [join(pristineServer, 'dist/src/setup.js'), mode, '--plugins-root', plugins, ...args], { cwd: root, env, windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 });
  return JSON.parse(result.stdout);
};
let session: Awaited<ReturnType<typeof windowsSession>> | undefined, reopened: typeof session;
let client: Client | undefined;
try {
  const archive = dirname(source) + '.zip';
  const sidecar = (await readFile(archive + '.sha256', 'utf8')).split(' ')[0];
  check('ZIP checksum matches sidecar', sha256(await readFile(archive)) === sidecar);
  const extracted = join(root, 'extracted ZIP');
  const quoted = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  await run(join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory(${quoted(archive)}, ${quoted(extracted)})`], { cwd: root, env, windowsHide: true, timeout: 60000 });
  source = join(extracted, 'AutocadMcp.bundle'); pristineServer = packagedServer(source); candidateNode = join(pristineServer, 'runtime/node.exe');
  check('extracted ZIP has exact original bundle identity', (await readPackage(source)).packageId === manifest.packageId);
  check('production-only package omits compiler, npm SDK client and build tree', !(await lstat(join(pristineServer, 'node_modules/typescript')).catch(() => undefined)) && !(await lstat(join(pristineServer, 'node_modules/@modelcontextprotocol/client')).catch(() => undefined)));
  const first = await setup('install', '--source', source); check('real setup CLI installs verified private bundle in isolated custom path', first.changed && first.packageId === manifest.packageId);
  check('same package install is idempotent', (await setup('install', '--source', source)).changed === false);
  const installedBundle = join(plugins, 'AutocadMcp.bundle'), server = packagedServer(installedBundle), node = join(server, 'runtime/node.exe');
  check('installed doctor verifies package and reports private unsigned status', (await setup('doctor')).packageId === manifest.packageId);
  // A second synthetic package exercises replacement without inventing a published software version.
  const secondSource = join(root, 'second-package'); await cp(source, secondSource, { recursive: true, force: false, errorOnExist: true });
  await writeFile(join(secondSource, 'README.txt'), 'Synthetic upgrade package for local acceptance only.\n');
  const { packageId: ignored, ...content } = manifest; content.files = await inventory(secondSource);
  await writeFile(join(secondSource, 'package-manifest.json'), JSON.stringify({ ...content, packageId: packageIdentity(content) }, null, 2));
  check('second synthetic package upgrades without overwriting old version', (await setup('install', '--source', secondSource)).changed === true);
  const afterUpgrade = await setup('doctor'); check('old package retained as verified rollback archive', afterUpgrade.archives.length === 1);
  await setup('rollback', '--archive', afterUpgrade.archives[0].directory);
  check('real CLI rollback restores exact original package identity', (await setup('doctor')).packageId === manifest.packageId);
  const cadRoot = resolve('tmp/phase5-runs', id), stock = join(process.env.LOCALAPPDATA!, 'Autodesk/AutoCAD 2027/R26.0/enu/Template/acadiso.dwt');
  await mkdir(cadRoot, { recursive: true }); const drawing = join(cadRoot, 'source.dwg'); await copyFile(stock, drawing); const drawingHash = sha256(await readFile(drawing));
  process.env.AUTOCAD_MCP_PHASE5_TEST = '1';
  session = await windowsSession(join(cadRoot, 'draw'), drawing, { units: 4, module: join(installedBundle, 'Contents/Win64/AutocadMcp.arx'), defaultRuntime: true });
  const grant = await readGrant(session.grantFile);
  check('packaged native plugin starts using LOCALAPPDATA fallback without runtime environment override', session.grantFile.includes('local-appdata') && grant.nativeBuildId === manifest.nativeBuildId);
  try { await setup('install', '--source', source); throw Error('Setup unexpectedly allowed running AutoCAD'); }
  catch (error) { check('setup refuses replacement while an actual Core Console is running', (error as any).code === 2 && String((error as any).stderr).includes('Close AutoCAD')); }
  const workspace = join(root, 'clients'), pilot = join(server, 'dist/src/pilot.js');
  await run(node, [pilot, 'configure', '--workspace', workspace, '--grant-file', session.grantFile], { cwd: root, env, windowsHide: true, timeout: 20000 });
  const config = JSON.parse(await readFile(join(workspace, 'claude/.mcp.json'), 'utf8'));
  check('generated MCP configuration uses installed bundled node and installed server', config.mcpServers.autocad.command === node && config.mcpServers.autocad.args[0] === pilot);
  for (const path of ['codex/.agents/skills/autocad-mcp/SKILL.md', 'claude/.claude/skills/autocad-mcp/SKILL.md', 'opencode/.opencode/skills/autocad-mcp/SKILL.md']) {
    check(path + ' matches packaged canonical skill', sha256(await readFile(join(workspace, path))) === sha256(await readFile(join(server, 'skills/autocad-mcp/SKILL.md'))));
  }
  const diagnostics = await run(node, [pilot, 'doctor', '--session-file', join(workspace, 'autocad-session.json')], { cwd: root, env, windowsHide: true, timeout: 20000 });
  const health = JSON.parse(diagnostics.stdout); check('installed doctor reaches actual AutoCAD with all 52 tools', health.connected && health.backend === 'objectarx' && health.simulation === false && health.toolCount === 52);
  client = new Client({ name: 'installed-package-acceptance', version: '0.1.0' });
  await client.connect(new StdioClientTransport({ command: config.mcpServers.autocad.command, args: config.mcpServers.autocad.args, cwd: root, env, stderr: 'pipe' }));
  check('bundled Node serves official MCP stdio outside repository cwd with restricted PATH', (await client.listTools()).tools.length === toolNames.length);
  check('installed server advertises three existing skill resources', (await client.listResources()).resources.length === 3);
  const resource = await client.readResource({ uri: 'skill://autocad-mcp/autocad-mcp/references/mechanical.md' });
  check('installed skill resource resolves relative to installed server', 'text' in resource.contents[0]! && resource.contents[0].text.length > 100);
  const call = async (name: ToolName, args: Record<string, unknown>) => {
    const reply = await client!.callTool({ name, arguments: args }); if (reply.isError) throw Error(name + ' failed'); return reply.structuredContent as Record<string, any>;
  };
  const target = session.target, info = await call('acad_get_document_info', target);
  const circle = await call('acad_create_circle', { ...target, operationId: randomUUID(), expectedRevision: info.revision, coordinateSystem: 'WCS', lengthUnit: 'mm', center: [10, 20, 0], radius: 5 });
  check('installed MCP and packaged ARX create verified native circle', circle.status === 'succeeded' && circle.applied === true && circle.verified === true);
  const queryArgs = { coordinateSystem: 'WCS', lengthUnit: 'mm', filter: {}, projection: ['handle', 'type', 'center', 'radius'], limit: 100 };
  const measured = await call('acad_query_entities', { ...target, ...queryArgs });
  check('independent query measures exact mm geometry', measured.items.length === 1 && measured.items[0].radius === 5 && JSON.stringify(measured.items[0].center) === '[10,20,0]');
  const revision = (await call('acad_get_document_info', target)).revision;
  const saved = await call('acad_save_copy', { ...target, operationId: randomUUID(), expectedRevision: revision, outputRootId: 'test-output', relativePath: 'installed-circle.dwg', overwrite: false });
  check('installed server saves separately with native verification', saved.status === 'succeeded' && saved.verified === true);
  const exported = join(root, 'installed-circle.dwg'); await copyFile(join(session.output, 'installed-circle.dwg'), exported); const exportedHash = sha256(await readFile(exported));
  await client.close(); client = undefined; await session.close(); session = undefined;
  reopened = await windowsSession(join(cadRoot, 'reopen'), exported, { module: join(installedBundle, 'Contents/Win64/AutocadMcp.arx') });
  const reopenedGeometry = await reopened.call('acad_query_entities', { ...reopened.target, ...queryArgs });
  check('fresh actual AutoCAD reopens packaged output with exact radius and center', reopenedGeometry.items.length === 1 && reopenedGeometry.items[0].radius === 5 && JSON.stringify(reopenedGeometry.items[0].center) === '[10,20,0]');
  await reopened.close(); reopened = undefined;
  check('original synthetic source and exported DWG bytes preserved', sha256(await readFile(drawing)) === drawingHash && sha256(await readFile(exported)) === exportedHash);
  await writeFile(join(workspace, 'user-note.txt'), 'retain after uninstall');
  check('real CLI uninstall archives active bundle', (await setup('uninstall')).retainedUserData === true);
  check('uninstall retains user workspace and drawing output', await readFile(join(workspace, 'user-note.txt'), 'utf8') === 'retain after uninstall' && sha256(await readFile(exported)) === exportedHash);
  check('active autoload bundle removed without deleting previous versions', !(await lstat(installedBundle).catch(() => undefined)) && (await readPackage(join(plugins, '.AutocadMcp', afterUpgrade.archives[0].directory))).packageId === manifest.packageId);
  check('source distribution remains byte-for-byte manifest valid', (await readPackage(source)).packageId === manifest.packageId);
  await writeFile(join(root, 'results.json'), JSON.stringify({ passed: true, checks, packageId: manifest.packageId, nativeBuildId: manifest.nativeBuildId, modelCalls: 0, cleanMachine: false, automaticBundleLoadingTested: false, syntheticUpgradeSameBinaries: true }, null, 2));
  console.log('Evidence: ' + root);
} catch (error) {
  await writeFile(join(root, 'results.json'), JSON.stringify({ passed: false, checks, error: error instanceof Error ? error.message : 'Failure' }, null, 2));
  console.error('Failed installation evidence: ' + root); throw error;
} finally { await client?.close(); await session?.terminate(); await reopened?.terminate(); }
