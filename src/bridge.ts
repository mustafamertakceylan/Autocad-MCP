import { connect } from 'node:net';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { authenticate, BridgeError, BRIDGE_VERSION, decodeBody, encodeBody, FrameReader, MAX_FRAME, sign } from './protocol.js';
import { mutating, type ToolName } from './tools.js';

export const grantSchema = z.strictObject({
  bridgeVersion: z.literal(BRIDGE_VERSION), instanceId: z.string().min(1).max(128),
  endpoint: z.string().min(1).max(4096), controlEndpoint: z.string().min(1).max(4096).optional(), secret: z.string().regex(/^[a-f0-9]{64}$/),
  backend: z.enum(['objectarx', 'mock']), expiresAt: z.number().int().positive(), nativeBuildId: z.string().regex(/^[a-f0-9]{64}$|^$/).optional(),
  operations: z.array(z.string().min(1).max(128)).max(64)
});
export type Grant = z.infer<typeof grantSchema>;
function requiredOperations(name:ToolName,params:Record<string,unknown>):string[] {
  return name==='acad_run_batch'?[name,...((params.steps??[]) as Array<{tool:string}>).map(step=>step.tool)]:[name];
}

type PendingCall = {
  grant: Grant; name: ToolName; params: Record<string, unknown>; signal: AbortSignal | undefined;
  resolve: (result: Record<string, unknown>) => void; reject: (error: unknown) => void; abort: () => void;
};

