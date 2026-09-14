import { describe, it, expect, beforeEach } from 'vitest';
import { ToolHandler } from '../src/mcp/tools/tool-handler.js';
import { ToolRegistry } from '../src/mcp/tools/tool-registry.js';
import { AdapterRegistry } from '../src/adapters/registry.js';
import { BaseAdapter, AdapterScanContext, AdapterGenerationContext, AdapterExecutionContext } from '../src/adapters/base.js';
import { RateLimiter } from '../src/security/rate-limiter.js';
import { FridayyToolDefinition, ToolExecutionResult } from '../src/core/schema/types.js';

/**
 * These tests exist because the existing suite only ever drives
 * PermissionEnforcer.validateExecution() directly (see
 * tests/destructive-blocking.test.ts) — which proves the enforcer's logic is
 * correct, but proves nothing about whether ToolHandler.handleCall(), the
 * only code path an actual MCP client can reach, ever calls it.
 *
 * Confirmed by mutation: commenting out each of the four guards below in
 * ToolHandler.handleCall() one at a time and re-running `npm test` left the
 * full suite green in every case, because nothing exercises handleCall()
 * with a tool/input shaped to fail that specific guard while also asserting
 * the adapter was never reached. Each test here does both: it drives
 * handleCall() end-to-end through a real ToolRegistry, and it proves the
 * gate actually stopped execution by asserting a stub adapter was never
 * invoked (not just that the response looked like an error).
 */
describe('ToolHandler.handleCall() gates (mutation-tested)', () => {
  class CountingStubAdapter extends BaseAdapter {
    public readonly name = 'stub';
    public readonly description = 'Test stub adapter';
    public callCount = 0;

    public async detect(_context: AdapterScanContext) {
      return { detected: true };
    }
    public async generateTools(_context: AdapterGenerationContext) {
      return [];
    }
    public async executeTool(
      _tool: FridayyToolDefinition,
      _input: Record<string, any>,
      _context?: AdapterExecutionContext
    ): Promise<ToolExecutionResult> {
      this.callCount++;
      return {
        success: true,
        data: { ok: true },
        metadata: { durationMs: 1, timestamp: new Date().toISOString(), toolName: 'stub' }
      };
    }
  }

  let stubAdapter: CountingStubAdapter;
  let adapterRegistry: AdapterRegistry;

  beforeEach(() => {
    stubAdapter = new CountingStubAdapter();
    adapterRegistry = new AdapterRegistry();
    adapterRegistry.register(stubAdapter);
  });

  it('gate 1: a BLOCKED destructive tool is rejected and the adapter is never invoked', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_delete_all',
      name: 'delete_all',
      description: 'Delete everything',
      inputSchema: { type: 'object' },
      source: { type: 'stub', method: 'DELETE', path: '/all' },
      permissions: { type: 'DESTRUCTIVE', read: false, write: true, destructive: true },
      risk: 'high',
      status: 'BLOCKED'
    };
    const registry = new ToolRegistry([tool]);
    const handler = new ToolHandler({ adapterRegistry });

    const result = await handler.handleCall('delete_all', {}, registry);

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('TOOL_BLOCKED');
    expect(stubAdapter.callCount).toBe(0);
  });

  it('gate 2: dynamic re-classification blocks a runtime DELETE even though the tool is statically APPROVED, and the adapter is never invoked', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_call_api_endpoint',
      name: 'call_api_endpoint',
      description: 'Generic endpoint caller',
      inputSchema: { type: 'object' },
      source: { type: 'stub', method: 'GET', path: '/' },
      permissions: { type: 'WRITE', read: true, write: true, destructive: false },
      risk: 'medium',
      status: 'APPROVED',
      metadata: { dynamicExecution: true }
    };
    const registry = new ToolRegistry([tool]);
    const handler = new ToolHandler({ adapterRegistry });

    const result = await handler.handleCall('call_api_endpoint', { method: 'DELETE', path: '/users/123' }, registry);

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('DYNAMIC_OPERATION_BLOCKED');
    expect(stubAdapter.callCount).toBe(0);
  });

  it('gate 3: the rate limit is enforced on the second call and the adapter is not invoked for the rejected call', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_read_thing',
      name: 'read_thing',
      description: 'Read a thing',
      inputSchema: { type: 'object' },
      source: { type: 'stub', method: 'GET', path: '/thing' },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED',
      rateLimit: { maxRequests: 1, windowSeconds: 60 }
    };
    const registry = new ToolRegistry([tool]);
    const handler = new ToolHandler({ adapterRegistry, rateLimiter: new RateLimiter() });

    const first = await handler.handleCall('read_thing', {}, registry);
    expect(first.isError).toBeFalsy();
    expect(stubAdapter.callCount).toBe(1);

    const second = await handler.handleCall('read_thing', {}, registry);
    expect(second.isError).toBe(true);
    expect(JSON.stringify(second.content)).toContain('RATE_LIMIT_EXCEEDED');
    // The critical assertion: still 1, not 2 — the rejected call must never reach the adapter.
    expect(stubAdapter.callCount).toBe(1);
  });

  it('gate 4: invalid input is rejected before the adapter is invoked', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_get_user',
      name: 'get_user',
      description: 'Get a user by id',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      },
      source: { type: 'stub', method: 'GET', path: '/users/{id}' },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED'
    };
    const registry = new ToolRegistry([tool]);
    const handler = new ToolHandler({ adapterRegistry });

    // Missing the required "id" field.
    const result = await handler.handleCall('get_user', {}, registry);

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('INVALID_INPUT');
    expect(stubAdapter.callCount).toBe(0);
  });

  it('control: a well-formed, approved, in-limit call actually reaches the adapter exactly once', async () => {
    const tool: FridayyToolDefinition = {
      id: 'tool_get_user',
      name: 'get_user',
      description: 'Get a user by id',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      },
      source: { type: 'stub', method: 'GET', path: '/users/{id}' },
      permissions: { type: 'READ', read: true, write: false, destructive: false },
      risk: 'low',
      status: 'APPROVED'
    };
    const registry = new ToolRegistry([tool]);
    const handler = new ToolHandler({ adapterRegistry });

    const result = await handler.handleCall('get_user', { id: 'u_1' }, registry);

    expect(result.isError).toBeFalsy();
    expect(stubAdapter.callCount).toBe(1);
  });
});
