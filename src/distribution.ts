// Offline, per-user Windows preview installer. No registry, elevation or CAD settings edits.
import { createHash, randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, open, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { z } from 'zod';
import { BRIDGE_VERSION } from './protocol.js';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const packageSchema = z.strictObject({
  format: z.literal(1), product: z.literal('autocad-mcp'), version: z.string().regex(/^\d+\.\d+\.\d+$/),
  packageId: digest, bridgeVersion: z.literal(BRIDGE_VERSION), channel: z.enum(['private-preview', 'public-preview', 'stable']),
  platform: z.literal('win32'), arch: z.literal('x64'), autocad: z.literal('2027'), series: z.literal('R26.0'),
  nativeTesting: z.literal(false), nativeBuildId: digest, nodeVersion: z.string().regex(/^v24\.\d+\.\d+$/),
  projectLicense: z.enum(['UNDECIDED', 'Apache-2.0']),
  desktop: z.literal(true).optional(),
  files: z.array(z.strictObject({ path: z.string().min(1).max(240), size: z.number().int().min(0).max(512 * 1024 * 1024), sha256: digest })).min(10).max(10000)
});
export type PackageManifest = z.infer<typeof packageSchema>;
const archiveSchema = z.strictObject({ directory: z.string().regex(/^archive-[a-f0-9-]{36}$/), packageId: digest, version: z.string() });
const stateSchema = z.strictObject({ format: z.literal(1), product: z.literal('autocad-mcp'), active: digest.nullable(), archives: z.array(archiveSchema).max(1000) });
type InstallState = z.infer<typeof stateSchema>;
const journalSchema = z.discriminatedUnion('action', [
  z.strictObject({ format: z.literal(1), action: z.literal('activate'), stage: z.string().regex(/^stage-[a-f0-9-]{36}$/), archive: archiveSchema.shape.directory, before: stateSchema.nullable(), next: stateSchema }),
  z.strictObject({ format: z.literal(1), action: z.literal('uninstall'), directory: archiveSchema.shape.directory, before: stateSchema, next: stateSchema })
]);

export function sha256(content: string | Uint8Array): string { return createHash('sha256').update(content).digest('hex'); }
export function packageIdentity(manifest: Omit<PackageManifest, 'packageId'>): string { return sha256(JSON.stringify(manifest)); }

export function safeRelative(value: string): string {
  const parts = value.split('/');
  if (value.length > 240 || isAbsolute(value) || value.includes('\\') || parts.some(p => !/^[a-zA-Z0-9_@.()+,-]+$/.test(p) || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw Error('Unsafe package path');
  return value;
}

async function exists(path: string) { return lstat(path).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return undefined; throw e; }); }
// Includes ancestors: rejecting a symlink only on the final directory misses junction parents.
export async function plainPath(path: string): Promise<string> {
  const absolute = resolve(path), root = parse(absolute).root;
  if (process.platform === 'win32' && absolute.startsWith('\\\\')) throw Error('Local drive required');
  let part = root;
  for (const segment of relative(root, absolute).split(/[\\/]/).filter(Boolean)) {
    part = join(part, segment); const info = await exists(part);
    if (info?.isSymbolicLink() || (info && part !== absolute && !info.isDirectory())) throw Error('Linked or non-directory path is not allowed');
  }
  return absolute;
}

export async function inventory(root: string): Promise<PackageManifest['files']> {
  root = await plainPath(root); const files: PackageManifest['files'] = [], keys = new Set<string>(); let totalBytes = 0;
  async function walk(folder: string) {
    for (const name of (await readdir(folder)).sort()) {
      const file = join(folder, name), path = relative(root, file).replaceAll('\\', '/'); safeRelative(path);
      const key = path.toLowerCase(); if (keys.has(key)) throw Error('Case-colliding package paths'); keys.add(key);
      if (keys.size > 15000) throw Error('Package too large');
      const info = await lstat(file);
      if (info.isSymbolicLink()) throw Error('Linked package content');
      if (info.isDirectory()) await walk(file);
      else if (info.isFile()) {
        if (path === 'package-manifest.json') continue;
        totalBytes += info.size;
        if (totalBytes > 512 * 1024 * 1024 || files.length >= 10000) throw Error('Package too large');
        files.push({ path, size: info.size, sha256: sha256(await readFile(file)) });
      } else throw Error('Unsupported package file');
    }
  }
  await walk(root); return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export async function readPackage(root: string): Promise<PackageManifest> {
  root = await plainPath(root);
  const file = join(root, 'package-manifest.json'), info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 4 * 1024 * 1024) throw Error('Invalid package manifest');
  const manifest = packageSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  const { packageId, ...content } = manifest;
  if (packageIdentity(content) !== packageId) throw Error('Package identity mismatch');
  const paths = new Set<string>();
  for (const entry of manifest.files) {
    safeRelative(entry.path); const key = entry.path.toLowerCase();
    if (paths.has(key) || key === 'package-manifest.json') throw Error('Duplicate manifest path'); paths.add(key);
  }
  for (const required of ['PackageContents.xml', 'Contents/Win64/AutocadMcp.arx', 'Contents/server/runtime/node.exe', 'Contents/server/runtime/LICENSE', 'Contents/server/dist/src/setup.js', 'Contents/server/dist/src/pilot.js', 'Contents/server/skills/autocad-mcp/SKILL.md']) {
    if (!paths.has(required.toLowerCase())) throw Error('Incomplete package');
  }
  if (manifest.desktop) for (const required of ['Contents/desktop/AutocadMcpDesktop.exe', 'Contents/server/dist/src/desktop-agent.js', 'Contents/server/dist/src/desktop-state.js']) if (!paths.has(required.toLowerCase())) throw Error('Incomplete desktop package');
  if (manifest.channel !== 'private-preview' && manifest.projectLicense !== 'Apache-2.0') throw Error('Public package requires the selected project license');
  if (manifest.projectLicense === 'Apache-2.0' && (!paths.has('license') || !paths.has('notice'))) throw Error('Project license notices missing');
  if (JSON.stringify(await inventory(root)) !== JSON.stringify(manifest.files)) throw Error('Package files changed, missing or untracked');
  return manifest;
}

function locations(root: string) {
  return { root: resolve(root), active: join(resolve(root), 'AutocadMcp.bundle'), management: join(resolve(root), '.AutocadMcp') };
}
async function stateAt(management: string): Promise<InstallState | undefined> {
  const file = join(management, 'state.json'), info = await exists(file);
  if (!info) return undefined;
  if (!info.isFile() || info.isSymbolicLink() || info.size > 512 * 1024) throw Error('Invalid installation state');
  return stateSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}
async function atomicJson(file: string, value: unknown) {
  const temp = join(dirname(file), '.write-' + randomUUID());
  try { await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, file); }
  finally { await unlink(temp).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; }); }
}
async function locked<T>(root: string, work: (paths: ReturnType<typeof locations>) => Promise<T>, recovery = false): Promise<T> {
  const paths = locations(await plainPath(root));
  await plainPath(paths.management); await mkdir(paths.management, { recursive: true });
  const lock = join(paths.management, 'lock');
  if (recovery && await exists(lock)) {
    const info = await lstat(lock);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512) throw Error('Unrecognized setup lock');
    const content = await readFile(lock, 'utf8');
    const owner = z.strictObject({ format: z.literal(1), pid: z.number().int().min(1).max(2147483647), nonce: z.string().uuid() }).parse(JSON.parse(content));
    let alive = true;
    try { process.kill(owner.pid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; else throw error; }
    if (alive || await readFile(lock, 'utf8') !== content) throw Error('Setup lock owner is still running or changed');
    await rename(lock, join(paths.management, 'stale-lock-' + randomUUID()));
  }
  const handle = await open(lock, 'wx');
  try {
    await handle.writeFile(JSON.stringify({ format: 1, pid: process.pid, nonce: randomUUID() }));
    if (!recovery && await exists(join(paths.management, 'transaction.json'))) throw Error('Interrupted installation: recovery required; inspect with doctor');
    return await work(paths);
  } finally { await handle.close(); await unlink(lock); }
}

