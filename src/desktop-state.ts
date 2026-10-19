import { randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { BridgeClient, readGrant } from './bridge.js';
import { BridgeError } from './protocol.js';
import { plainPath } from './distribution.js';
import type { ToolName } from './tools.js';

export const controllerSchema = z.strictObject({ version: z.literal(1), controllerId: z.string().uuid(), pid: z.number().int().positive(), processMarker: z.string().min(1).max(128), lastSeenAt: z.number().int().positive() });
export const desktopBindingSchema = z.strictObject({ version: z.literal(2), controllerId: z.string().uuid(), generation: z.string().uuid(), grantFile: z.string().max(4096).nullable(), instanceId: z.string().max(128).nullable() }).refine(p => (p.grantFile === null) === (p.instanceId === null), 'Incomplete binding');
export type DesktopBinding = z.infer<typeof desktopBindingSchema>;
const presenceSchema = z.strictObject({ version: z.literal(1), id: z.string().uuid(), pid: z.number().int().positive(), lastSeenAt: z.number().int().positive() });

export async function desktopRead<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  await plainPath(file); const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) throw Error('Invalid desktop state');
  return schema.parse(JSON.parse(await readFile(file, 'utf8')));
}
export async function desktopWrite(file: string, data: unknown) {
  await plainPath(file); await mkdir(dirname(file), { recursive: true });
  const existing = await lstat(file).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return undefined; throw e; });
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw Error('Invalid desktop state path');
  const temporary = join(dirname(file), '.desktop-' + randomUUID());
  try { await writeFile(temporary, JSON.stringify(data) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temporary, file); }
  finally { await unlink(temporary).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; }); }
}
export function inside(root: string, file: string) {
  const rel = relative(resolve(root), resolve(file)); return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}
function processAlive(pid: number) { try { process.kill(pid, 0); return true; } catch { return false; } }
export async function liveDesktopController(root: string) {
  const controller = await desktopRead(join(root, 'controller.json'), controllerSchema);
  if (Math.abs(Date.now() - controller.lastSeenAt) > 15000 || !processAlive(controller.pid)) throw new BridgeError('IPC_UNAVAILABLE', 'Desktop application is offline');
  return controller;
}
export async function bindDesktop(root: string, controllerId: string, grantFile: string | null): Promise<DesktopBinding> {
  const current = await liveDesktopController(root);
  if (current.controllerId !== controllerId) throw new BridgeError('SESSION_CHANGED', 'Desktop controller changed');
  if (grantFile !== null && !isAbsolute(grantFile)) throw Error('Absolute pairing path required');
  const grant = grantFile ? await readGrant(grantFile) : undefined;
  const binding: DesktopBinding = { version: 2, controllerId, generation: randomUUID(), grantFile, instanceId: grant?.instanceId ?? null };
  await desktopWrite(join(root, 'binding.json'), binding); return binding;
}

export class DesktopBridgeClient {
  private cached: { generation: string; bridge: BridgeClient } | undefined;
  constructor(private readonly root: string, private readonly expectedBuild?: string) {}
  async call(name: ToolName, params: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    let controller: z.infer<typeof controllerSchema>, binding: DesktopBinding;
    try {
      controller = await liveDesktopController(this.root);
      binding = await desktopRead(join(this.root, 'binding.json'), desktopBindingSchema);
      if (binding.controllerId !== controller.controllerId || !binding.grantFile) throw Error('Not paired');
    } catch {
      if (name === 'acad_list_instances') return { instances: [] };
      throw new BridgeError('IPC_UNAVAILABLE', 'Open Autocad MCP and select an AutoCAD connection');
    }
    const captured = binding;
    if (this.cached?.generation !== binding.generation) {
      const guard = async () => {
        const owner = await liveDesktopController(this.root), next = await desktopRead(join(this.root, 'binding.json'), desktopBindingSchema);
        if (owner.controllerId !== captured.controllerId || next.controllerId !== captured.controllerId || next.generation !== captured.generation || next.grantFile !== captured.grantFile || next.instanceId !== captured.instanceId)
          throw new BridgeError('SESSION_CHANGED', 'Connection changed before submission; rediscover the explicit target');
      };
      this.cached = { generation: captured.generation, bridge: new BridgeClient(captured.grantFile!, 10000, 64, this.expectedBuild, guard) };
    }
    return this.cached.bridge.call(name, params, signal);
  }
}

