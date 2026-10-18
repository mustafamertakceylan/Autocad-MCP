import { McpServer, type ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { BridgeClient } from './bridge.js';
import { BridgeError } from './protocol.js';
import { descriptions, mutating, toolNames, toolSchemas, validateTool } from './tools.js';

export function createServer(bridge: BridgeClient): McpServer {
  const server = new McpServer({ name: 'autocad-mcp', version: '0.1.0' });
  for (const name of toolNames) {
    server.registerTool(name, {
      description: descriptions[name], inputSchema: toolSchemas[name],
      outputSchema: z.record(z.string(), z.unknown()),
      annotations: { readOnlyHint: !mutating.has(name), destructiveHint: name === 'acad_erase_entities', idempotentHint: !mutating.has(name), openWorldHint: false }
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
