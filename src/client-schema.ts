import { z } from 'zod';

type JsonSchema = Record<string, any>;

// LLM tool adapters commonly support object properties and homogeneous arrays
// but lose types when given root oneOf or draft2020 prefixItems. Advertise a
// typed object superset; execution STILL validates the original strict schema.
export function compatibleJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compatibleJsonSchema);
  if (!value || typeof value !== 'object') return value;
  const node: JsonSchema = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compatibleJsonSchema(v)]));
  if (Array.isArray(node.prefixItems) && node.prefixItems.length && node.items === false) {
    const tuple = node.prefixItems as JsonSchema[];
    if (tuple.every(x => JSON.stringify(x) === JSON.stringify(tuple[0])) &&
        node.minItems === tuple.length && node.maxItems === tuple.length) {
      node.items = tuple[0];
      delete node.prefixItems;
    }
  }
  if (Array.isArray(node.oneOf) && node.oneOf.length &&
      node.oneOf.every((x: JsonSchema) => x.type === 'object' && x.properties)) {
    const branches = node.oneOf as JsonSchema[];
    const properties: JsonSchema = {};
    for (const key of new Set(branches.flatMap(x => Object.keys(x.properties)))) {
      const variants = branches.filter(x => key in x.properties).map(x => x.properties[key]);
      const unique = [...new Map(variants.map(x => [JSON.stringify(x), x])).values()];
      if (unique.length === 1) properties[key] = unique[0];
      else if (unique.every(x => 'const' in x || Array.isArray(x.enum))) {
        const values = [...new Set(unique.flatMap(x => 'const' in x ? [x.const] : x.enum))];
        properties[key] = { type: unique[0].type, enum: values };
      } else properties[key] = { anyOf: unique };
    }
    node.type = 'object';
    node.properties = properties;
    node.required = (branches[0]!.required ?? []).filter((key: string) => branches.every(x => x.required?.includes(key)));
    node.additionalProperties = false;
    const discriminator = Object.keys(properties).find(key => branches.every(x => x.properties[key] && 'const' in x.properties[key]) &&
      new Set(branches.map(x => x.properties[key].const)).size > 1);
    const requirements = discriminator ? branches.map(x => `${discriminator}=${x.properties[discriminator].const}: require ${(x.required ?? []).filter((key: string) => !node.required.includes(key)).join(', ') || 'no additional required fields'}`).join('; ') : '';
    node.description = [node.description, 'Fields depend on the discriminator; include only fields of the selected variant. The original strict per-variant schema is enforced at execution.', requirements].filter(Boolean).join(' ');
    delete node.oneOf;
  }
  return node;
}

export function clientInputSchema<S extends z.ZodType>(schema: S): {
  '~standard': {
    version: 1;
    vendor: string;
    validate: z.ZodType['~standard']['validate'];
    jsonSchema: { input: () => Record<string, unknown>; output: () => Record<string, unknown> };
  };
} {
  const metadata = compatibleJsonSchema(z.toJSONSchema(schema, { io: 'input' }));
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'autocad-mcp',
      validate: (input: unknown) => schema['~standard'].validate(input),
      jsonSchema: {
        input: () => metadata as Record<string, unknown>,
        output: () => metadata as Record<string, unknown>
      }
    }
  };
}
