import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { buildHttpRequest } from '../src/adapters/openapi/request-builder.js';
import { RestExecutor } from '../src/adapters/rest/executor.js';
import { FridayyToolDefinition } from '../src/core/schema/types.js';

describe('REST Request Builder & Executor', () => {
  let server: any;
  const executor = new RestExecutor({ timeoutMs: 5000 });

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    app.get('/api/items/:id', (req, res) => {
      res.json({ id: req.params.id, filter: req.query.filter || 'none' });
    });

    app.post('/api/items', (req, res) => {
      res.status(201).json({ created: req.body });
    });

    app.get('/api/error', (req, res) => {
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Something broke' });
    });

    app.get('/api/slow', async (req, res) => {
      await new Promise(r => setTimeout(r, 200));
      res.json({ slow: true });
    });

    server = await new Promise(resolve => {
      const s = app.listen(4001, 'localhost', () => resolve(s));
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it('should interpolate path variables, serialize query parameters, and execute GET', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_get_item',
      name: 'get_item',
      description: 'Get item',
      inputSchema: { type: 'object' },
      source: {
        type: 'rest',
        method: 'GET',
        path: '/api/items/{id}',
        baseUrl: 'http://localhost:4001'
      },
      parameters: {
        path: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        query: [{ name: 'filter', in: 'query', required: false, schema: { type: 'string' } }]
      },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED'
    };

    const req = buildHttpRequest(tool, { id: 'item_99', filter: 'active' });
    expect(req.url).toBe('http://localhost:4001/api/items/item_99?filter=active');
    expect(req.method).toBe('GET');

    const result = await executor.execute(req, 'get_item');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'item_99', filter: 'active' });
    expect(result.metadata?.statusCode).toBe(200);
  });

  it('should serialize JSON request body for POST', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_create_item',
      name: 'create_item',
      description: 'Create item',
      inputSchema: { type: 'object' },
      source: {
        type: 'rest',
        method: 'POST',
        path: '/api/items',
        baseUrl: 'http://localhost:4001'
      },
      requestBody: {
        contentType: 'application/json',
        required: true,
        schema: { type: 'object' }
      },
      permissions: { type: 'WRITE', read: false, write: true, destructive: false },
      risk: 'medium',
      status: 'APPROVED'
    };

    const req = buildHttpRequest(tool, { title: 'New Gadget', price: 99 });
    expect(req.method).toBe('POST');
    expect(JSON.parse(req.body!)).toEqual({ title: 'New Gadget', price: 99 });

    const result = await executor.execute(req, 'create_item');
    expect(result.success).toBe(true);
    expect(result.metadata?.statusCode).toBe(201);
    expect(result.data.created).toEqual({ title: 'New Gadget', price: 99 });
  });

  it('should capture HTTP error responses cleanly', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_error',
      name: 'get_error',
      description: 'Error endpoint',
      inputSchema: { type: 'object' },
      source: {
        type: 'rest',
        method: 'GET',
        path: '/api/error',
        baseUrl: 'http://localhost:4001'
      },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED'
    };

    const req = buildHttpRequest(tool, {});
    const result = await executor.execute(req, 'get_error');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_500');
    expect(result.error?.details).toEqual({ error: 'INTERNAL_SERVER_ERROR', message: 'Something broke' });
  });
});
