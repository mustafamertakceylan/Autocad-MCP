import { connect } from 'node:net';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { authenticate, BridgeError, BRIDGE_VERSION, decodeBody, encodeBody, FrameReader, MAX_FRAME, sign } from './protocol.js';
import { mutating, type ToolName } from './tools.js';

export const grantSchema = z.strictObject({
  bridgeVersion: z.literal(BRIDGE_VERSION), instanceId: z.string().min(1).max(128),
  endpoint: z.string().min(1).max(4096), secret: z.string().regex(/^[a-f0-9]{64}$/),
  backend: z.enum(['objectarx', 'mock']), expiresAt: z.number().int().positive(),
  operations: z.array(z.string()).max(32)
});
export type Grant = z.infer<typeof grantSchema>;

export async function readGrant(path: string): Promise<Grant> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new BridgeError('IPC_AUTH_FAILED', 'Invalid pairing file');
  if (process.platform !== 'win32' && ((stat.mode & 0o077) || stat.uid !== process.getuid?.())) throw new BridgeError('IPC_AUTH_FAILED', 'Pairing file must be private');
  const grant = grantSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  if (grant.expiresAt <= Date.now()) throw new BridgeError('IPC_AUTH_FAILED', 'Pairing expired');
  if (process.platform === 'win32') {
    if (!/^\\\\\.\\pipe\\autocad-mcp-[a-zA-Z0-9_-]{1,128}$/.test(grant.endpoint)) throw new BridgeError('IPC_AUTH_FAILED', 'Invalid local pipe');
  } else {
    if (!isAbsolute(grant.endpoint) || resolve(dirname(grant.endpoint)) !== await realpath(dirname(path))) throw new BridgeError('IPC_AUTH_FAILED', 'Socket must be inside pairing directory');
    const dirStat = await lstat(dirname(path));
    if (dirStat.isSymbolicLink() || (dirStat.mode & 0o077) || dirStat.uid !== process.getuid?.()) throw new BridgeError('IPC_AUTH_FAILED', 'Pairing directory must be private');
  }
  return grant;
}

export class BridgeClient {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly grantFile?: string, private readonly timeoutMs = 10000) {}
  async call(name: ToolName, params: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    if (!this.grantFile) {
      if (name === 'acad_list_instances') return { instances: [] };
      throw new BridgeError('IPC_UNAVAILABLE', 'No pairing file configured');
    }
    let grant: Grant;
    try { grant = await readGrant(this.grantFile); }
    catch { throw new BridgeError('IPC_AUTH_FAILED', 'Pairing file unavailable or invalid'); }
    if (name === 'acad_list_instances') return { instances: [{ instanceId: grant.instanceId, backend: grant.backend, connected: false, note: 'Paired; use status to verify liveness' }] };
    if (params.instanceId !== grant.instanceId) throw new BridgeError('INSTANCE_NOT_FOUND', 'Instance does not match pairing');
    if (!grant.operations.includes(name)) throw new BridgeError('SECURITY_DENIED', 'Operation not granted');
    // One in-flight native call per bridge, without replaying failed mutations.
    const next = this.tail.then(() => this.rpc(grant, name, params, signal));
    this.tail = next.catch(() => undefined);
    return next;
  }

  private rpc(grant: Grant, name: ToolName, params: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    return new Promise((resolveResult, reject) => {
      const socket = connect(grant.endpoint); const frames = new FrameReader(); let sent = false; let done = false; let nonce = '';
      const fail = (code: string, message: string) => { if (!done) { done = true; cleanup(); socket.destroy(); reject(new BridgeError(code, message)); } };
      const interrupted = () => fail(sent && mutating.has(name) ? 'TIMEOUT_UNKNOWN' : 'IPC_UNAVAILABLE', 'Call interrupted; reconcile mutations before retry');
      const timer = setTimeout(interrupted, this.timeoutMs);
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', interrupted); };
      if (signal?.aborted) { interrupted(); return; }
      signal?.addEventListener('abort', interrupted, { once: true });
      socket.on('error', (error: NodeJS.ErrnoException) => fail(sent && mutating.has(name) ? 'TIMEOUT_UNKNOWN' : 'IPC_UNAVAILABLE', `Local IPC failed (${error.code ?? 'UNKNOWN'})`));
      socket.on('end', () => { if (!done) interrupted(); });
      socket.on('data', (chunk: Buffer) => {
        try {
          for (const line of frames.push(chunk)) {
            // Outer authenticated envelope has a bounded base64 string, not a drawing string.
            const packet = z.strictObject({ nonce: z.string().regex(/^[a-f0-9]{64}$/), body: z.string().optional(), mac: z.string().optional(), instanceId: z.string().optional(), bridgeVersion: z.string().optional() }).parse(JSON.parse(line));
            if (!sent) {
              if (packet.body || packet.mac || packet.instanceId !== grant.instanceId || packet.bridgeVersion !== BRIDGE_VERSION) throw new Error('Handshake');
              nonce = packet.nonce;
              const body = encodeBody({ jsonrpc: '2.0', id: 1, method: name, params });
              const request = JSON.stringify({ nonce, body, mac: sign(grant.secret, 'request', nonce, body) });
              if (Buffer.byteLength(request) > MAX_FRAME) throw new Error('Frame');
              sent = true; socket.write(request + '\n');
            } else {
              if (packet.nonce !== nonce || !packet.body || !packet.mac || !authenticate(sign(grant.secret, 'response', nonce, packet.body), packet.mac)) throw new Error('Authentication');
              const response = z.strictObject({ jsonrpc: z.literal('2.0'), id: z.literal(1), result: z.record(z.string(), z.unknown()) }).parse(decodeBody(packet.body));
              done = true; cleanup(); socket.destroy(); resolveResult(response.result);
            }
          }
        } catch { fail(sent && mutating.has(name) ? 'TIMEOUT_UNKNOWN' : 'IPC_AUTH_FAILED', 'Invalid or unauthenticated IPC response'); }
      });
    });
  }
}
