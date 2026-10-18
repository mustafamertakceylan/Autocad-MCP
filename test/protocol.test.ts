import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, decodeBody, encodeBody, FrameReader, parseJson, sign } from '../src/protocol.js';
import { validateTool } from '../src/tools.js';

test('frames preserve split UTF-8 and multiple messages, reject oversize/invalid bytes', () => {
  const reader = new FrameReader(20); const bytes = Buffer.from('"çizgi"\n{}\n');
  assert.deepEqual(reader.push(bytes.subarray(0, 2)), []);
  assert.deepEqual(reader.push(bytes.subarray(2)), ['"çizgi"', '{}']);
  assert.throws(() => new FrameReader(2).push(Buffer.from('abc')));
  assert.throws(() => new FrameReader().push(Buffer.from([0xff, 10])));
});

test('strict parsing rejects duplicate keys, nonfinite, deep input and oversized strings', () => {
  for (const input of ['{"x":1,"x":2}', '{"a":{"x":1,"x":2}}', '{"x":1e400}', '[NaN]', '{"x":1,}', '[] trailing', '['.repeat(10) + '0' + ']'.repeat(10), JSON.stringify('x'.repeat(4097))]) assert.throws(() => parseJson(input));
  assert.deepEqual(parseJson('{"a":[true,null,"escaped\\\"key",12.3]}'), { a: [true, null, 'escaped"key', 12.3] });
});

test('authenticated bodies bind direction, nonce and exact content', () => {
  const secret = '11'.repeat(32); const body = encodeBody({ hello: 'çizim' });
  assert.equal(sign(secret, 'request', 'n', 'b'), '3d8ba0be75f71c50cd186850757b5069149f49d9bf693aa25a0df49777356f2d');
  assert.deepEqual(decodeBody(body), { hello: 'çizim' });
  const mac = sign(secret, 'request', 'nonce', body);
  assert.equal(authenticate(mac, mac), true);
  assert.equal(authenticate(mac, sign(secret, 'response', 'nonce', body)), false);
  assert.equal(authenticate(mac, 'short'), false);
  assert.throws(() => decodeBody('not base64!'));
  assert.throws(() => decodeBody('Zh=='));
});

const base = { instanceId: 'inst', documentId: 'doc', documentEpoch: 1, expectedRevision: 0, operationId: 'op', coordinateSystem: 'WCS', lengthUnit: 'mm' };
test('mutations require explicit target, units, revision and valid geometry', () => {
  const line = { ...base, start: [0, 0, 0], end: [100, 0, 0] };
  assert.deepEqual(validateTool('acad_create_line', line), line);
  for (const field of ['instanceId', 'documentEpoch', 'expectedRevision', 'operationId', 'coordinateSystem', 'lengthUnit']) { const broken: Record<string, unknown> = { ...line }; delete broken[field]; assert.throws(() => validateTool('acad_create_line', broken)); }
  assert.throws(() => validateTool('acad_create_line', { ...line, end: [0, 0, 0] }));
  assert.throws(() => validateTool('acad_create_box', { ...base, center: [0, 0, 0], size: [1, -1, 1] }));
  assert.throws(() => validateTool('acad_create_circle', { ...base, center: [0, 0, 0], radius: 1, normal: [1, 0, 0] }));
  assert.throws(() => validateTool('acad_create_line', { ...line, command: 'unsafe' }));
});

test('cross-document references, duplicate targets and unsafe output paths are rejected', () => {
  const ref = { documentId: 'doc', documentEpoch: 1, handle: 'AA' };
  assert.throws(() => validateTool('acad_move_entities', { ...base, delta: [1, 0, 0], targets: [ref, { ...ref, handle: 'aa' }] }));
  assert.throws(() => validateTool('acad_move_entities', { ...base, delta: [1, 0, 0], targets: [{ ...ref, documentId: 'other' }] }));
  const { coordinateSystem: _cs, lengthUnit: _u, ...mutation } = base;
  for (const relativePath of ['../other.dwg', '/absolute.dwg', 'C:\\other.dwg', 'a.dwg:stream', 'folder/../a.dwg', 'folder/a.dwg', 'a.txt', 'a /b.dwg', 'CON.dwg', 'a?.dwg']) assert.throws(() => validateTool('acad_save_copy', { ...mutation, outputRootId: 'out', relativePath, overwrite: false }));
  assert.equal(validateTool('acad_save_copy', { ...mutation, outputRootId: 'out', relativePath: 'copy.dwg', overwrite: false }).relativePath, 'copy.dwg');
});
