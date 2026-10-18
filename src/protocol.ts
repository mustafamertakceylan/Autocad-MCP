import { createHmac, timingSafeEqual } from 'node:crypto';

export const BRIDGE_VERSION = '0.1.0';
export const MAX_FRAME = 1024 * 1024;
export const MAX_BODY = 512 * 1024;

export class BridgeError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

// Validate before JSON.parse: duplicate keys otherwise disappear silently.
export function parseJson(text: string, maxBytes = MAX_BODY): unknown {
  if (Buffer.byteLength(text) > maxBytes) throw new BridgeError('VALIDATION_FAILED', 'Message too large');
  let pos = 0;
  const ws = () => { while (/\s/.test(text[pos] ?? '') && pos < text.length) pos++; };
  function string(): string {
    const start = pos++;
    while (pos < text.length) {
      const ch = text[pos++];
      if (ch === '\\') { pos++; continue; }
      if (ch === '"') {
        const value: unknown = JSON.parse(text.slice(start, pos));
        if (typeof value !== 'string' || Buffer.byteLength(value) > 4096) throw new Error('String limit');
        return value;
      }
    }
    throw new Error('Unterminated string');
  }
  function value(depth: number): void {
    if (depth > 8) throw new Error('Depth limit');
    ws();
    const ch = text[pos];
    if (ch === '"') { string(); return; }
    if (ch === '{' || ch === '[') {
      const object = ch === '{'; const close = object ? '}' : ']';
      const keys = new Set<string>(); pos++; ws(); let count = 0;
      if (text[pos] === close) { pos++; return; }
      for (;;) {
        if (++count > 1000) throw new Error('Container limit');
        ws();
        if (object) {
          if (text[pos] !== '"') throw new Error('Object key');
          const key = string();
          if (keys.has(key)) throw new Error('Duplicate key');
          keys.add(key); ws();
          if (text[pos++] !== ':') throw new Error('Missing colon');
        }
        value(depth + 1); ws();
        if (text[pos] === close) { pos++; return; }
        if (text[pos++] !== ',') throw new Error('Missing comma');
      }
    }
    const start = pos;
    while (pos < text.length && !/[\s,\]}]/.test(text[pos]!)) pos++;
    if (start === pos) throw new Error('Missing value');
    const token: unknown = JSON.parse(text.slice(start, pos));
    if (typeof token === 'number' && !Number.isFinite(token)) throw new Error('Nonfinite number');
  }
  try { value(0); ws(); if (pos !== text.length) throw new Error('Trailing data'); return JSON.parse(text); }
  catch { throw new BridgeError('VALIDATION_FAILED', 'Invalid or unsafe JSON'); }
}

export class FrameReader {
  private pending = Buffer.alloc(0);
  constructor(private readonly limit = MAX_FRAME) {}
  push(chunk: Buffer): string[] {
    const output: string[] = [];
    // Bound each frame before concatenation, including un-terminated input.
    let offset = 0;
    while (offset < chunk.length) {
      const lf = chunk.indexOf(10, offset);
      const end = lf < 0 ? chunk.length : lf;
      if (this.pending.length + end - offset > this.limit) throw new BridgeError('VALIDATION_FAILED', 'Frame limit');
      this.pending = Buffer.concat([this.pending, chunk.subarray(offset, end)]);
      if (lf < 0) break;
      try { output.push(new TextDecoder('utf-8', { fatal: true }).decode(this.pending)); }
      catch { throw new BridgeError('VALIDATION_FAILED', 'Invalid UTF-8'); }
      this.pending = Buffer.alloc(0); offset = end + 1;
    }
    return output;
  }
}

export function sign(secret: string, direction: 'request' | 'response', nonce: string, body: string): string {
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(`${direction}\n${nonce}\n${body}`).digest('hex');
}

export function authenticate(expected: string, supplied: string): boolean {
  return /^[a-f0-9]{64}$/.test(supplied) && timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

export function encodeBody(value: unknown): string {
  const text = JSON.stringify(value);
  parseJson(text);
  return Buffer.from(text).toString('base64');
}

export function decodeBody(body: string): unknown {
  if (body.length > Math.ceil(MAX_BODY / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body)) {
    throw new BridgeError('VALIDATION_FAILED', 'Invalid encoded body');
  }
  const bytes = Buffer.from(body, 'base64');
  if (bytes.toString('base64') !== body) throw new BridgeError('VALIDATION_FAILED', 'Noncanonical encoded body');
  try { return parseJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new BridgeError('VALIDATION_FAILED', 'Invalid body'); }
}