export async function desktopPresence(root: string) {
  const id = randomUUID(), file = join(root, 'clients', id + '.json'); let initialized = false, closed = false;
  const write = async () => { if (initialized && !closed) await desktopWrite(file, { version: 1, id, pid: process.pid, lastSeenAt: Date.now() }); };
  const timer = setInterval(() => { void write().catch(() => {}); }, 3000); timer.unref();
  return {
    initialized: async () => { initialized = true; await write(); },
    close: async () => { closed = true; clearInterval(timer); await unlink(file).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; }); }
  };
}
export async function desktopClientCount(root: string) {
  await plainPath(join(root, 'clients'));
  const names = await readdir(join(root, 'clients')).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return []; throw e; });
  let count = 0;
  for (const name of names) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
    try { const p = await desktopRead(join(root, 'clients', name), presenceSchema); if (p.id + '.json' === name && Math.abs(Date.now() - p.lastSeenAt) <= 12000 && processAlive(p.pid)) count++; } catch { /* Invalid/stale presence is not a live client. */ }
    if (count >= 128) break;
  }
  return count;
}

// A desktop workspace is independent of a particular AutoCAD launch. No global config edits.
export async function configureDesktopWorkspace(root: string, workspace: string) {
  root = await plainPath(root); workspace = await plainPath(workspace);
  const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const receiptFile = join(workspace, '.autocad-desktop-workspace.json');
  const existing = await lstat(workspace).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return undefined; throw e; });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw Error('Invalid workspace');
  if (existing && (await readdir(workspace)).length) {
    const receipt = await desktopRead(receiptFile, z.strictObject({ version: z.literal(1), product: z.literal('autocad-mcp-desktop'), stateRoot: z.string(), serverRoot: z.string().optional() }));
    const same = (a: string, b: string) => process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
    if (!same(receipt.stateRoot, root) || !receipt.serverRoot || !same(receipt.serverRoot, project)) throw Error('Use a new workspace for this installation');
    for (const path of ['codex/.codex/config.toml', 'claude/.mcp.json', 'opencode/opencode.json', 'codex/.agents/skills/autocad-mcp/SKILL.md', 'claude/.claude/skills/autocad-mcp/SKILL.md', 'opencode/.opencode/skills/autocad-mcp/SKILL.md']) {
      await plainPath(join(workspace, path));
      const info = await lstat(join(workspace, path));
      if (!info.isFile() || info.isSymbolicLink() || info.size === 0) throw Error('Incomplete workspace; use a new empty directory');
    }
    // Never overwrite edited configurations or skills, even in our managed workspace.
    return { workspace, created: false };
  }
  await mkdir(workspace, { recursive: true });
  const command = process.execPath, args = [join(project, 'dist/src/pilot.js'), 'desktop-serve', '--state-root', root];
  for (const path of ['codex/.codex', 'codex/.agents/skills', 'claude/.claude/skills', 'opencode/.opencode/skills']) await mkdir(join(workspace, path), { recursive: true });
  await writeFile(join(workspace, 'codex/.codex/config.toml'), ['[mcp_servers.autocad]', `command = ${JSON.stringify(command)}`, `args = ${JSON.stringify(args)}`, 'required = true', 'startup_timeout_sec = 20', 'tool_timeout_sec = 30', 'default_tools_approval_mode = "writes"', ''].join('\n'), { flag: 'wx' });
  await writeFile(join(workspace, 'claude/.mcp.json'), JSON.stringify({ mcpServers: { autocad: { type: 'stdio', command, args } } }, null, 2), { flag: 'wx' });
  await writeFile(join(workspace, 'opencode/opencode.json'), JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { autocad: { type: 'local', command: [command, ...args], enabled: true, timeout: 30000 } }, permission: { 'autocad_*': 'ask' } }, null, 2), { flag: 'wx' });
  for (const path of ['codex/.agents/skills', 'claude/.claude/skills', 'opencode/.opencode/skills']) await cp(join(project, 'skills/autocad-mcp'), join(workspace, path, 'autocad-mcp'), { recursive: true, force: false, errorOnExist: true });
  await writeFile(receiptFile, JSON.stringify({ version: 1, product: 'autocad-mcp-desktop', stateRoot: root, serverRoot: project }), { flag: 'wx', mode: 0o600 });
  return { workspace, created: true };
}
