import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FridayyMcpServer } from '../src/mcp/server/fridayy-server.js';
import { FridayyConfig, FridayyToolDefinition } from '../src/core/schema/types.js';

describe('SSE transport API key enforcement', () => {
  const config: FridayyConfig = {
    name: 'test-mcp-sse',
    source: { type: 'rest' },
    server: { name: 'test-mcp-sse' }
  };
  const tools: FridayyToolDefinition[] = [];
  const port = 4501;
  const apiKey = 'test-api-key-123';

  let close: () => Promise<void>;

  beforeAll(async () => {
    const server = new FridayyMcpServer({ config, tools });
    const result = await server.startSse(port, 'localhost', apiKey);
    close = result.close;
  });

  afterAll(async () => {
    await close();
  });

  it('allows /health without an API key', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
  });

  it('rejects /sse with no API key', async () => {
    const res = await fetch(`http://localhost:${port}/sse`);
    expect(res.status).toBe(401);
  });

  it('rejects /sse with a wrong API key', async () => {
    const res = await fetch(`http://localhost:${port}/sse`, {
      headers: { 'x-api-key': 'wrong-key' }
    });
    expect(res.status).toBe(401);
  });

  it('rejects /messages with no API key', async () => {
    const res = await fetch(`http://localhost:${port}/messages?sessionId=abc`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  // These use POST /messages (rather than opening a real GET /sse stream) to
  // verify the auth middleware admits a valid key, without actually completing
  // an SSE handshake — the underlying MCP Server supports only one concurrent
  // transport, so opening multiple real SSE connections in the same test file
  // would conflict with each other regardless of authentication.

  it('accepts a request carrying the correct x-api-key header past the auth gate', async () => {
    const res = await fetch(`http://localhost:${port}/messages?sessionId=does-not-exist`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey }
    });
    // Auth passed; the 404 comes from the unknown session, not the auth gate.
    expect(res.status).toBe(404);
  });

  it('accepts a request carrying the correct Bearer token past the auth gate', async () => {
    const res = await fetch(`http://localhost:${port}/messages?sessionId=does-not-exist`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` }
    });
    expect(res.status).toBe(404);
  });
});
