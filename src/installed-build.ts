import { readFile } from 'node:fs/promises';
import { z } from 'zod';

export async function installedBuildIdentity(): Promise<string | undefined> {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  if (pkg.autocadMcpDistribution !== 1) return undefined; // Source checkout, not an installed distribution.
  // A missing/corrupt identity in a distribution fails closed, never becomes developer mode.
  return z.strictObject({ nativeBuildId: z.string().regex(/^[a-f0-9]{64}$/) }).parse(JSON.parse(await readFile(new URL('../../native-build.json', import.meta.url), 'utf8'))).nativeBuildId;
}
