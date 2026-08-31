/**
 * Fridayy - Generic REST Adapter
 * Adapter for executing and declaring arbitrary REST endpoints.
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
import { defaultRestExecutor } from './executor.js';
import { AuthenticationManager } from '../../core/authentication/manager.js';
import { defaultSecretResolver } from '../../core/authentication/secret-resolver.js';

export class RestAdapter extends BaseAdapter {
  public readonly name = 'rest';
  public readonly description = 'Adapter for REST APIs and custom HTTP endpoints';

  private restExecutor = defaultRestExecutor;

  public async detect(context: AdapterScanContext): Promise<{ detected: boolean; details?: any }> {
    const hasBaseUrl = Boolean(context.config?.source?.baseUrl || context.config?.source?.url);
    return {
      detected: hasBaseUrl,
      details: { baseUrl: context.config?.source?.baseUrl }
    };
  }

  public async generateTools(context: AdapterGenerationContext): Promise<FridayyToolDefinition[]> {
    // REST adapter returns tools defined in config or manual definitions
    return [];
  }

  public async executeTool(
    tool: FridayyToolDefinition,
    input: Record<string, any>,
    context: AdapterExecutionContext = {}
  ): Promise<ToolExecutionResult> {
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
}
