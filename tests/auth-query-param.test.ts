import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { buildHttpRequest, applyAuthToRequest } from '../src/adapters/openapi/request-builder.js';
import { RestExecutor } from '../src/adapters/rest/executor.js';
import { AuthenticationManager } from '../src/core/authentication/manager.js';
import { FridayyToolDefinition } from '../src/core/schema/types.js';

/**
 * Regression test for a bug where a `{type: 'apiKey', in: 'query'}`
 * authentication scheme resolved its secret correctly but never actually
 * sent it. AuthenticationManager.applyAuth() returns query params that have
 * to be merged onto the request URL (buildHttpRequest() had already
 * finalized that URL string before auth ran), but every adapter called
 * `applyAuth(auth, { headers, queryParams: {} })` and discarded the return
 * value — so the credential silently vanished and the target API 401s with
 * nothing in the output explaining why.
 */
describe('Query-parameter API key authentication is actually sent', () => {
  let server: any;
  const executor = new RestExecutor({ timeoutMs: 5000 });
  const port = 4003;

  beforeAll(async () => {
    process.env.FRIDAYY_TEST_QUERY_KEY = 'super-secret-query-key';

    const app = express();
    app.get('/items', (req, res) => {
      if (req.query.api_key !== 'super-secret-query-key') {
        res.status(401).json({ error: 'unauthorized', received: req.query.api_key ?? null });
        return;
      }
      res.json({ items: [] });
    });

    server = await new Promise(resolve => {
      const s = app.listen(port, 'localhost', () => resolve(s));
    });
  });

  afterAll(async () => {
    delete process.env.FRIDAYY_TEST_QUERY_KEY;
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it('appends the resolved secret as a URL query parameter, and the server accepts it', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_get_items',
      name: 'get_items',
      description: 'List items',
      inputSchema: { type: 'object' },
      source: { type: 'rest', method: 'GET', path: '/items', baseUrl: `http://localhost:${port}` },
      authentication: {
        required: true,
        type: 'apiKey',
        queryParam: 'api_key',
        envKey: 'FRIDAYY_TEST_QUERY_KEY'
      },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED'
    };

    const authManager = new AuthenticationManager();
    const preparedReq = buildHttpRequest(tool, {});

    // Before applyAuthToRequest, the URL must not yet carry the credential —
    // proves the fix is actually appending it, not something else supplying it.
    expect(preparedReq.url).toBe(`http://localhost:${port}/items`);

    applyAuthToRequest(authManager, tool.authentication, preparedReq);

    expect(preparedReq.url).toBe(`http://localhost:${port}/items?api_key=super-secret-query-key`);
    expect(preparedReq.headers['x-api-key']).toBeUndefined(); // must go in the URL, not a header

    const result = await executor.execute(preparedReq, tool.name);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ items: [] });
  });

  it('the server rejects the request when the query param is missing (sanity check on the test server itself)', async () => {
    const result = await executor.execute(
      { url: `http://localhost:${port}/items`, method: 'GET', headers: {} },
      'get_items_no_auth'
    );
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_401');
  });
});
