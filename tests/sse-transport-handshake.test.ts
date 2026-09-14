import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { FridayyMcpServer } from '../src/mcp/server/fridayy-server.js';
import { FridayyConfig, FridayyToolDefinition } from '../src/core/schema/types.js';

/**
 * Regression test for two bugs found in the SSE transport:
 *
 * 1. `POST /messages` always failed with "stream is not readable". The
 *    handler called express.json() (which consumes and parses the request
 *    body) and then asked the SDK's SSEServerTransport.handlePostMessage()
 *    to read req's body again from the stream, which was already drained.
 *    The SDK accepts the already-parsed body as an optional third argument
 *    for exactly this reason; not passing it meant the handshake could never
 *    complete for *any* client, not just a second one.
 *
 * 2. A single shared MCP `Server` instance was reused across every `/sse`
 *    connection. The SDK's `Server.connect()` only supports one connected
 *    transport at a time, so a second concurrent client crashed with
 *    "Already connected to a transport."
 *
 * Both are exercised here using the SDK's own SSEClientTransport/Client
 * against a real HTTP server (not a mocked request/response), since that's
 * the only way to actually drive handlePostMessage() through Express's real
 * body-parsing middleware and catch bug #1.
 */
describe('SSE transport handshake and multi-client support', () => {
  const config: FridayyConfig = {
    name: 'test-mcp-sse-handshake',
    source: { type: 'rest' },
    server: { name: 'test-mcp-sse-handshake' }
  };
  const tools: FridayyToolDefinition[] = [
    {
      id: 'tool_ping',
      name: 'ping',
      description: 'Ping',
      inputSchema: { type: 'object' },
      source: { type: 'rest', method: 'GET', path: '/ping' },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED'
    }
  ];
  const port = 4502;

  let close: () => Promise<void>;

  beforeAll(async () => {
    const server = new FridayyMcpServer({ config, tools });
    const result = await server.startSse(port, 'localhost');
    close = result.close;
  });

  afterAll(async () => {
    await close();
  });

  async function connectClient(name: string): Promise<Client> {
    const client = new Client({ name, version: '1.0.0' }, { capabilities: {} });
    const transport = new SSEClientTransport(new URL(`http://localhost:${port}/sse`));
    await client.connect(transport);
    return client;
  }

  it('completes the initialize + tools/list handshake over a real HTTP round-trip', async () => {
    const client = await connectClient('handshake-test-client');
    try {
      const result = await client.listTools();
      expect(result.tools.map(t => t.name)).toContain('ping');
    } finally {
      await client.close();
    }
  });

  it('supports two concurrent SSE clients without one breaking the other', async () => {
    const [clientA, clientB] = await Promise.all([
      connectClient('concurrent-client-a'),
      connectClient('concurrent-client-b')
    ]);

    try {
      const [resultA, resultB] = await Promise.all([clientA.listTools(), clientB.listTools()]);
      expect(resultA.tools.map(t => t.name)).toContain('ping');
      expect(resultB.tools.map(t => t.name)).toContain('ping');
    } finally {
      await Promise.all([clientA.close(), clientB.close()]);
    }
  });
});
