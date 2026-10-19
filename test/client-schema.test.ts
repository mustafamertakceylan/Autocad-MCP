import assert from 'node:assert/strict';
import test from 'node:test';
import { clientInputSchema, compatibleJsonSchema } from '../src/client-schema.js';
import { toolNames, toolSchemas } from '../src/tools.js';

test('client-facing schemas retain numeric point types and expose typed union fields', () => {
  for (const name of toolNames) {
    const schema = clientInputSchema(toolSchemas[name])['~standard'].jsonSchema.input() as any;
    assert.equal(schema.type, 'object', name);
    assert.ok(schema.properties, name);
    assert.equal(schema.oneOf, undefined, name);
    assert.ok(!JSON.stringify(schema).includes('prefixItems'), name);
  }
  const line = clientInputSchema(toolSchemas.acad_create_line)['~standard'].jsonSchema.input() as any;
  assert.deepEqual(line.properties.start, { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 });
  const style = clientInputSchema(toolSchemas.acad_create_style)['~standard'].jsonSchema.input() as any;
  assert.equal(style.properties.documentEpoch.type, 'integer');
  assert.equal(style.properties.expectedRevision.type, 'integer');
  assert.equal(style.properties.dashes.type, 'array');
  assert.equal(style.properties.dashes.items.type, 'number');
  assert.deepEqual(style.properties.kind.enum, ['text', 'dimension', 'linetype']);
  const batch = clientInputSchema(toolSchemas.acad_run_batch)['~standard'].jsonSchema.input() as any;
  assert.equal(batch.properties.steps.items.properties.start.items.type, 'number');
  assert.equal(batch.properties.steps.items.properties.closed.type, 'boolean');
});

test('presentation compatibility never coerces types or loosens original variant validation', async () => {
  const base = { instanceId: 'inst-test', documentId: 'doc-test', documentEpoch: 1,
    operationId: 'op-test', expectedRevision: 0, kind: 'text', name: 'FONT', font: 'arial.ttf' };
  const schema = clientInputSchema(toolSchemas.acad_create_style)['~standard'];
  assert.ok('value' in await schema.validate(base));
  for (const bad of [{ ...base, documentEpoch: '1' }, { ...base, font: undefined },
    { ...base, coordinateSystem: 'WCS', lengthUnit: 'mm' }, { ...base, kind: 'linetype', dashes: '[3,-1.5]' }]) {
    assert.ok('issues' in await schema.validate(bad));
  }
  const line = clientInputSchema(toolSchemas.acad_create_line)['~standard'];
  const geom = { ...base, coordinateSystem: 'WCS', lengthUnit: 'mm', start: [0, 0, 0], end: [1, 0, 0] };
  delete (geom as any).kind; delete (geom as any).name; delete (geom as any).font;
  assert.ok('value' in await line.validate(geom));
  for (const bad of [{ ...geom, start: '[0,0,0]' }, { ...geom, start: [0, 0] },
    { ...geom, start: [0, 0, 0, 0] }, { ...geom, start: [false, 0, 0] }, { ...geom, end: [0, 0, 0] }]) {
    assert.ok('issues' in await line.validate(bad));
  }
  const batch = clientInputSchema(toolSchemas.acad_run_batch)['~standard'];
  const batchBase = { instanceId: 'inst-test', documentId: 'doc-test', documentEpoch: 1,
    operationId: 'batch-test', expectedRevision: 0, coordinateSystem: 'WCS', lengthUnit: 'mm' };
  assert.ok('value' in await batch.validate({ ...batchBase, steps: [{ tool: 'acad_create_line', start: [0,0,0], end: [1,0,0] }] }));
  assert.ok('issues' in await batch.validate({ ...batchBase, steps: [{ tool: 'acad_create_line', start: [0,0,0], end: [1,0,0], radius: 5 }] }));
  const heterogeneous = { type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }], items: false, minItems: 2, maxItems: 2 };
  assert.deepEqual(compatibleJsonSchema(heterogeneous), heterogeneous);
});
