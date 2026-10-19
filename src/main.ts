#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { BridgeClient } from './bridge.js';
import { createServer } from './server.js';
import { installedBuildIdentity } from './installed-build.js';

const args = process.argv.slice(2);
if (args.length !== 0 && !(args.length === 2 && args[0] === '--grant-file' && args[1])) {
  process.stderr.write('Usage: autocad-mcp [--grant-file <local-pairing-file>]\n'); process.exit(2);
}
const bridge = new BridgeClient(args[1], 10000, 64, await installedBuildIdentity());
const handle = serveStdio(() => createServer(bridge), { onerror: () => { process.stderr.write('MCP transport error\n'); } });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void handle.close(); });
