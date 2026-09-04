import { describe, it, expect } from 'vitest';
import { PermissionEnforcer, PermissionDeniedError } from '../src/core/permissions/enforcer.js';
import { ToolRegistry } from '../src/mcp/tools/tool-registry.js';
import { FridayyToolDefinition } from '../src/core/schema/types.js';

describe('Destructive & Unapproved Tool Blocking', () => {
  const destructiveTool: FridayyToolDefinition = {
    id: 'tool_delete_db',
    name: 'delete_database',
    description: 'Delete entire database',
    inputSchema: { type: 'object' },
    source: { type: 'rest', method: 'DELETE', path: '/database' },
    permissions: { type: 'DESTRUCTIVE', read: false, write: true, destructive: true },
    risk: 'high',
    status: 'BLOCKED'
  };

  const pendingTool: FridayyToolDefinition = {
    id: 'tool_create_order',
    name: 'create_order',
    description: 'Create order',
    inputSchema: { type: 'object' },
    source: { type: 'rest', method: 'POST', path: '/orders' },
    permissions: { type: 'WRITE', read: false, write: true, destructive: false },
    risk: 'medium',
    status: 'PENDING'
  };

  const approvedTool: FridayyToolDefinition = {
    id: 'tool_get_users',
    name: 'get_users',
    description: 'Get users',
    inputSchema: { type: 'object' },
    source: { type: 'rest', method: 'GET', path: '/users' },
    permissions: { type: 'READ', read: true, write: false, destructive: false },
    risk: 'low',
    status: 'APPROVED'
  };

  it('should prevent unapproved tools from being exposed to MCP clients in listTools', () => {
    const registry = new ToolRegistry([destructiveTool, pendingTool, approvedTool]);
    const exposed = registry.getExposedTools();

    expect(exposed.length).toBe(1);
    expect(exposed[0].name).toBe('get_users');
  });

  it('should throw PermissionDeniedError with TOOL_BLOCKED when invoking a BLOCKED destructive tool', () => {
    const enforcer = new PermissionEnforcer();

    expect(() => enforcer.validateExecution(destructiveTool)).toThrow(PermissionDeniedError);
    try {
      enforcer.validateExecution(destructiveTool);
    } catch (err: any) {
      expect(err.code).toBe('TOOL_BLOCKED');
      expect(err.message).toContain('Destructive operations require explicit developer approval');
    }
  });

  it('should throw PermissionDeniedError with TOOL_PENDING_APPROVAL when invoking a PENDING tool', () => {
    const enforcer = new PermissionEnforcer();

    expect(() => enforcer.validateExecution(pendingTool)).toThrow(PermissionDeniedError);
    try {
      enforcer.validateExecution(pendingTool);
    } catch (err: any) {
      expect(err.code).toBe('TOOL_PENDING_APPROVAL');
    }
  });

  it('should allow execution once tool is explicitly marked APPROVED', () => {
    const enforcer = new PermissionEnforcer();
    const approvedDestructive: FridayyToolDefinition = {
      ...destructiveTool,
      status: 'APPROVED'
    };

    expect(() => enforcer.validateExecution(approvedDestructive)).not.toThrow();
  });

  it('should enforce security denylist even if tool is marked APPROVED', () => {
    const enforcer = new PermissionEnforcer({
      name: 'test',
      source: { type: 'rest' },
      security: {
        denylist: ['get_users']
      }
    });

    expect(() => enforcer.validateExecution(approvedTool)).toThrow(PermissionDeniedError);
  });

  describe('Dynamic operation re-classification (call_api_endpoint bypass)', () => {
    const dynamicTool: FridayyToolDefinition = {
      id: 'tool_call_api_endpoint',
      name: 'call_api_endpoint',
      description: 'Execute a structured HTTP request',
      inputSchema: { type: 'object' },
      source: { type: 'rest', method: 'GET', path: '/' },
      permissions: { type: 'WRITE', read: true, write: true, destructive: false },
      risk: 'medium',
      status: 'APPROVED',
      metadata: { dynamicExecution: true }
    };

    it('is statically APPROVED, allowing normal validateExecution to pass', () => {
      const enforcer = new PermissionEnforcer();
      expect(() => enforcer.validateExecution(dynamicTool)).not.toThrow();
    });

    it('blocks a runtime DELETE call even though the tool is statically APPROVED', () => {
      const enforcer = new PermissionEnforcer();

      expect(() =>
        enforcer.validateDynamicOperation(dynamicTool, { method: 'DELETE', path: '/users/123' })
      ).toThrow(PermissionDeniedError);

      try {
        enforcer.validateDynamicOperation(dynamicTool, { method: 'DELETE', path: '/users/123' });
      } catch (err: any) {
        expect(err.code).toBe('DYNAMIC_OPERATION_BLOCKED');
      }
    });

    it('blocks a runtime call whose path contains a destructive keyword', () => {
      const enforcer = new PermissionEnforcer();

      expect(() =>
        enforcer.validateDynamicOperation(dynamicTool, { method: 'POST', path: '/users/123/purge' })
      ).toThrow(PermissionDeniedError);
    });

    it('allows a runtime GET/POST call that is not destructive', () => {
      const enforcer = new PermissionEnforcer({
        name: 'test',
        source: { type: 'rest' },
        security: { autoApproveWrite: true }
      });

      expect(() =>
        enforcer.validateDynamicOperation(dynamicTool, { method: 'POST', path: '/orders' })
      ).not.toThrow();
    });
  });
});