async function current(paths: ReturnType<typeof locations>) {
  const state = await stateAt(paths.management), active = await exists(paths.active);
  if (active && !state?.active) throw Error('Unmanaged bundle; refusing to overwrite');
  if (!active && state?.active) throw Error('Active installation missing');
  const manifest = active ? await readPackage(paths.active) : undefined;
  if (manifest && manifest.packageId !== state?.active) throw Error('Installation receipt mismatch');
  return { state, manifest };
}

async function activate(paths: ReturnType<typeof locations>, source: string) {
  const candidate = await readPackage(source), before = await current(paths);
  if (candidate.packageId === before.manifest?.packageId) return { changed: false, packageId: candidate.packageId };
  const stage = join(paths.management, 'stage-' + randomUUID()), archived = 'archive-' + randomUUID(), archive = join(paths.management, archived);
  await cp(source, stage, { recursive: true, force: false, errorOnExist: true, dereference: false });
  await readPackage(stage); // Recheck after copy, before altering any active install.
  const next: InstallState = { format: 1, product: 'autocad-mcp', active: candidate.packageId, archives: [...(before.state?.archives ?? [])] };
  if (before.manifest) next.archives.push({ directory: archived, packageId: before.manifest.packageId, version: before.manifest.version });
  stateSchema.parse(next);
  const journal = join(paths.management, 'transaction.json');
  await atomicJson(journal, { format: 1, action: 'activate', stage: relative(paths.management, stage), archive: archived, before: before.state ?? null, next });
  let oldMoved = false, newMoved = false;
  try {
    if (before.manifest) { await rename(paths.active, archive); oldMoved = true; }
    await rename(stage, paths.active); newMoved = true;
    await atomicJson(join(paths.management, 'state.json'), next);
  } catch (error) {
    // If either recovery rename fails, retain the journal and block future writes.
    if (newMoved) await rename(paths.active, stage);
    if (oldMoved) await rename(archive, paths.active);
    await unlink(journal); throw error;
  }
  await unlink(journal);
  return { changed: true, packageId: candidate.packageId };
}

