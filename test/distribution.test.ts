import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { installPackage, installationStatus, inventory, packageIdentity, packageSchema, readPackage, recoverInstallation, rollbackPackage, safeRelative, uninstallPackage, type PackageManifest } from '../src/distribution.js';
import { BridgeClient } from '../src/bridge.js';
import { mockPlugin, cleanupFixture } from './fixture.js';

async function isolated() { return mkdtemp(join(tmpdir(), 'autocad-mcp-install-')); }
async function clean(folder: string) {
  assert.equal(dirname(folder), tmpdir()); assert.match(basename(folder), /^autocad-mcp-install-/);
  await rm(folder, { recursive: true });
}
async function candidate(parent: string, name: string, version = '0.1.0') {
  const root = join(parent, name);
  for (const file of ['PackageContents.xml', 'Contents/Win64/AutocadMcp.arx', 'Contents/server/runtime/node.exe', 'Contents/server/runtime/LICENSE', 'Contents/server/dist/src/setup.js', 'Contents/server/dist/src/pilot.js', 'Contents/server/skills/autocad-mcp/SKILL.md', 'Contents/server/package.json', 'THIRD_PARTY.json', 'README.txt']) {
    await mkdir(dirname(join(root, file)), { recursive: true }); await writeFile(join(root, file), name + ':' + file);
  }
  const content: Omit<PackageManifest, 'packageId'> = { format: 1, product: 'autocad-mcp', version, bridgeVersion: '0.1.0', channel: 'private-preview', platform: 'win32', arch: 'x64', autocad: '2027', series: 'R26.0', nativeTesting: false, nativeBuildId: 'a'.repeat(64), nodeVersion: 'v24.19.0', projectLicense: 'UNDECIDED', files: await inventory(root) };
  await writeFile(join(root, 'package-manifest.json'), JSON.stringify({ ...content, packageId: packageIdentity(content) }));
  return root;
}

test('stable candidates require license notices without treating the channel as signature evidence', async () => {
  const folder = await isolated();
  try {
    const source = await candidate(folder, 'source', '1.0.0');
    const original = await readPackage(source);
    const update = async (license: 'UNDECIDED' | 'Apache-2.0') => {
      const { packageId: _, ...content } = { ...original, channel: 'stable' as const, projectLicense: license, files: await inventory(source) };
      await writeFile(join(source, 'package-manifest.json'), JSON.stringify({ ...content, packageId: packageIdentity(content) }));
    };
    assert.equal(packageSchema.safeParse({ ...original, channel: 'arbitrary' }).success, false);
    assert.equal(packageSchema.safeParse({ ...original, projectLicense: 'invented' }).success, false);
    await update('UNDECIDED'); await assert.rejects(readPackage(source), /selected project license/);
    await update('Apache-2.0'); await assert.rejects(readPackage(source), /license notices missing/);
    await writeFile(join(source, 'LICENSE'), 'synthetic license notice');
    await writeFile(join(source, 'NOTICE'), 'synthetic project notice'); await update('Apache-2.0');
    await installPackage(join(folder, 'plugins'), source);
    assert.equal((await installationStatus(join(folder, 'plugins'))).signedRelease, false);
    assert.equal((await installationStatus(join(folder, 'plugins'))).projectLicense, 'Apache-2.0');
    const publicCandidate = await readPackage(source);
    const { packageId: _, ...publicContent } = { ...publicCandidate, channel: 'public-preview' as const };
    await writeFile(join(source, 'package-manifest.json'), JSON.stringify({ ...publicContent, packageId: packageIdentity(publicContent) }));
    assert.equal((await readPackage(source)).channel, 'public-preview');
    await writeFile(join(source, 'LICENSE'), 'modified'); await assert.rejects(readPackage(source), /changed/);
  } finally { await clean(folder); }
});

