import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import express from 'express';
import { FridayyMcpServer } from '../src/mcp/server/fridayy-server.js';
import { FridayyConfig, FridayyToolDefinition } from '../src/core/schema/types.js';

describe('MCP Server Protocol Compliance (Discovery & Execution)', () => {
  let backendServer: any;
  let client: Client;
  let server: FridayyMcpServer;

  const mockTools: FridayyToolDefinition[] = [
    {
      id: 'tool_ping',
      name: 'ping_service',
      description: 'Ping target backend',
      inputSchema: { type: 'object', properties: { echo: { type: 'string' } } },
      source: { type: 'rest', method: 'GET', path: '/ping', baseUrl: 'http://localhost:4002' },
      parameters: { query: [{ name: 'echo', in: 'query', required: false, schema: { type: 'string' } }] },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED'
    },
    {
      id: 'tool_unapproved_action',
      name: 'unapproved_action',
      description: 'Pending action',
      inputSchema: { type: 'object' },
      source: { type: 'rest', method: 'POST', path: '/action', baseUrl: 'http://localhost:4002' },
      permissions: { type: 'WRITE', read: false, write: true, destructive: false },
      risk: 'medium',
      status: 'PENDING'
    }
  ];

  const config: FridayyConfig = {
    name: 'test-mcp-server',
    version: '1.0.0',
    source: { type: 'rest', baseUrl: 'http://localhost:4002' },
    server: { name: 'test-mcp', version: '1.0.0' }
  };

  beforeAll(async () => {
    // 1. Start mock express server
    const app = express();
    app.get('/ping', (req, res) => {
      res.json({ pong: true, echo: req.query.echo || 'default' });
    });
    backendServer = await new Promise(resolve => {
      const s = app.listen(4002, 'localhost', () => resolve(s));
    });

    // 2. Initialize Fridayy MCP Server
    server = new FridayyMcpServer({
      config,
      tools: mockTools
    });

    // 3. Connect MCP Client via linked InMemoryTransport
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.getUnderlyingServer().connect(serverTransport);

    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    if (backendServer) {
      await new Promise<void>(resolve => backendServer.close(() => resolve()));
    }
  });

  it('should discover only approved tools via standard listTools()', async () => {
    const res = await client.listTools();
    expect(res.tools.length).toBe(1);
    expect(res.tools[0].name).toBe('ping_service');
    expect(res.tools[0].description).toBe('Ping target backend');
  });

  it('should invoke approved tool and return structured text content', async () => {
    const res: any = await client.callTool({
      name: 'ping_service',
      arguments: { echo: 'hello-fridayy' }
    });

    expect(res.isError).toBeFalsy();
    expect(res.content).toBeDefined();
    expect(res.content[0].type).toBe('text');

    const body = JSON.parse(res.content[0].text);
    expect(body).toEqual({ pong: true, echo: 'hello-fridayy' });
  });

  it('should list and read Fridayy MCP resources', async () => {
    const resList = await client.listResources();
    const uris = resList.resources.map(r => r.uri);
    expect(uris).toContain('fridayy://config');
    expect(uris).toContain('fridayy://tools');
    expect(uris).toContain('fridayy://health');

    const readHealth: any = await client.readResource({ uri: 'fridayy://health' });
    expect(readHealth.contents[0].mimeType).toBe('application/json');
    const healthJson = JSON.parse(readHealth.contents[0].text);
    expect(healthJson.status).toBe('healthy');
    expect(healthJson.totalTools).toBe(2);
    expect(healthJson.exposedTools).toBe(1);
  });

  it('should list and retrieve Fridayy prompts', async () => {
    const prompts = await client.listPrompts();
    const promptNames = prompts.prompts.map(p => p.name);
    expect(promptNames).toContain('explore-api');
    expect(promptNames).toContain('safe-query');

    const promptDetails = await client.getPrompt({
      name: 'safe-query',
      arguments: { query: 'Find top products' }
    });
    expect(promptDetails.messages[0].content.text).toContain('Find top products');
  });
});
