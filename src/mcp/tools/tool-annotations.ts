/**
 * Fridayy - MCP Tool Annotations Builder
 * Maps fridayy's own READ/WRITE/DESTRUCTIVE permission classification onto the
 * standard MCP tool annotation hints (readOnlyHint, destructiveHint,
 * idempotentHint, openWorldHint) that clients like Claude Desktop and Cursor
 * use to decide what to auto-approve versus confirm with the user.
 *
 * fridayy already computes exactly this classification for every tool (see
 * core/permissions/classifier.ts) — without this, that work stays invisible
 * to the MCP client, which has no signal beyond the tool's name/description
 * for whether a call is safe to run without asking.
 */

import { FridayyToolDefinition } from '../../core/schema/types.js';

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

// PUT and DELETE are conventionally idempotent (repeating the same request
// has the same effect as doing it once); POST and PATCH conventionally are
// not. GET/HEAD/OPTIONS are read-only, which already implies idempotent.
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

export function buildToolAnnotations(tool: FridayyToolDefinition): ToolAnnotations {
  const method = (tool.source.method || 'GET').toUpperCase();

  return {
    readOnlyHint: tool.permissions.type === 'READ',
    destructiveHint: tool.permissions.type === 'DESTRUCTIVE',
    idempotentHint: IDEMPOTENT_METHODS.has(method),
    // Every fridayy tool calls out to an external HTTP API rather than
    // operating over a fixed, enumerable set of entities the client already
    // knows about, so this is true for the whole tool surface.
    openWorldHint: true
  };
}
