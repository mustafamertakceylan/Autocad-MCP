import { McpServer, type ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { BridgeClient } from './bridge.js';
import { BridgeError } from './protocol.js';
import { descriptions, mutating, toolNames, toolSchemas, validateTool } from './tools.js';
import { clientInputSchema } from './client-schema.js';

export function createServer(bridge: Pick<BridgeClient, 'call'>): McpServer {
  const server = new McpServer({ name: 'autocad-mcp', version: '0.1.0' });
  // Fixed public bundle resources: no caller-supplied filesystem paths or credentials.
  for (const [name, relative] of [['autocad-mcp-skill', 'SKILL.md'], ['autocad-mcp-contract', 'references/tools.md'], ['autocad-mcp-mechanical','references/mechanical.md']] as const) {
    const uri = `skill://autocad-mcp/autocad-mcp/${relative}`;
    server.registerResource(name, uri, { mimeType: 'text/markdown', description: 'Bundled AutoCAD MCP workflow; contains no pairing data.' }, async requested => ({
      contents: [{ uri: requested.href, mimeType: 'text/markdown', text: await readFile(new URL(`../../skills/autocad-mcp/${relative}`, import.meta.url), 'utf8') }]
    }));
  }
  for (const name of toolNames) {
    server.registerTool(name, {
      description: descriptions[name], inputSchema: clientInputSchema(toolSchemas[name]),
      outputSchema: z.record(z.string(), z.unknown()),
      annotations: { readOnlyHint: !mutating.has(name), destructiveHint: ['acad_erase_entities','acad_move_entities','acad_transform_entities','acad_edit_curve','acad_corner','acad_extrude','acad_revolve','acad_boolean','acad_drill_holes','acad_manage_xref','acad_set_attributes'].includes(name), idempotentHint: !mutating.has(name), openWorldHint: false }
    }, async (input: unknown, context: ServerContext) => {
      let data: Record<string, unknown>;
      try { data = await bridge.call(name, validateTool(name, input), context.mcpReq.signal); }
      catch (error) {
        const unknown = name === 'acad_get_operation_status' || (error instanceof BridgeError && error.code === 'TIMEOUT_UNKNOWN');
        const cancelled = error instanceof BridgeError && error.code === 'CANCELLED';
        data = { status: unknown ? 'unknown' : cancelled ? 'cancelled' : 'failed', applied: unknown ? null : false, verified: null,
          error: { code: error instanceof BridgeError ? error.code : 'VALIDATION_FAILED', message: error instanceof BridgeError ? error.message : 'Invalid arguments', retryable: false } };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data, isError: data.error !== undefined && data.error !== null };
    });
  }
  return server;
}
