import { z } from 'zod';
import { BridgeError } from './protocol.js';

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const target = { instanceId: id, documentId: id, documentEpoch: integer.min(1) };
const point = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const unit = z.enum(['mm', 'm', 'inch', 'drawing_unit']);
const geom = { coordinateSystem: z.literal('WCS'), lengthUnit: unit };
const mutation = { ...target, operationId: id, expectedRevision: integer };
const entityRef = z.strictObject({ documentId: id, documentEpoch: integer.min(1), handle: z.string().regex(/^[0-9a-fA-F]{1,16}$/) });
const targets = z.array(entityRef).min(1).max(100);
const projection = z.array(z.enum(['handle', 'type', 'layer', 'start', 'end', 'center', 'radius', 'size', 'extents', 'volume'])).min(1).max(11);
const readGeom = { coordinateSystem: z.literal('WCS'), lengthUnit: unit.default('drawing_unit'), projection: projection.optional() };
const layer = z.string().min(1).max(255).optional();

export const toolSchemas = {
  acad_list_instances: z.strictObject({}),
  acad_get_status: z.strictObject({ instanceId: id }),
  acad_get_capabilities: z.strictObject({ instanceId: id, documentId: id.optional(), documentEpoch: integer.min(1).optional() })
    .refine(x => (x.documentId === undefined) === (x.documentEpoch === undefined), 'Document identity requires both fields'),
  acad_list_documents: z.strictObject({ instanceId: id }),
  acad_get_document_info: z.strictObject(target),
  acad_query_entities: z.strictObject({ ...target, ...readGeom, filter: z.strictObject({ type: z.enum(['LINE', 'CIRCLE', '3DSOLID']).optional(), layer: z.string().min(1).max(255).optional() }), limit: integer.min(1).max(1000).default(100), cursor: z.string().min(1).max(4096).optional() }),
  acad_get_entity: z.strictObject({ ...target, ...readGeom, entityRef }),
  acad_create_line: z.strictObject({ ...mutation, ...geom, start: point, end: point, layer }).refine(x => x.start.some((n, i) => n !== x.end[i]), 'Line must have nonzero length'),
  acad_create_circle: z.strictObject({ ...mutation, ...geom, center: point, radius: z.number().positive().finite(), normal: point.default([0, 0, 1]), layer }).refine(x => x.normal[0] === 0 && x.normal[1] === 0 && x.normal[2] === 1, 'Only WCS XY circles supported'),
  acad_create_box: z.strictObject({ ...mutation, ...geom, center: point, size: point, layer }).refine(x => x.size.every(n => n > 0), 'Box size must be positive'),
  acad_move_entities: z.strictObject({ ...mutation, ...geom, targets, delta: point }),
  acad_erase_entities: z.strictObject({ ...mutation, targets }),
  acad_get_operation_status: z.strictObject({ ...target, operationId: id }),
  acad_save_copy: z.strictObject({ ...mutation, outputRootId: id, relativePath: z.string().min(1).max(4096), overwrite: z.literal(false) })
};
export type ToolName = keyof typeof toolSchemas;
export const toolNames = Object.keys(toolSchemas) as ToolName[];
export const mutating = new Set<ToolName>(['acad_create_line', 'acad_create_circle', 'acad_create_box', 'acad_move_entities', 'acad_erase_entities', 'acad_save_copy']);
export const descriptions: Record<ToolName, string> = {
  acad_list_instances: 'List explicitly paired local AutoCAD instances. No active-tab fallback.',
  acad_get_status: 'Read bridge/backend status; simulated backends are identified explicitly.',
  acad_get_capabilities: 'Read actual operations supported by the paired plugin.',
  acad_list_documents: 'List open drawings and their explicit identity, revision and units.',
  acad_get_document_info: 'Read drawing metadata without changing the current drawing.',
  acad_query_entities: 'Read bounded modelspace entity projections with a revision-bound cursor.',
  acad_get_entity: 'Read one entity from its explicit drawing and epoch.',
  acad_create_line: 'Create a modelspace WCS line with explicit length units and read it back.',
  acad_create_circle: 'Create a modelspace WCS XY circle with explicit units and verify its radius.',
  acad_create_box: 'Create an axis-aligned modelspace solid box and read back volume and extents.',
  acad_move_entities: 'Translate explicitly referenced native entities and verify resulting geometry.',
  acad_erase_entities: 'Erase explicit modelspace entities in one transaction.',
  acad_get_operation_status: 'Reconcile an operation after timeout. Missing records do not prove no effect.',
  acad_save_copy: 'Write a new authorized DWG copy without replacing existing files or renaming the source.'
};

export function validateTool(name: ToolName, input: unknown): Record<string, unknown> {
  const parsed = toolSchemas[name].parse(input) as Record<string, unknown>;
  const refs = (parsed.targets ?? (parsed.entityRef ? [parsed.entityRef] : [])) as Array<z.infer<typeof entityRef>>;
  const unique = new Set<string>();
  for (const ref of refs) {
    const key = ref.handle.toUpperCase();
    if (ref.documentId !== parsed.documentId || ref.documentEpoch !== parsed.documentEpoch || unique.has(key)) throw new Error('Invalid entity target');
    unique.add(key);
  }
  if (parsed.projection && new Set(parsed.projection as string[]).size !== (parsed.projection as string[]).length) throw new Error('Duplicate projection');
  if (name === 'acad_save_copy') {
    const p = parsed.relativePath as string;
    if (p.length > 255 || !/\.dwg$/i.test(p) || /[\x00-\x1f:\\/*?"<>|]/.test(p) || /[. ]$/.test(p) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p)) throw new BridgeError('OUTPUT_PATH_DENIED', 'Only a new flat DWG filename is accepted');
  }
  return parsed;
}
