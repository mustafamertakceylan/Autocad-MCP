// Read-only release gate. Deliberately does not sign, publish or change repository visibility.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPackage } from '../dist/src/distribution.js';
import { z } from 'zod';

const args = process.argv.slice(2), options = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!['--bundle', '--clean-machine-evidence'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw Error('Usage: check-windows-release --bundle <bundle> [--clean-machine-evidence <json>]');
  options.set(args[i], args[i + 1]);
}
if (process.platform !== 'win32' || !options.has('--bundle')) throw Error('Windows and bundle required');
const bundle = resolve(options.get('--bundle')), manifest = await readPackage(bundle);
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [{ name: 'manifest-integrity', passed: true }, { name: 'test-controls-absent', passed: manifest.nativeTesting === false }];
const ps = join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
for (const relative of ['Contents/Win64/AutocadMcp.arx', 'Contents/server/runtime/node.exe', ...(manifest.desktop ? ['Contents/desktop/AutocadMcpDesktop.exe'] : [])]) {
  const file = join(bundle, relative), quoted = "'" + file.replaceAll("'", "''") + "'";
  let status = 'Unavailable';
  try { status = execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', `(Get-AuthenticodeSignature -LiteralPath ${quoted}).Status.ToString()`], { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PSModulePath: join(dirname(ps), 'Modules') } }).trim(); }
  catch { /* Missing permission, verifier or chain verification is never a pass. */ }
  checks.push({ name: 'signature:' + relative, passed: status === 'Valid', status });
}
const license = await readFile(join(project, 'LICENSE'), 'utf8').catch(e => { if (e.code === 'ENOENT') return ''; throw e; });
const bundledLicense = await readFile(join(bundle, 'LICENSE'), 'utf8').catch(() => '');
checks.push({ name: 'project-license-selected', passed: license.length > 10000 && manifest.projectLicense === 'Apache-2.0' && bundledLicense === license });
checks.push({ name: 'public-channel-authorized', passed: manifest.channel === 'stable' || manifest.channel === 'public-preview' });
const accepted = z.strictObject({ packageId: z.string().regex(/^[a-f0-9]{64}$/), cleanMachine: z.literal(true), automaticBundleLoading: z.literal(true), install: z.literal(true), nativeMcp: z.literal(true), upgrade: z.literal(true), rollback: z.literal(true), uninstall: z.literal(true), personalSettingsUnchanged: z.literal(true) });
let cleanMachine = false;
if (options.has('--clean-machine-evidence')) {
  const content = await readFile(resolve(options.get('--clean-machine-evidence')), 'utf8');
  if (content.length > 65536) throw Error('Acceptance evidence too large');
  const evidence = accepted.safeParse(JSON.parse(content)); cleanMachine = evidence.success && evidence.data.packageId === manifest.packageId;
}
checks.push({ name: 'separate-clean-machine-acceptance', passed: cleanMachine });
const passed = checks.every(check => check.passed);
console.log(JSON.stringify({ passed, packageId: manifest.packageId, checks, publishes: false }, null, 2));
if (!passed) process.exitCode = 1;
