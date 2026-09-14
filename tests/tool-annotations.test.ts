import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildToolAnnotations } from '../src/mcp/tools/tool-annotations.js';
import { FridayyMcpServer } from '../src/mcp/server/fridayy-server.js';
import { FridayyConfig, FridayyToolDefinition } from '../src/core/schema/types.js';

describe('MCP tool annotation hints', () => {
  function tool(overrides: Partial<FridayyToolDefinition>): FridayyToolDefinition {
    return {
      id: 'tool_x',
      name: 'x',
      description: 'x',
      inputSchema: { type: 'object' },
      source: { type: 'rest', method: 'GET', path: '/x' },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED',
      ...overrides
    };
  }

  it('marks a READ/GET tool as read-only and idempotent', () => {
    const annotations = buildToolAnnotations(tool({}));
    expect(annotations.readOnlyHint).toBe(true);
    expect(annotations.destructiveHint).toBe(false);
    expect(annotations.idempotentHint).toBe(true);
    expect(annotations.openWorldHint).toBe(true);
  });

  it('marks a DESTRUCTIVE/DELETE tool as destructive and idempotent', () => {
    const annotations = buildToolAnnotations(
      tool({
        source: { type: 'rest', method: 'DELETE', path: '/x/{id}' },
        permissions: { type: 'DESTRUCTIVE', read: false, write: true, destructive: true }
      })
    );
    expect(annotations.readOnlyHint).toBe(false);
    expect(annotations.destructiveHint).toBe(true);
    expect(annotations.idempotentHint).toBe(true);
  });

  it('marks a WRITE/POST tool as neither read-only nor idempotent', () => {
    const annotations = buildToolAnnotations(
      tool({
        source: { type: 'rest', method: 'POST', path: '/x' },
        permissions: { type: 'WRITE', read: false, write: true, destructive: false }
      })
    );
    expect(annotations.readOnlyHint).toBe(false);
    expect(annotations.destructiveHint).toBe(false);
    expect(annotations.idempotentHint).toBe(false);
  });

  it('marks a WRITE/PUT tool as idempotent', () => {
    const annotations = buildToolAnnotations(
      tool({
        source: { type: 'rest', method: 'PUT', path: '/x/{id}' },
        permissions: { type: 'WRITE', read: false, write: true, destructive: false }
      })
    );
    expect(annotations.idempotentHint).toBe(true);
  });

  it('is actually emitted on tools/list over the real MCP protocol', async () => {
    const config: FridayyConfig = { name: 'annotations-test', source: { type: 'rest' } };
    const tools: FridayyToolDefinition[] = [
      tool({ name: 'delete_thing', source: { type: 'rest', method: 'DELETE', path: '/thing/{id}' }, permissions: { type: 'DESTRUCTIVE', read: false, write: true, destructive: true }, status: 'APPROVED' })
    ];

    const server = new FridayyMcpServer({ config, tools });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.getUnderlyingServer().connect(serverTransport);

    const client = new Client({ name: 'annotations-test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    const result = await client.listTools();
    const deleteThing = result.tools.find(t => t.name === 'delete_thing');
    expect(deleteThing?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    });
  });
});
