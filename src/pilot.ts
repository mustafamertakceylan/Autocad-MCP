#!/usr/bin/env node
// Explicit operator entrypoint; no automatic process launch or pairing discovery.
import { lstat, readFile, mkdir, readdir, writeFile, cp, rename, unlink } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { BridgeClient, readGrant } from './bridge.js';
import { createServer } from './server.js';

const sessionSchema = z.strictObject({ version: z.literal(1), grantFile: z.string().min(1), instanceId: z.string().min(1) });
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export async function sessionGrant(file: string): Promise<string> {
  const absolute = resolve(file), info = await lstat(absolute);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) throw Error('Invalid session pointer');
  const pointer = sessionSchema.parse(JSON.parse(await readFile(absolute, 'utf8')));
  if (resolve(pointer.grantFile) !== pointer.grantFile) throw Error('Pairing path must be absolute');
  const grant = await readGrant(pointer.grantFile);
  if (grant.instanceId !== pointer.instanceId) throw Error('Pairing instance changed; explicitly configure a new workspace');
  return pointer.grantFile;
}

export async function bindSession(sessionFile: string, pairing: string): Promise<void> {
  const file = resolve(sessionFile), info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) throw Error('Invalid session pointer');
  const before = await readFile(file, 'utf8'); sessionSchema.parse(JSON.parse(before));
  const grantFile = resolve(pairing), grant = await readGrant(grantFile);
  const temporary = join(dirname(file), `.autocad-session-${randomUUID()}.tmp`);
  let created = false;
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, grantFile, instanceId: grant.instanceId }, null, 2), { flag: 'wx', mode: 0o600 });
    created = true;
    if ((await lstat(file)).isSymbolicLink() || await readFile(file, 'utf8') !== before) throw Error('Session changed concurrently');
    await rename(temporary, file);
  } finally { if (created) await unlink(temporary).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; }); }
}

export async function configureWorkspace(workspace: string, pairing: string): Promise<void> {
  const grantFile = resolve(pairing), grant = await readGrant(grantFile), folder = resolve(workspace);
  // No overwrites or edits to existing client configuration, including symlinks.
  const existing = await lstat(folder).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return undefined; throw e; });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink() || (await readdir(folder)).length)) throw Error('Use a new or empty client workspace');
  await mkdir(folder, { recursive: true });
  const sessionFile = join(folder, 'autocad-session.json');
  await writeFile(sessionFile, JSON.stringify({ version: 1, grantFile, instanceId: grant.instanceId }, null, 2), { flag: 'wx', mode: 0o600 });
  const command = process.execPath, args = [join(project, 'dist/src/pilot.js'), 'serve', '--session-file', sessionFile];
  await mkdir(join(folder, 'codex/.codex'), { recursive: true });
  await mkdir(join(folder, 'codex/.agents/skills'), { recursive: true });
  await mkdir(join(folder, 'claude/.claude/skills'), { recursive: true });
  await mkdir(join(folder, 'opencode/.opencode/skills'), { recursive: true });
  const toml = ['[mcp_servers.autocad]', `command = ${JSON.stringify(command)}`, `args = ${JSON.stringify(args)}`,
    'required = true', 'startup_timeout_sec = 20', 'tool_timeout_sec = 30', 'default_tools_approval_mode = "writes"', ''].join('\n');
  await writeFile(join(folder, 'codex/.codex/config.toml'), toml, { flag: 'wx' });
  await writeFile(join(folder, 'claude/.mcp.json'), JSON.stringify({ mcpServers: { autocad: { type: 'stdio', command, args } } }, null, 2), { flag: 'wx' });
  await writeFile(join(folder, 'opencode/opencode.json'), JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { autocad: { type: 'local', command: [command, ...args], enabled: true, timeout: 30000 } }, permission: { 'autocad_*': 'ask' } }, null, 2), { flag: 'wx' });
  await cp(join(project, 'skills/autocad-mcp'), join(folder, 'codex/.agents/skills/autocad-mcp'), { recursive: true, force: false, errorOnExist: true });
  await cp(join(project, 'skills/autocad-mcp'), join(folder, 'claude/.claude/skills/autocad-mcp'), { recursive: true, force: false, errorOnExist: true });
  await cp(join(project, 'skills/autocad-mcp'), join(folder, 'opencode/.opencode/skills/autocad-mcp'), { recursive: true, force: false, errorOnExist: true });
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2), options = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || !rest[i + 1] || options.has(rest[i]!)) throw Error('Invalid options');
    options.set(rest[i]!, rest[i + 1]!);
  }
  if (mode === 'pair' && options.size === 2 && options.has('--session-file') && options.has('--grant-file')) {
    await bindSession(options.get('--session-file')!, options.get('--grant-file')!);
    process.stdout.write('Pairing pointer updated. Restart the client MCP connection; running calls are not retargeted.\n'); return;
  }
  if (mode === 'configure' && options.size === 2 && options.has('--workspace') && options.has('--grant-file')) {
    await configureWorkspace(options.get('--workspace')!, options.get('--grant-file')!);
    process.stdout.write('Client workspace and Codex/Claude/OpenCode skills configured. No client model was called.\n'); return;
  }
  if ((mode === 'serve' || mode === 'doctor') && options.size === 1 && options.has('--session-file')) {
    const grantFile = await sessionGrant(options.get('--session-file')!), bridge = new BridgeClient(grantFile);
    if (mode === 'doctor') {
      const grant = await readGrant(grantFile), result = await bridge.call('acad_get_status', { instanceId: grant.instanceId });
      const caps = await bridge.call('acad_get_capabilities', { instanceId: grant.instanceId });
      const docs = await bridge.call('acad_list_documents', { instanceId: grant.instanceId });
      process.stdout.write(JSON.stringify({ connected: result.connected === true, backend: result.backend, simulation: result.simulation, toolCount: Array.isArray(caps.operations) ? caps.operations.length : 0, documentCount: Array.isArray(docs.documents) ? docs.documents.length : 0 }) + '\n');
      if (result.connected !== true || result.backend !== 'objectarx' || result.simulation !== false) process.exitCode = 1;
      return;
    }
    const handle = serveStdio(() => createServer(bridge), { onerror: () => process.stderr.write('MCP transport error\n') });
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void handle.close(); });
    return;
  }
  throw Error('Usage: pilot configure --workspace <empty-directory> --grant-file <pairing.json> | pilot serve|doctor --session-file <autocad-session.json> | pilot pair --session-file <autocad-session.json> --grant-file <pairing.json>');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { process.stderr.write('Autocad MCP pilot setup or pairing unavailable. Check arguments and explicitly re-pair after AutoCAD restart.\n'); process.exitCode = 2; });
}
