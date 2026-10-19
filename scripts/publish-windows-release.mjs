// Maintainer-only, explicit unsigned-preview publication; never called by setup/build.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { join, resolve, basename, dirname } from 'node:path';
import { readPackage, sha256 } from '../dist/src/distribution.js';

const repo = 'mustafamertakceylan/Autocad-MCP';
const args = process.argv.slice(2), options = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!['--bundle', '--notes', '--target', '--profile'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw Error('Explicit bundle/notes/target/profile required');
  options.set(args[i], args[i + 1]);
}
if (options.size !== 4 || options.get('--profile') !== 'unsigned-preview' || !/^[a-f0-9]{40}$/.test(options.get('--target'))) throw Error('Only explicitly authorized unsigned-preview publication is supported');
const bundle = resolve(options.get('--bundle')), notes = resolve(options.get('--notes')), target = options.get('--target');
const manifest = await readPackage(bundle), archive = dirname(bundle) + '.zip', tag = 'v' + manifest.version;
if (manifest.channel !== 'public-preview' || manifest.projectLicense !== 'Apache-2.0') throw Error('Public preview and selected license required');
const noteText = await readFile(notes, 'utf8');
if (!noteText.includes('UNSIGNED') || !noteText.includes('clean-machine') || !noteText.includes('imzasız')) throw Error('Unsigned and clean-machine limits must be disclosed in both languages');
const run = (cmd, values) => execFileSync(cmd, values, { encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
if (run('git', ['rev-parse', 'HEAD']).trim() !== target || run('git', ['status', '--porcelain']).trim()) throw Error('Clean committed target required');
if (run('git', ['rev-parse', 'origin/main']).trim() !== target) throw Error('Push main before release');
const checked = spawnSync(process.execPath, ['scripts/check-windows-release.mjs', '--bundle', bundle], { encoding: 'utf8', windowsHide: true, timeout: 90000 });
if (checked.error || ![0, 1].includes(checked.status)) throw Error('Release verification did not complete');
const gate = JSON.parse(checked.stdout);
const waivedNames = ['signature:Contents/Win64/AutocadMcp.arx', 'signature:Contents/desktop/AutocadMcpDesktop.exe', 'separate-clean-machine-acceptance'];
const failed = gate.checks.filter(check => !check.passed);
if (gate.packageId !== manifest.packageId || failed.some(check => !waivedNames.includes(check.name) || (check.name.startsWith('signature:') && check.status !== 'NotSigned'))) throw Error('Non-waivable verification failed');
const zipHash = sha256(await readFile(archive)), sidecar = archive + '.sha256';
if ((await readFile(sidecar, 'utf8')).trim() !== zipHash + '  ' + basename(archive)) throw Error('Archive checksum mismatch');
if (JSON.parse(run('gh', ['repo', 'view', repo, '--json', 'visibility'])).visibility !== 'PUBLIC') throw Error('Explicitly public repository required');
const evidenceRoot = resolve('tmp/release-publication'); await mkdir(evidenceRoot, { recursive: true });
const evidence = await mkdtemp(join(evidenceRoot, manifest.version + '-'));
const remote = ['--repo', repo];
run('gh', ['release', 'create', tag, archive, sidecar, ...remote, '--target', target, '--draft', '--title', 'Autocad MCP ' + tag, '--notes-file', notes]);
run('gh', ['release', 'download', tag, ...remote, '--pattern', basename(archive), '--dir', evidence]);
if (sha256(await readFile(join(evidence, basename(archive)))) !== zipHash) throw Error('Uploaded draft asset hash mismatch; draft left for inspection');
run('gh', ['release', 'edit', tag, ...remote, '--draft=false', '--latest']);
const release = JSON.parse(run('gh', ['release', 'view', tag, ...remote, '--json', 'url,isDraft,tagName,targetCommitish']));
if (release.isDraft || release.tagName !== tag || release.targetCommitish !== target) throw Error('Published release identity mismatch');
const after = join(evidence, 'published'); await mkdir(after);
run('gh', ['release', 'download', tag, ...remote, '--pattern', basename(archive), '--dir', after]);
if (sha256(await readFile(join(after, basename(archive)))) !== zipHash) throw Error('Published asset hash mismatch');
const result = { ...release, packageId: manifest.packageId, zipSha256: zipHash, profile: 'unsigned-preview', strictGatePassed: gate.passed, waivedChecks: failed.map(check => check.name), cleanMachine: false, signed: false, publishedAssetHashVerified: true };
await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, evidence }, null, 2));
