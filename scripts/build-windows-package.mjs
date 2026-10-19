// Maintainer-only offline builder. Consumers need neither npm nor a compiler.
import { cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inventory, packageIdentity, readPackage, sha256 } from '../dist/src/distribution.js';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), options = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!['--native-build', '--output', '--node-license', '--channel'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw Error('Usage: build-windows-package --native-build <build> --output <new-folder> --node-license <Node LICENSE> [--channel private-preview|public-preview|stable]');
  options.set(args[i], args[i + 1]);
}
if (!['--native-build', '--output', '--node-license'].every(key => options.has(key)) || process.platform !== 'win32' || process.arch !== 'x64' || !/^v24\./.test(process.version)) throw Error('Windows x64 / Node 24 and all three options required');
const channel = options.get('--channel') ?? 'private-preview';
if (!['private-preview', 'public-preview', 'stable'].includes(channel)) throw Error('Unsupported package channel');
const build = resolve(options.get('--native-build')), output = resolve(options.get('--output'));
const native = join(build, 'Release/AutocadMcp.arx'), provenance = JSON.parse(await readFile(native + '.json', 'utf8'));
const desktop = join(build, 'Release/AutocadMcpDesktop.exe'), desktopProvenance = JSON.parse(await readFile(desktop + '.json', 'utf8'));
const pkg = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
if (pkg.license !== 'Apache-2.0') throw Error('Selected Apache-2.0 license required');
const projectLicense = await readFile(join(project, 'LICENSE'), 'utf8'), projectNotice = await readFile(join(project, 'NOTICE'), 'utf8');
if (!projectLicense.includes('Apache License') || projectLicense.length < 10000 || !projectNotice.includes('Autocad MCP')) throw Error('Complete project license and notice required');
if (provenance.testing !== false || provenance.platform !== 'win32' || provenance.arch !== 'x64' || provenance.autocad !== '2027' || provenance.version !== pkg.version || !/^[a-f0-9]{64}$/.test(provenance.buildId) || provenance.sha256 !== sha256(await readFile(native))) throw Error('Normal native build provenance required; never package test controls');
if (desktopProvenance.testing !== false || desktopProvenance.version !== pkg.version || desktopProvenance.sha256 !== sha256(await readFile(desktop))) throw Error('Desktop build provenance required');
const license = await readFile(resolve(options.get('--node-license')), 'utf8');
if (!license.startsWith('Node.js is licensed for use as follows:') || license.length < 50000) throw Error('Complete Node LICENSE, including bundled dependencies, required');
const nativeLicense = await readFile(join(project, 'third-party/nlohmann-json-LICENSE.MIT'), 'utf8');
if (sha256(nativeLicense) !== '46a65cffd1ea955132d95a8dd921640714a8d6b537d2e4e482d31145ae95b603') throw Error('Pinned native dependency license required');
const cache = await readFile(join(build, 'CMakeCache.txt'), 'utf8'), jsonPath = cache.match(/^JSON_INCLUDE_DIR:PATH=(.+)$/m)?.[1]?.trim();
if (!jsonPath) throw Error('Native dependency location not recorded');
const jsonHeader = await readFile(join(jsonPath, 'json.hpp'), 'utf8');
if (sha256(jsonHeader) !== 'aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63') throw Error('Pinned native JSON header required');
const copyrights = [...new Set([...jsonHeader.matchAll(/SPDX-FileCopyrightText: (.+)/g)].map(match => 'Copyright ' + match[1].trim()))].sort();
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // A build never overwrites an earlier candidate.
const bundle = join(output, 'AutocadMcp.bundle'), server = join(bundle, 'Contents/server');
await mkdir(join(bundle, 'Contents/Win64'), { recursive: true }); await mkdir(join(server, 'runtime'), { recursive: true });
await cp(native, join(bundle, 'Contents/Win64/AutocadMcp.arx'), { errorOnExist: true, force: false });
await mkdir(join(bundle, 'Contents/desktop')); await cp(desktop, join(bundle, 'Contents/desktop/AutocadMcpDesktop.exe'), { errorOnExist: true, force: false });
await cp(process.execPath, join(server, 'runtime/node.exe'), { errorOnExist: true, force: false });
await writeFile(join(server, 'runtime/LICENSE'), license, { flag: 'wx' });
await mkdir(join(server, 'dist/src'), { recursive: true });
for (const name of (await readdir(join(project, 'dist/src'))).filter(n => n.endsWith('.js'))) {
  await cp(join(project, 'dist/src', name), join(server, 'dist/src', name), { errorOnExist: true, force: false });
}
await cp(join(project, 'skills/autocad-mcp'), join(server, 'skills/autocad-mcp'), { recursive: true, errorOnExist: true, force: false, dereference: false });
await writeFile(join(server, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, private: true, type: 'module', license: pkg.license, autocadMcpDistribution: 1 }, null, 2), { flag: 'wx' });
await writeFile(join(server, 'native-build.json'), JSON.stringify({ nativeBuildId: provenance.buildId }), { flag: 'wx' });
const lock = JSON.parse(await readFile(join(project, 'package-lock.json'), 'utf8')), dependencies = [];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev || entry.optional) continue;
  if (!path.startsWith('node_modules/') || entry.link) throw Error('Unsupported dependency layout');
  const source = join(project, path), installed = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  if (installed.version !== entry.version || (await lstat(source)).isSymbolicLink()) throw Error('Dependency differs from lockfile');
  await cp(source, join(server, path), { recursive: true, errorOnExist: true, force: false, dereference: false });
  const licenses = (await readdir(source)).filter(n => /^(license|licence|notice)(\.|$)/i.test(n));
  if (!licenses.length) throw Error('Dependency license missing: ' + installed.name);
  dependencies.push({ name: installed.name, version: installed.version, license: installed.license, integrity: entry.integrity, notices: licenses.map(n => path + '/' + n) });
}
// Fail on missing transitive modules. Never run dependency lifecycle scripts or fetch here.
execFileSync(join(server, 'runtime/node.exe'), ['--input-type=module', '-e', "await import('./dist/src/server.js'); await import('./dist/src/setup.js');"], { cwd: server, windowsHide: true, timeout: 20000, stdio: 'pipe' });
const versionParts = pkg.version.split('.');
const productCode = '{' + sha256(pkg.version).slice(0, 8) + '-AF36-4A27-923B-' + sha256(pkg.version).slice(8, 20) + '}';
const xml = `<?xml version="1.0" encoding="utf-8"?>
<ApplicationPackage SchemaVersion="1.0" AutodeskProduct="AutoCAD" Name="Autocad MCP" Description="Local MCP bridge for full AutoCAD 2027" AppVersion="${versionParts.join('.')}" ProductCode="${productCode}" UpgradeCode="{99DE4BC9-FD6B-45A4-B146-7ED0260ED846}">
  <Components>
    <RuntimeRequirements OS="Win64" Platform="AutoCAD" SeriesMin="R26.0" SeriesMax="R26.0" />
    <ComponentEntry AppName="AutocadMcp" Version="${pkg.version}" ModuleName="./Contents/Win64/AutocadMcp.arx" AppDescription="Local MCP bridge" LoadOnAutoCADStartup="True" LoadOnAppearance="False" LoadOnCommandInvocation="False">
      <Commands GroupName="AUTOCADMCP"><Command Global="MCPSTART" Local="MCPSTART" /><Command Global="MCPSTOP" Local="MCPSTOP" /></Commands>
    </ComponentEntry>
  </Components>
</ApplicationPackage>
`;
await writeFile(join(bundle, 'PackageContents.xml'), xml, { flag: 'wx' });
await writeFile(join(bundle, 'THIRD_PARTY.json'), JSON.stringify({ node: { version: process.version, license: 'Contents/server/runtime/LICENSE', source: `https://github.com/nodejs/node/blob/${process.version}/LICENSE` }, dependencies, native: provenance, projectLicense: pkg.license, distribution: 'No SDK, Autodesk host DLLs or signing certificate included. A candidate is not a verified signed release.' }, null, 2), { flag: 'wx' });
await writeFile(join(bundle, 'LICENSE'), projectLicense, { flag: 'wx' });
await writeFile(join(bundle, 'NOTICE'), projectNotice, { flag: 'wx' });
await mkdir(join(bundle, 'Licenses'));
await writeFile(join(bundle, 'Licenses/nlohmann-json.txt'), 'nlohmann/json 3.12.0 and embedded MIT components\nSource: https://github.com/nlohmann/json/tree/v3.12.0\n\n' + copyrights.join('\n') + '\n\n' + nativeLicense, { flag: 'wx' });
await writeFile(join(bundle, 'README.txt'), `Autocad MCP ${pkg.version} - Windows x64 / full AutoCAD 2027\r\nApache-2.0. Channel: ${channel}.\r\nPublic previews are UNSIGNED; separate clean-machine acceptance is NOT completed.\r\nSee WINDOWS_KURULUM.md alongside this bundle.\r\n`, { flag: 'wx' });
const content = { format: 1, product: 'autocad-mcp', version: pkg.version, bridgeVersion: '0.1.0', channel, platform: 'win32', arch: 'x64', autocad: '2027', series: 'R26.0', nativeTesting: false, nativeBuildId: provenance.buildId, nodeVersion: process.version, projectLicense: pkg.license, desktop: true, files: await inventory(bundle) };
const forbidden = /(?:^|\/)(?:pairing\.json|autocad-session\.json|auth\.json|\.env(?:\..*)?|\.npmrc|[^/]+\.(?:key|pem|pfx|p12|dwg|dwt|pdf|log))$/i;
if (content.files.some(file => forbidden.test(file.path))) throw Error('Private/runtime/drawing material cannot be distributed');
const manifest = { ...content, packageId: packageIdentity(content) };
await writeFile(join(bundle, 'package-manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
await readPackage(bundle);
await cp(join(project, 'docs/WINDOWS_KURULUM.md'), join(output, 'WINDOWS_KURULUM.md'), { errorOnExist: true, force: false });
await writeFile(join(output, 'setup.cmd'), '@echo off\r\n"%~dp0AutocadMcp.bundle\\Contents\\server\\runtime\\node.exe" "%~dp0AutocadMcp.bundle\\Contents\\server\\dist\\src\\setup.js" %*\r\n', { flag: 'wx' });
await writeFile(join(output, 'install.cmd'), '@echo off\r\n"%~dp0AutocadMcp.bundle\\Contents\\server\\runtime\\node.exe" "%~dp0AutocadMcp.bundle\\Contents\\server\\dist\\src\\setup.js" install --source "%~dp0AutocadMcp.bundle"\r\nif errorlevel 1 pause\r\n', { flag: 'wx' });
await writeFile(join(output, 'Autocad MCP.cmd'), '@echo off\r\n"%~dp0AutocadMcp.bundle\\Contents\\server\\runtime\\node.exe" "%~dp0AutocadMcp.bundle\\Contents\\server\\dist\\src\\setup.js" open\r\nif errorlevel 1 pause\r\n', { flag: 'wx' });
const archive = output + '.zip';
if (await lstat(archive).then(() => true).catch(e => { if (e.code === 'ENOENT') return false; throw e; })) throw Error('Refusing to overwrite archive');
// Built-in Windows bsdtar supports ZIP; no PowerShell execution policy change is needed.
execFileSync(join(process.env.SystemRoot ?? 'C:/Windows', 'System32/tar.exe'), ['-a', '-c', '-f', archive, '-C', output, '.'], { windowsHide: true, timeout: 120000, stdio: 'pipe', encoding: 'utf8' });
await writeFile(archive + '.sha256', sha256(await readFile(archive)) + '  ' + archive.split(/[\\/]/).at(-1) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, archive, packageId: manifest.packageId, files: manifest.files.length, channel: manifest.channel, signed: false }));
