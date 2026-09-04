/**
 * Fridayy - MCP Tool Call Invocation Handler
 * Enforces permissions, validates input, checks rate limits, executes adapters, and logs audits.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  FridayyToolDefinition,
  FridayyConfig,
  ToolExecutionResult
} from '../../core/schema/types.js';
import { PermissionEnforcer } from '../../core/permissions/enforcer.js';
import { validateToolInput } from '../../core/validation/validator.js';
import { RateLimiter } from '../../security/rate-limiter.js';
import { AuditLogger } from '../../security/audit-logger.js';
import { AdapterRegistry, defaultAdapterRegistry } from '../../adapters/registry.js';
import { ToolRegistry } from './tool-registry.js';

export interface ToolHandlerOptions {
  config?: FridayyConfig;
  adapterRegistry?: AdapterRegistry;
  rateLimiter?: RateLimiter;
  auditLogger?: AuditLogger;
}

export class ToolHandler {
  private config?: FridayyConfig;
  private enforcer: PermissionEnforcer;
  private adapterRegistry: AdapterRegistry;
  private rateLimiter: RateLimiter;
  private auditLogger: AuditLogger;

  constructor(options: ToolHandlerOptions = {}) {
    this.config = options.config;
    this.enforcer = new PermissionEnforcer(options.config);
    this.adapterRegistry = options.adapterRegistry || defaultAdapterRegistry;
    this.rateLimiter =
      options.rateLimiter ||
      new RateLimiter(options.config?.security?.rateLimit || { maxRequests: 60, windowSeconds: 60 });
    this.auditLogger =
      options.auditLogger ||
      new AuditLogger({
        logFilePath: options.config?.logging?.auditLogPath,
        maskSecrets: options.config?.logging?.maskSecrets ?? true
      });
  }

  /**
   * Handles a tool call from an MCP client.
   */
  public async handleCall(
    toolName: string,
    args: Record<string, any> = {},
    toolRegistry: ToolRegistry
  ): Promise<CallToolResult> {
    const startTime = Date.now();
    const tool = toolRegistry.get(toolName);

    // 1. Check if tool exists
    if (!tool) {
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        toolName,
        input: args,
        result: { success: false, durationMs: Date.now() - startTime, error: 'TOOL_NOT_FOUND' }
      });
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'TOOL_NOT_FOUND',
              message: `Tool "${toolName}" is not registered in Fridayy.`
            }, null, 2)
          }
        ]
      };
    }

    // 2. Permission & Approval Enforcement
    try {
      this.enforcer.validateExecution(tool);
    } catch (permErr: any) {
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        toolName,
        input: args,
        result: { success: false, durationMs: Date.now() - startTime, error: permErr.code || permErr.message }
      });
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: permErr.code || 'PERMISSION_DENIED',
              message: permErr.message,
              toolStatus: tool.status,
              risk: tool.risk,
              permissions: tool.permissions
            }, null, 2)
          }
        ]
      };
    }

    // 2b. Dynamic Operation Re-classification
    // Some tools (e.g. a generic REST "call_api_endpoint") accept the HTTP method
    // and path as call-time arguments rather than fixing them at generation time.
    // Their static classification (computed with a placeholder method) must not be
    // trusted for the actual call — re-classify using the real method/path so a
    // destructive request (e.g. method: "DELETE") is still blocked/pending review.
    if (tool.metadata?.dynamicExecution) {
      try {
        this.enforcer.validateDynamicOperation(tool, {
          method: args.method,
          path: args.path
        });
      } catch (permErr: any) {
        this.auditLogger.log({
          timestamp: new Date().toISOString(),
          toolName,
          input: args,
          result: { success: false, durationMs: Date.now() - startTime, error: permErr.code || permErr.message }
        });
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: permErr.code || 'PERMISSION_DENIED',
                message: permErr.message,
                details: permErr.details
              }, null, 2)
            }
          ]
        };
      }
    }

    // 3. Rate Limit Check
    const rateLimitCheck = this.rateLimiter.checkLimit(toolName, tool.rateLimit);
    if (!rateLimitCheck.allowed) {
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        toolName,
        input: args,
        result: { success: false, durationMs: Date.now() - startTime, error: 'RATE_LIMIT_EXCEEDED' }
      });
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded for tool "${toolName}". Retry in ${rateLimitCheck.retryAfterSeconds}s.`
            }, null, 2)
          }
        ]
      };
    }

    // 4. Input Validation
    const validation = validateToolInput(tool, args);
    if (!validation.valid) {
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        toolName,
        input: args,
        result: { success: false, durationMs: Date.now() - startTime, error: 'INVALID_INPUT' }
      });
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INVALID_INPUT',
              message: `Invalid parameters provided for tool "${toolName}"`,
              details: validation.errors
            }, null, 2)
          }
        ]
      };
    }

    // 5. Select Adapter
    const sourceType = tool.source.type || 'openapi';
    const adapter = this.adapterRegistry.get(sourceType);

    if (!adapter) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'ADAPTER_NOT_FOUND',
              message: `No adapter registered for source type "${sourceType}"`
            }, null, 2)
          }
        ]
      };
    }

    // 6. Execute Tool via Adapter
    try {
      const result: ToolExecutionResult = await adapter.executeTool(tool, args, {
        config: this.config
      });

      const durationMs = Date.now() - startTime;

      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        toolName,
        input: args,
        result: {
          success: result.success,
          statusCode: result.metadata?.statusCode,
          durationMs,
          error: result.error?.message
        }
      });

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.error || { message: 'Execution failed' }, null, 2)
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)
          }
        ]
      };
    } catch (execErr: any) {
      const durationMs = Date.now() - startTime;
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        toolName,
        input: args,
        result: { success: false, durationMs, error: execErr.message }
      });

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'EXECUTION_ERROR',
              message: execErr.message || 'An unexpected error occurred during execution'
            }, null, 2)
          }
        ]
      };
    }
  }
}
