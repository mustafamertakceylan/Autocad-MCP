#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installPackage, installationStatus, readPackage, recoverInstallation, rollbackPackage, uninstallPackage } from './distribution.js';
import { lstat } from 'node:fs/promises';

async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) !== 24) throw Error('Windows x64 and bundled Node 24 required');
  const [mode, ...rest] = process.argv.slice(2), options = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || !rest[i + 1] || options.has(rest[i]!)) throw Error('Invalid options');
    options.set(rest[i]!, rest[i + 1]!);
  }
  const allowed = mode === 'install' ? ['--source', '--plugins-root'] : mode === 'rollback' ? ['--archive', '--plugins-root'] : ['--plugins-root'];
  if ([...options.keys()].some(k => !allowed.includes(k))) throw Error('Unknown option');
  if (!process.env.APPDATA && !options.has('--plugins-root')) throw Error('APPDATA unavailable');
  const root = options.get('--plugins-root') ?? join(process.env.APPDATA!, 'Autodesk/ApplicationPlugins');
  const actualRoot = resolve(root), defaultRoot = resolve(process.env.APPDATA ?? '', 'Autodesk/ApplicationPlugins');
  const customRoot = actualRoot.toLowerCase() !== defaultRoot.toLowerCase();
  const desktop = join(actualRoot, 'AutocadMcp.bundle/Contents/desktop/AutocadMcpDesktop.exe');
  const desktopArgs = customRoot ? ['--state-root', join(actualRoot, '.AutocadMcp/desktop')] : [];
  const nativeDesktop = async (mode: string) => promisify(execFile)(desktop, [mode, ...desktopArgs], { windowsHide: true, timeout: 15000 });
  if (mode === 'open') {
    const manifest = await readPackage(join(actualRoot, 'AutocadMcp.bundle')); if (!manifest.desktop) throw Error('Desktop application is not in this package');
    const child = spawn(desktop, desktopArgs, { detached: true, stdio: 'ignore', windowsHide: false });
    await new Promise<void>((ok, fail) => { child.once('spawn', ok); child.once('error', fail); }); child.unref();
    console.log(JSON.stringify({ started: true })); return;
  }
  if (mode === 'doctor') {
    const state = await installationStatus(root); console.log(JSON.stringify(state));
    if (!state.installed || state.recoveryRequired || state.busy) process.exitCode = 1;
    return;
  }
  if (!['install', 'rollback', 'uninstall', 'recover'].includes(mode ?? '')) throw Error('Usage: setup install --source <AutocadMcp.bundle> [--plugins-root <folder>] | doctor | rollback --archive <archive-id> | recover | uninstall');
  if (mode === 'install') await readPackage(options.get('--source') ?? '');
  // Do not replace files while either a desktop or a Core Console process is running.
  const powershell = join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const { stdout } = await promisify(execFile)(powershell, ['-NoProfile', '-NonInteractive', '-Command', '@(Get-Process -Name acad,accoreconsole -ErrorAction SilentlyContinue).Count'], { windowsHide: true, timeout: 15000 });
  if (stdout.trim() !== '0') throw Error('Close AutoCAD and Core Console before install, rollback or uninstall');
  const desktopProcesses = await promisify(execFile)(powershell, ['-NoProfile', '-NonInteractive', '-Command', '@(Get-Process -Name AutocadMcpDesktop -ErrorAction SilentlyContinue).Count'], { windowsHide: true, timeout: 15000 });
  if (desktopProcesses.stdout.trim() !== '0') throw Error('Exit Autocad MCP from its system tray menu before maintenance');
  if (await lstat(desktop).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return undefined; throw e; })) {
    // Recovery must handle an incomplete active bundle without executing its
    // unverified binary. The process guard above still forbids a running tray.
    if (mode !== 'recover') {
      await readPackage(join(actualRoot, 'AutocadMcp.bundle'));
      try { await nativeDesktop('--maintenance-check'); } catch { throw Error('Exit Autocad MCP from its system tray menu before maintenance'); }
    }
  }
  let result: unknown;
  if (mode === 'install') {
    if (!options.has('--source')) throw Error('Source required');
    result = await installPackage(root, options.get('--source')!);
    if (!customRoot && (await readPackage(join(actualRoot, 'AutocadMcp.bundle'))).desktop) {
      let shortcut = 'created'; try { await nativeDesktop('--register-shortcut'); } catch { shortcut = 'unavailable'; }
      result = { ...result as object, desktopShortcut: shortcut };
    }
  } else if (mode === 'rollback') {
    if (!options.has('--archive')) throw Error('Archive required');
    result = await rollbackPackage(root, options.get('--archive')!);
  } else if (mode === 'recover') result = await recoverInstallation(root);
  else {
    if (!customRoot && await lstat(desktop).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return undefined; throw e; })) {
      await nativeDesktop('--remove-startup'); await nativeDesktop('--unregister-shortcut');
    }
    result = await uninstallPackage(root);
  }
  console.log(JSON.stringify(result));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Setup failed'); process.exitCode = 2; });
}