test('offline installation, idempotence, upgrade, rollback and uninstall preserve user data and previous versions', async () => {
  const folder = await isolated();
  try {
    const one = await candidate(folder, 'first'), two = await candidate(folder, 'second', '0.1.1'), root = join(folder, 'ApplicationPlugins');
    await mkdir(root); await writeFile(join(root, 'user.dwg'), 'never touch');
    const installed = await installPackage(root, one); assert.equal(installed.changed, true);
    assert.equal((await installPackage(root, one)).changed, false);
    await installPackage(root, two); let state = await installationStatus(root);
    assert.equal(state.version, '0.1.1'); assert.equal(state.archives.length, 1);
    await rollbackPackage(root, state.archives[0]!.directory); state = await installationStatus(root);
    assert.equal(state.packageId, installed.packageId); assert.equal(state.archives.length, 2);
    assert.equal((await uninstallPackage(root)).changed, true); state = await installationStatus(root);
    assert.equal(state.installed, false); assert.equal(state.archives.length, 3);
    assert.equal(await readFile(join(root, 'user.dwg'), 'utf8'), 'never touch');
    assert.equal((await uninstallPackage(root)).changed, false);
    await rollbackPackage(root, state.archives[0]!.directory); assert.equal((await installationStatus(root)).installed, true);
  } finally { await clean(folder); }
});

test('modified, missing, extra and unsafe package content is rejected before replacing an installation', async () => {
  const folder = await isolated();
  try {
    const good = await candidate(folder, 'good'), bad = await candidate(folder, 'bad'), root = join(folder, 'plugins');
    const expected = await installPackage(root, good);
    await writeFile(join(bad, 'Contents/Win64/AutocadMcp.arx'), 'tampered');
    await assert.rejects(installPackage(root, bad), /changed/);
    assert.equal((await installationStatus(root)).packageId, expected.packageId);
    await writeFile(join(root, 'AutocadMcp.bundle', 'personal.dwg'), 'keep');
    await assert.rejects(uninstallPackage(root), /changed/);
    assert.equal(await readFile(join(root, 'AutocadMcp.bundle', 'personal.dwg'), 'utf8'), 'keep');
    for (const path of ['../outside', 'Contents/../outside', 'C:/escape', 'x:stream', 'x\\y', 'x.', 'CON', 'A/NUL.txt', 'x//y']) assert.throws(() => safeRelative(path));
    const manifest = JSON.parse(await readFile(join(bad, 'package-manifest.json'), 'utf8'));
    manifest.nativeTesting = true; await writeFile(join(bad, 'package-manifest.json'), JSON.stringify(manifest));
    await assert.rejects(readPackage(bad));
    const missing = await candidate(folder, 'missing'); await rm(join(missing, 'Contents/server/runtime/LICENSE'));
    await assert.rejects(readPackage(missing), /changed/);
  } finally { await clean(folder); }
});

test('unmanaged bundles, concurrent setup and interrupted transactions fail without replacing files', async () => {
  const folder = await isolated();
  try {
    const source = await candidate(folder, 'source'), root = join(folder, 'plugins');
    await mkdir(join(root, 'AutocadMcp.bundle'), { recursive: true }); await writeFile(join(root, 'AutocadMcp.bundle', 'original.txt'), 'owned by user');
    await assert.rejects(installPackage(root, source), /Unmanaged/);
    assert.equal(await readFile(join(root, 'AutocadMcp.bundle', 'original.txt'), 'utf8'), 'owned by user');
    const other = join(folder, 'other'); await installPackage(other, source);
    await writeFile(join(other, '.AutocadMcp/lock'), 'another installer');
    await assert.rejects(uninstallPackage(other), /EEXIST/);
    assert.equal((await installationStatus(other)).busy, true);
    // Remove only a synthetic test lock this test created, not a user's stale lock.
    await rm(join(other, '.AutocadMcp/lock'));
    await writeFile(join(other, '.AutocadMcp/transaction.json'), '{}');
    await assert.rejects(uninstallPackage(other), /recovery required/);
    assert.equal((await installationStatus(other)).recoveryRequired, true);
  } finally { await clean(folder); }
});

