#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readdir, rename, unlink, type FileHandle } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { BridgeClient, readGrant } from './bridge.js';
import { plainPath } from './distribution.js';
import { installedBuildIdentity } from './installed-build.js';
import { bindDesktop, configureDesktopWorkspace, controllerSchema, desktopBindingSchema, desktopClientCount, desktopRead, desktopWrite, inside } from './desktop-state.js';
import { FrameReader } from './protocol.js';
import type { ToolName } from './tools.js';

const hostStateSchema = z.strictObject({ backend: z.literal('objectarx'), simulation: z.literal(false), processId: z.number().int().positive(), nativeBuildId: z.string().regex(/^[a-f0-9]{64}$/), bridgeStarted: z.boolean(), cadGrantFile: z.string().nullable() });
export async function desktopHostFiles(root: string) {
  await plainPath(root);
  const names = (await readdir(root).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return []; throw e; })).filter(name => /^inst-[a-f0-9]{32}$/.test(name));
  const candidates: { file: string; modified: number }[] = [];
  // Empty directories remain after normal shutdown. Bound live probes only
  // after finding actual descriptors, with newest launches first.
  for (let start = 0; start < names.length; start += 64) {
    const files = await Promise.all(names.slice(start, start + 64).map(async name => {
      const file = join(root, name, 'pairing.json'), info = await lstat(file).catch(() => undefined);
      return info?.isFile() && !info.isSymbolicLink() ? { file, modified: info.mtimeMs } : null;
    }));
    for (const file of files) if (file) candidates.push(file);
  }
  return candidates.sort((a, b) => b.modified - a.modified || a.file.localeCompare(b.file)).slice(0, 64).map(candidate => candidate.file);
}
export class DesktopManager {
  readonly controllerId = randomUUID();
  private closing = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private heartbeat = Promise.resolve();
  private lock: FileHandle | undefined;
  constructor(readonly root: string, readonly hostsRoot: string, readonly cadRoot: string, private readonly buildId: string | undefined, private readonly marker: (pid: number) => Promise<string | null> = processMarker) {}
  async initialize() {
    await plainPath(this.root); await plainPath(this.hostsRoot); await plainPath(this.cadRoot);
    await mkdir(this.root, { recursive: true });
    const marker = await this.marker(process.pid); if (!marker) throw Error('Cannot verify desktop process');
    const lockFile = join(this.root, 'controller.lock');
    try { this.lock = await open(lockFile, 'wx'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const owner = await desktopRead(lockFile, controllerSchema);
      if (await this.marker(owner.pid) === owner.processMarker) throw Error('Desktop controller already running');
      const again = await desktopRead(lockFile, controllerSchema);
      if (again.controllerId !== owner.controllerId) throw Error('Desktop controller changed');
      await rename(lockFile, join(this.root, 'stale-controller-' + randomUUID()));
      this.lock = await open(lockFile, 'wx');
    }
    await this.lock.writeFile(JSON.stringify({ version: 1, controllerId: this.controllerId, pid: process.pid, processMarker: marker, lastSeenAt: Date.now() }));
    const pulse = () => desktopWrite(join(this.root, 'controller.json'), { version: 1, controllerId: this.controllerId, pid: process.pid, processMarker: marker, lastSeenAt: Date.now() });
    try { await pulse(); await bindDesktop(this.root, this.controllerId, null); }
    catch (error) { await this.lock.close(); this.lock = undefined; await unlink(lockFile); throw error; }
    this.timer = setInterval(() => { this.heartbeat = this.heartbeat.then(() => this.closing ? undefined : pulse()).catch(() => {}); }, 3000);
  }
  async hosts() {
    const result: { hostId: string; processId: number; compatible: boolean; bridgeStarted: boolean }[] = [];
    for (const file of await desktopHostFiles(this.hostsRoot)) {
      try {
        const grant = await readGrant(file);
        if (!grant.operations.includes('desktop_get_status') || grant.backend !== 'objectarx') continue;
        const info = hostStateSchema.parse(await new BridgeClient(file, 1000).call('desktop_get_status' as ToolName, { instanceId: grant.instanceId }));
        if (info.nativeBuildId !== grant.nativeBuildId) continue;
        result.push({ hostId: grant.instanceId, processId: info.processId, compatible: !this.buildId || info.nativeBuildId === this.buildId, bridgeStarted: info.bridgeStarted });
      } catch { /* Stale grants and non-live hosts never appear ready. */ }
    }
    return result;
  }
  async connect(hostId: string) {
    if (!/^inst-[a-f0-9]{32}$/.test(hostId)) throw Error('Invalid host selection');
    const file = join(this.hostsRoot, hostId, 'pairing.json'), grant = await readGrant(file);
    if (grant.instanceId !== hostId || grant.backend !== 'objectarx' || !grant.operations.includes('desktop_start')) throw Error('Invalid host');
    const info = hostStateSchema.parse(await new BridgeClient(file, 10000, 4, this.buildId).call('desktop_start' as ToolName, { instanceId: hostId }));
    if (!info.bridgeStarted || !info.cadGrantFile || !inside(this.cadRoot, info.cadGrantFile)) throw Error('AutoCAD connection could not be prepared');
    const cad = await readGrant(info.cadGrantFile);
    if (cad.backend !== 'objectarx' || cad.nativeBuildId !== info.nativeBuildId) throw Error('Native pairing mismatch');
    const status = await new BridgeClient(info.cadGrantFile, 10000, 4, this.buildId).call('acad_get_status', { instanceId: cad.instanceId });
    if (status.backend !== 'objectarx' || status.simulation !== false || status.connected !== true) throw Error('AutoCAD is not connected');
    await bindDesktop(this.root, this.controllerId, info.cadGrantFile); return this.snapshot();
  }
  async disconnect() { await bindDesktop(this.root, this.controllerId, null); return this.snapshot(); }
  async snapshot() {
    const hosts = await this.hosts(); let connected = false, documentCount = 0, toolCount = 0, selectedInstanceId: string | null = null;
    try {
      const binding = await desktopRead(join(this.root, 'binding.json'), desktopBindingSchema);
      if (binding.controllerId === this.controllerId && binding.grantFile) {
        const grant = await readGrant(binding.grantFile);
        if (grant.instanceId !== binding.instanceId) throw Error('Session changed');
        const bridge = new BridgeClient(binding.grantFile, 1200, 4, this.buildId);
        const status = await bridge.call('acad_get_status', { instanceId: grant.instanceId });
        connected = status.connected === true && status.backend === 'objectarx' && status.simulation === false;
        if (connected) {
          selectedInstanceId = grant.instanceId;
          const capabilities = await bridge.call('acad_get_capabilities', { instanceId: grant.instanceId }); toolCount = Array.isArray(capabilities.operations) ? capabilities.operations.length : 0;
          const docs = await bridge.call('acad_list_documents', { instanceId: grant.instanceId }); documentCount = Array.isArray(docs.documents) ? docs.documents.length : 0;
        }
      }
    } catch { connected = false; }
    let workspace: string | null = null;
    try { const prefs = await desktopRead(join(this.root, 'preferences.json'), z.strictObject({ version: z.literal(1), workspace: z.string().min(1).max(4096) })); workspace = await plainPath(prefs.workspace); } catch { /* Default workspace is used; unreadable preferences do not fake a CAD failure. */ }
    return { connected, selectedInstanceId, documentCount, toolCount, clientCount: await desktopClientCount(this.root), hosts, workspace };
  }
  async close() {
    this.closing = true; clearInterval(this.timer); await this.heartbeat;
    const current = await desktopRead(join(this.root, 'controller.json'), controllerSchema).catch(() => undefined);
    if (current?.controllerId === this.controllerId) {
      await bindDesktop(this.root, this.controllerId, null).catch(() => {});
      await desktopWrite(join(this.root, 'controller.json'), { ...current, lastSeenAt: 1 });
    }
    if (this.lock) {
      await this.lock.close(); this.lock = undefined;
      const owner = await desktopRead(join(this.root, 'controller.lock'), controllerSchema);
      if (owner.controllerId === this.controllerId) await unlink(join(this.root, 'controller.lock'));
    }
  }
}

async function processMarker(pid: number): Promise<string | null> {
  if (!Number.isInteger(pid) || pid <= 0 || pid > 2147483647) return null;
  const ps = join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  try { const { stdout } = await promisify(execFile)(ps, ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`], { windowsHide: true, timeout: 10000 }); const marker = stdout.trim(); return /^\d{10,20}$/.test(marker) ? marker : null; } catch { return null; }
}
const commandSchema = z.discriminatedUnion('method', [
  z.strictObject({ id: z.number().int().positive(), method: z.literal('snapshot') }),
  z.strictObject({ id: z.number().int().positive(), method: z.literal('connect'), hostId: z.string().regex(/^inst-[a-f0-9]{32}$/) }),
  z.strictObject({ id: z.number().int().positive(), method: z.literal('disconnect') }),
  z.strictObject({ id: z.number().int().positive(), method: z.literal('configure'), workspace: z.string().min(1).max(4096) }),
  z.strictObject({ id: z.number().int().positive(), method: z.literal('exit') })
]);
async function main() {
  const options = new Map<string, string>(), args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (!['--state-root', '--hosts-root', '--cad-root'].includes(args[i]!) || !args[i + 1] || options.has(args[i]!)) throw Error('Invalid desktop options'); options.set(args[i]!, args[i + 1]!);
  }
  if (!options.has('--state-root')) throw Error('Desktop state root required');
  const base = join(process.env.LOCALAPPDATA ?? '', 'AutocadMCP');
  const manager = new DesktopManager(resolve(options.get('--state-root')!), resolve(options.get('--hosts-root') ?? join(base, 'desktop-hosts')), resolve(options.get('--cad-root') ?? join(base, 'runtime')), await installedBuildIdentity());
  await manager.initialize(); const frames = new FrameReader(); let queue = Promise.resolve(), pending = 0, exiting = false;
  const exit = async () => { if (!exiting) { exiting = true; await manager.close(); process.exitCode = 0; process.stdin.destroy(); } };
  process.stdin.on('data', (chunk: Buffer) => {
    try { for (const frame of frames.push(chunk)) {
      if (++pending > 16) throw Error('Desktop queue full');
      queue = queue.then(async () => {
        let id = 0, method = '';
        try {
          const cmd = commandSchema.parse(JSON.parse(frame)); id = cmd.id; method = cmd.method;
          const result = cmd.method === 'snapshot' ? await manager.snapshot() : cmd.method === 'connect' ? await manager.connect(cmd.hostId) : cmd.method === 'disconnect' ? await manager.disconnect() : cmd.method === 'configure' ? await configureDesktopWorkspace(manager.root, cmd.workspace) : await exit();
          if (cmd.method === 'configure') await desktopWrite(join(manager.root, 'preferences.json'), { version: 1, workspace: resolve(cmd.workspace) });
          process.stdout.write(JSON.stringify({ id, ok: true, result }) + '\n');
        } catch { process.stdout.write(JSON.stringify({ id, ok: false, error: method === 'configure' ? 'Klasör bu kuruluma ait değil veya dolu. Yeni/boş bir klasör seçin; mevcut dosyalar değiştirilmedi.' : 'İşlem tamamlanamadı. AutoCAD, eklenti sürümü ve bağlantı seçimini kontrol edin.' }) + '\n'); }
        finally { pending--; }
      });
    } } catch { void exit(); }
  });
  process.stdin.on('end', () => { void queue.finally(exit); });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void queue.finally(exit); });
  process.stdout.write(JSON.stringify({ id: 0, ok: true, ready: true }) + '\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { process.stderr.write('Desktop bağlantı yöneticisi başlatılamadı.\n'); process.exitCode = 2; });
