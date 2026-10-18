import { createServer, type Server, type Socket } from 'node:net';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, chmod, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { authenticate, decodeBody, encodeBody, FrameReader, sign } from '../src/protocol.js';
import { toolNames, type ToolName } from '../src/tools.js';
import type { Grant } from '../src/bridge.js';

// Only remove the private directory this fixture created directly inside TEMP.
export async function cleanupFixture(folder: string): Promise<void> {
  const actual = await realpath(folder);
  if (dirname(actual) !== await realpath(tmpdir()) || !/^autocad-mcp-test-[A-Za-z0-9]+$/.test(basename(actual))) throw new Error('Unsafe fixture cleanup path');
  await rm(actual, { recursive: true });
}

export async function mockPlugin(options: { wrongSignature?: boolean; hang?: boolean } = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'autocad-mcp-test-')); await chmod(folder, 0o700);
  const key = randomBytes(16).toString('hex');
  const grant: Grant = { bridgeVersion: '0.1.0', instanceId: 'mock-' + key, endpoint: process.platform === 'win32' ? `\\\\.\\pipe\\autocad-mcp-${key}` : join(folder, 'bridge.sock'), secret: randomBytes(32).toString('hex'), backend: 'mock', expiresAt: Date.now() + 60000, operations: toolNames };
  const sockets = new Set<Socket>(); let calls = 0; let mutations = 0;
  const records = new Map<string, { fingerprint: string; result: object }>();
  const server: Server = createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    const nonce = randomBytes(32).toString('hex'); const frames = new FrameReader();
    socket.write(JSON.stringify({ nonce, instanceId: grant.instanceId, bridgeVersion: '0.1.0' }) + '\n');
    socket.on('data', (chunk: Buffer) => {
      try {
        for (const line of frames.push(chunk)) {
          const p = JSON.parse(line) as { nonce: string; body: string; mac: string };
          if (p.nonce !== nonce || !authenticate(sign(grant.secret, 'request', nonce, p.body), p.mac)) { socket.destroy(); return; }
          const req = decodeBody(p.body) as { method: ToolName; params: Record<string, unknown> }; calls++;
          if (options.hang) return;
          let result: object = { backend: 'mock', simulation: true, connected: true, instanceId: grant.instanceId };
          if (req.method === 'acad_list_documents') result = { documents: [{ documentId: 'doc-1', documentEpoch: 1, revision: mutations, insunits: 4 }] };
          if (req.method.startsWith('acad_create_')) {
            const op = String(req.params.operationId); const fingerprint = JSON.stringify(req.params);
            const old = records.get(op);
            if (old) result = old.fingerprint === fingerprint ? old.result : { error: { code: 'IDEMPOTENCY_CONFLICT' } };
            else if (req.params.expectedRevision !== mutations) result = { error: { code: 'STALE_REVISION' } };
            else { mutations++; result = { backend: 'mock', simulation: true, status: 'succeeded', applied: true, verified: true, revision: mutations, created: [{ documentId: 'doc-1', documentEpoch: 1, handle: mutations.toString(16) }] }; records.set(op, { fingerprint, result }); }
          }
          const body = encodeBody({ jsonrpc: '2.0', id: 1, result });
          socket.end(JSON.stringify({ nonce, body, mac: options.wrongSignature ? '0'.repeat(64) : sign(grant.secret, 'response', nonce, body) }) + '\n');
        }
      } catch { socket.destroy(); }
    });
  });
  await new Promise<void>((ok, fail) => { server.once('error', fail); server.listen(grant.endpoint, ok); });
  const grantFile = join(folder, 'pairing.json'); await writeFile(grantFile, JSON.stringify(grant), { mode: 0o600 });
  return { grant, grantFile, folder, calls: () => calls, mutations: () => mutations, close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>(ok => server.close(() => ok())); } };
}
