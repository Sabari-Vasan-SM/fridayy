/**
 * Fridayy - Manual Custom Tools Adapter
 * Supports custom defined tools with manual configurations or handlers.
 */

import {
  BaseAdapter,
  AdapterScanContext,
  AdapterGenerationContext,
  AdapterExecutionContext
} from '../base.js';
import {
  FridayyToolDefinition,
  ToolExecutionResult
} from '../../core/schema/types.js';
import { buildHttpRequest } from '../openapi/request-builder.js';
import { defaultRestExecutor } from '../rest/executor.js';
import { AuthenticationManager } from '../../core/authentication/manager.js';
import { defaultSecretResolver } from '../../core/authentication/secret-resolver.js';

export class ManualAdapter extends BaseAdapter {
  public readonly name = 'manual';
  public readonly description = 'Adapter for manually defined tools and handlers';

  private restExecutor = defaultRestExecutor;

  public async detect(context: AdapterScanContext): Promise<{ detected: boolean; details?: any }> {
    return { detected: false };
  }

  public async generateTools(context: AdapterGenerationContext): Promise<FridayyToolDefinition[]> {
    return [];
  }

  public async executeTool(
    tool: FridayyToolDefinition,
    input: Record<string, any>,
    context: AdapterExecutionContext = {}
  ): Promise<ToolExecutionResult> {
    // If tool defines an HTTP endpoint, execute it
    if (tool.source.url || tool.source.path) {
      const authManager = new AuthenticationManager(context.config);
      const baseUrl = defaultSecretResolver.resolveBaseUrl(context.config?.source?.baseUrl);

      const preparedReq = buildHttpRequest(tool, input, baseUrl);
      if (context.headers) {
        Object.assign(preparedReq.headers, context.headers);
      }

      authManager.applyAuth(tool.authentication, {
        headers: preparedReq.headers,
        queryParams: {}
      });

      return await this.restExecutor.execute(preparedReq, tool.name, {
        timeoutMs: context.timeoutMs
      });
    }

    // Otherwise return echo/manual data
    return {
      success: true,
      data: {
        message: `Executed manual tool "${tool.name}"`,
        input
      },
      metadata: {
        durationMs: 1,
        timestamp: new Date().toISOString(),
        toolName: tool.name
      }
    };
  }
}