test('junction roots and package file links cannot redirect installation outside the requested tree', async () => {
  const folder = await isolated();
  try {
    const source = await candidate(folder, 'source'), real = join(folder, 'real'), redirected = join(folder, 'redirected');
    await mkdir(real); await symlink(real, redirected, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(installPackage(join(redirected, 'nested'), source), /Linked/);
    await symlink(real, join(source, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(readPackage(source), /Linked/);
  } finally { await clean(folder); }
});

test('installed bridge rejects stale or mixed native builds before sending a CAD operation', async () => {
  const plugin = await mockPlugin({ nativeBuildId: 'a'.repeat(64) });
  try {
    await assert.rejects(new BridgeClient(plugin.grantFile, 1000, 64, 'b'.repeat(64)).call('acad_get_status', { instanceId: plugin.grant.instanceId }), e => (e as any).code === 'VERSION_MISMATCH');
    assert.equal(plugin.calls(), 0);
    assert.equal((await new BridgeClient(plugin.grantFile, 1000, 64, 'a'.repeat(64)).call('acad_get_status', { instanceId: plugin.grant.instanceId })).backend, 'mock');
  } finally { await plugin.close(); await cleanupFixture(plugin.folder); }
  const changed = await mockPlugin({ nativeBuildId: 'a'.repeat(64), handshakeBuildId: 'b'.repeat(64) });
  try {
    await assert.rejects(new BridgeClient(changed.grantFile, 1000, 64, 'a'.repeat(64)).call('acad_get_status', { instanceId: changed.grant.instanceId }), e => (e as any).code === 'VERSION_MISMATCH');
    assert.equal(changed.calls(), 0);
  } finally { await changed.close(); await cleanupFixture(changed.folder); }
});

test('recovery handles interruptions before swap, between renames and after activation without losing either package', async () => {
  const folder = await isolated();
  try {
    const one = await candidate(folder, 'one'), two = await candidate(folder, 'two', '0.1.1'), incoming = await readPackage(two);
    for (const point of ['prepared', 'old-moved', 'new-moved', 'receipt-written']) {
      const root = join(folder, point); await installPackage(root, one);
      const management = join(root, '.AutocadMcp'), before = JSON.parse(await readFile(join(management, 'state.json'), 'utf8'));
      const archive = 'archive-' + randomUUID(), stage = 'stage-' + randomUUID(); await cp(two, join(management, stage), { recursive: true });
      const next = { ...before, active: incoming.packageId, archives: [{ directory: archive, packageId: before.active, version: '0.1.0' }] };
      await writeFile(join(management, 'transaction.json'), JSON.stringify({ format: 1, action: 'activate', stage, archive, before, next }));
      if (point !== 'prepared') await rename(join(root, 'AutocadMcp.bundle'), join(management, archive));
      if (point === 'new-moved' || point === 'receipt-written') await rename(join(management, stage), join(root, 'AutocadMcp.bundle'));
      if (point === 'receipt-written') await writeFile(join(management, 'state.json'), JSON.stringify(next));
      assert.equal((await installationStatus(root)).recoveryRequired, true);
      if (point === 'prepared') await writeFile(join(management, 'lock'), JSON.stringify({ format: 1, pid: 2147483647, nonce: randomUUID() }));
      const result = await recoverInstallation(root), state = await installationStatus(root);
      assert.equal(result.disposition, point === 'prepared' || point === 'old-moved' ? 'restored' : 'completed');
      assert.equal(state.packageId, point === 'prepared' || point === 'old-moved' ? before.active : incoming.packageId);
      assert.equal(state.recoveryRequired, false);
      assert.equal((await recoverInstallation(root)).changed, false);
    }
  } finally { await clean(folder); }
});

test('interrupted uninstall recovers safely and refuses a live installer lock', async () => {
  const folder = await isolated();
  try {
    const source = await candidate(folder, 'source');
    for (const moved of [false, true]) {
      const root = join(folder, String(moved)); await installPackage(root, source);
      const management = join(root, '.AutocadMcp'), before = JSON.parse(await readFile(join(management, 'state.json'), 'utf8'));
      const directory = 'archive-' + randomUUID(), next = { ...before, active: null, archives: [{ directory, packageId: before.active, version: '0.1.0' }] };
      await writeFile(join(management, 'transaction.json'), JSON.stringify({ format: 1, action: 'uninstall', directory, before, next }));
      if (moved) await rename(join(root, 'AutocadMcp.bundle'), join(management, directory));
      await writeFile(join(management, 'lock'), JSON.stringify({ format: 1, pid: process.pid, nonce: randomUUID() }));
      await assert.rejects(recoverInstallation(root), /still running/); await rm(join(management, 'lock'));
      assert.equal((await recoverInstallation(root)).disposition, moved ? 'completed' : 'restored');
      assert.equal((await installationStatus(root)).installed, !moved);
    }
  } finally { await clean(folder); }
});