export async function installPackage(root: string, source: string) {
  source = await plainPath(source); root = await plainPath(root);
  // Source must not be the active bundle or inside installer-owned working state.
  const paths = locations(root), rel = relative(paths.management, source);
  if (source.toLowerCase() === paths.active.toLowerCase() || (!rel.startsWith('..') && !isAbsolute(rel))) throw Error('Use a separate source package');
  return locked(root, p => activate(p, source));
}
export async function rollbackPackage(root: string, directory: string) {
  return locked(root, async paths => {
    const before = await current(paths), entry = before.state?.archives.find(a => a.directory === directory);
    if (!entry) throw Error('Unknown archived version');
    const source = join(paths.management, entry.directory), archived = await readPackage(source);
    if (archived.packageId !== entry.packageId) throw Error('Archive identity mismatch');
    return activate(paths, source);
  });
}
export async function uninstallPackage(root: string) {
  return locked(root, async paths => {
    const before = await current(paths);
    if (!before.manifest) return { changed: false };
    const directory = 'archive-' + randomUUID(), next: InstallState = { format: 1, product: 'autocad-mcp', active: null, archives: [...before.state!.archives, { directory, packageId: before.manifest.packageId, version: before.manifest.version }] };
    stateSchema.parse(next);
    const journal = join(paths.management, 'transaction.json');
    await atomicJson(journal, { format: 1, action: 'uninstall', directory, before: before.state, next });
    await rename(paths.active, join(paths.management, directory));
    try { await atomicJson(join(paths.management, 'state.json'), next); }
    catch (error) { await rename(join(paths.management, directory), paths.active); await unlink(journal); throw error; }
    await unlink(journal); return { changed: true, archived: directory, retainedUserData: true };
  });
}
export async function installationStatus(root: string) {
  const paths = locations(await plainPath(root)); await plainPath(paths.management);
  const recoveryRequired = Boolean(await exists(join(paths.management, 'transaction.json'))), busy = Boolean(await exists(join(paths.management, 'lock')));
  // A torn receipt/rename must remain diagnosable rather than hide the recovery flag.
  const before = recoveryRequired ? { state: await stateAt(paths.management), manifest: undefined } : await current(paths);
  return { installed: recoveryRequired ? Boolean(await exists(paths.active)) : Boolean(before.manifest), packageId: before.manifest?.packageId ?? before.state?.active ?? null, version: before.manifest?.version ?? null, archives: before.state?.archives ?? [], recoveryRequired, busy, signedRelease: false, projectLicense: before.manifest?.projectLicense ?? 'UNDECIDED' };
}

export async function recoverInstallation(root: string) {
  return locked(root, async paths => {
    const file = join(paths.management, 'transaction.json'), info = await exists(file);
    if (!info) return { changed: false };
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024) throw Error('Invalid recovery journal');
    const journal = journalSchema.parse(JSON.parse(await readFile(file, 'utf8'))), stored = await stateAt(paths.management);
    if (JSON.stringify(stored ?? null) !== JSON.stringify(journal.before) && JSON.stringify(stored ?? null) !== JSON.stringify(journal.next)) throw Error('Receipt changed outside interrupted transaction');
    const active = await exists(paths.active) ? await readPackage(paths.active) : undefined;
    const archive = join(paths.management, journal.action === 'activate' ? journal.archive : journal.directory);
    const old = await exists(archive) ? await readPackage(archive) : undefined;
    if (old && old.packageId !== journal.before?.active) throw Error('Recovery archive changed');
    let disposition: 'completed' | 'restored';
    if ((journal.action === 'activate' && active?.packageId === journal.next.active) ||
        (journal.action === 'uninstall' && !active && old?.packageId === journal.before.active)) {
      await atomicJson(join(paths.management, 'state.json'), journal.next); disposition = 'completed';
    } else {
      if (active && active.packageId !== journal.before?.active) throw Error('Unknown active package; recovery refused');
      if (!active && journal.before?.active) {
        if (!old) throw Error('Recovery archive missing');
        await rename(archive, paths.active);
      }
      if (journal.before) await atomicJson(join(paths.management, 'state.json'), journal.before);
      else if (stored) await unlink(join(paths.management, 'state.json'));
      disposition = 'restored';
    }
    await unlink(file); return { changed: true, disposition };
  }, true);
}