export async function readGrant(path: string): Promise<Grant> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new BridgeError('IPC_AUTH_FAILED', 'Invalid pairing file');
  if (process.platform !== 'win32' && ((stat.mode & 0o077) || stat.uid !== process.getuid?.())) throw new BridgeError('IPC_AUTH_FAILED', 'Pairing file must be private');
  const grant = grantSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  if (grant.controlEndpoint && grant.controlEndpoint !== grant.endpoint + '-control') throw new BridgeError('IPC_AUTH_FAILED', 'Invalid control endpoint');
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
  private readonly queue: PendingCall[] = [];
  private active = false;
  private admitted = 0;
  private controls = 0;
  constructor(private readonly grantFile?: string, private readonly timeoutMs = 10000, private readonly maxPending = 64, private readonly expectedNativeBuildId?: string, private readonly beforeDispatch?: () => Promise<void>) {
    if (!Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > 1024) throw new Error('Invalid queue capacity');
  }
  async call(name: ToolName, params: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    // Reserve before asynchronous file I/O as well as before the native call queue.
    const status = name === 'acad_get_operation_status' || (name as string) === 'bridge.test_probe';
    if (status ? this.controls >= 4 : this.admitted >= this.maxPending) throw new BridgeError('DOC_BUSY', 'Local bridge queue is full');
    if (status) this.controls++; else this.admitted++;
    try {
      if (signal?.aborted) throw new BridgeError('CANCELLED', 'Call cancelled before submission');
      await this.beforeDispatch?.();
      if (!this.grantFile) {
        if (name === 'acad_list_instances') return { instances: [] };
        throw new BridgeError('IPC_UNAVAILABLE', 'No pairing file configured');
      }
      let grant: Grant;
      try { grant = await readGrant(this.grantFile); }
      catch { throw new BridgeError('IPC_AUTH_FAILED', 'Pairing file unavailable or invalid'); }
      if (this.expectedNativeBuildId && grant.nativeBuildId !== this.expectedNativeBuildId) throw new BridgeError('VERSION_MISMATCH', 'Installed server and AutoCAD plugin builds differ; restart and explicitly re-pair');
      if (name === 'acad_list_instances') return { instances: [{ instanceId: grant.instanceId, backend: grant.backend, connected: false, note: 'Paired; use status to verify liveness' }] };
      if (params.instanceId !== grant.instanceId) throw new BridgeError('INSTANCE_NOT_FOUND', 'Instance does not match pairing');
      if (!requiredOperations(name,params).every(operation=>grant.operations.includes(operation))) throw new BridgeError('SECURITY_DENIED', 'Operation not granted');
      if (signal?.aborted) throw new BridgeError('CANCELLED', 'Call cancelled before submission');
      if (status && grant.controlEndpoint) { await this.beforeDispatch?.(); return await this.rpc(grant, name, params, signal, true); }
      return await new Promise<Record<string, unknown>>((resolveResult, reject) => {
        const entry: PendingCall = { grant, name, params, signal, resolve: resolveResult, reject, abort: () => {
          const index = this.queue.indexOf(entry);
          if (index < 0) return; // Started work is handled by rpc(), never claimed undone.
          this.queue.splice(index, 1);
          signal?.removeEventListener('abort', entry.abort);
          reject(new BridgeError('CANCELLED', 'Call cancelled while queued; not sent'));
        } };
        this.queue.push(entry);
        signal?.addEventListener('abort', entry.abort, { once: true });
        this.drain();
      });
    } finally { if (status) this.controls--; else this.admitted--; }
  }

  private drain(): void {
    if (this.active) return;
    const entry = this.queue.shift(); if (!entry) return;
    this.active = true;
    entry.signal?.removeEventListener('abort', entry.abort);
    const finish = () => { this.active = false; this.drain(); };
    void this.dispatch(entry).then(result => { finish(); entry.resolve(result); }, error => { finish(); entry.reject(error); });
  }

  private async dispatch(entry: PendingCall): Promise<Record<string, unknown>> {
    if (entry.signal?.aborted) throw new BridgeError('CANCELLED', 'Call cancelled before sending');
    await this.beforeDispatch?.();
    let current: Grant;
    try { current = await readGrant(this.grantFile!); }
    catch { throw new BridgeError('IPC_AUTH_FAILED', 'Pairing revoked, expired or unavailable'); }
    if (current.instanceId !== entry.grant.instanceId || current.endpoint !== entry.grant.endpoint || current.controlEndpoint !== entry.grant.controlEndpoint || current.secret !== entry.grant.secret || current.backend !== entry.grant.backend || current.nativeBuildId !== entry.grant.nativeBuildId) throw new BridgeError('IPC_AUTH_FAILED', 'Pairing changed while queued');
    if (!requiredOperations(entry.name,entry.params).every(operation=>current.operations.includes(operation))) throw new BridgeError('SECURITY_DENIED', 'Operation grant revoked while queued');
    return this.rpc(current, entry.name, entry.params, entry.signal);
  }

  private async cancel(grant: Grant, params: Record<string, unknown>): Promise<void> {
    if (!grant.controlEndpoint || !this.grantFile) return;
    try {
      const current = await readGrant(this.grantFile);
      if (current.instanceId !== grant.instanceId || current.secret !== grant.secret || current.controlEndpoint !== grant.controlEndpoint) return;
      const { instanceId, documentId, documentEpoch, operationId } = params;
      if (!current.operations.includes('acad_get_operation_status') || !operationId || !documentId || !documentEpoch) return;
      await this.rpc(current, 'bridge.cancel', { instanceId, documentId, documentEpoch, operationId }, undefined, true, 750);
    } catch { /* Cancellation is best effort; only terminal native evidence proves rollback. */ }
  }

  private rpc(grant: Grant, name: ToolName | 'bridge.cancel', params: Record<string, unknown>, signal?: AbortSignal, control = false, timeout = this.timeoutMs): Promise<Record<string, unknown>> {
    return new Promise((resolveResult, reject) => {
      const socket = connect(control ? grant.controlEndpoint! : grant.endpoint); const frames = new FrameReader(); let sent = false; let done = false; let nonce = '';
      const fail = (code: string, message: string) => { if (!done) { done = true; cleanup(); socket.destroy(); reject(new BridgeError(code, message)); } };
      const interrupted = () => fail(sent && mutating.has(name as ToolName) ? 'TIMEOUT_UNKNOWN' : 'IPC_UNAVAILABLE', 'Call interrupted; reconcile mutations before retry');
      const aborted = () => {
        if (sent && mutating.has(name as ToolName)) void this.cancel(grant, params);
        fail(sent && mutating.has(name as ToolName) ? 'TIMEOUT_UNKNOWN' : 'CANCELLED', 'Call cancelled; reconcile sent mutations before retry');
      };
      const timer = setTimeout(interrupted, timeout);
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); };
      if (signal?.aborted) { aborted(); return; }
      signal?.addEventListener('abort', aborted, { once: true });
      socket.on('error', (error: NodeJS.ErrnoException) => fail(sent && mutating.has(name as ToolName) ? 'TIMEOUT_UNKNOWN' : 'IPC_UNAVAILABLE', `Local IPC failed (${error.code ?? 'UNKNOWN'})`));
      socket.on('end', () => { if (!done) interrupted(); });
      socket.on('data', (chunk: Buffer) => {
        try {
          for (const line of frames.push(chunk)) {
            // Outer authenticated envelope has a bounded base64 string, not a drawing string.
            const packet = z.strictObject({ nonce: z.string().regex(/^[a-f0-9]{64}$/), body: z.string().optional(), mac: z.string().optional(), instanceId: z.string().optional(), bridgeVersion: z.string().optional(), nativeBuildId: z.string().optional() }).parse(JSON.parse(line));
            if (!sent) {
              if (packet.body || packet.mac || packet.instanceId !== grant.instanceId || packet.bridgeVersion !== BRIDGE_VERSION) throw new Error('Handshake');
              if (this.expectedNativeBuildId && packet.nativeBuildId !== this.expectedNativeBuildId) return fail('VERSION_MISMATCH', 'AutoCAD plugin build differs from installed server');
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
        } catch { fail(sent && mutating.has(name as ToolName) ? 'TIMEOUT_UNKNOWN' : 'IPC_AUTH_FAILED', 'Invalid or unauthenticated IPC response'); }
      });
    });
  }
}
