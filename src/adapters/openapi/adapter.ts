/**
 * Fridayy - OpenAPI Adapter
 * Converts OpenAPI/Swagger specifications into standard Fridayy tool definitions and executes them.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  BaseAdapter,
  AdapterScanContext,
  AdapterGenerationContext,
  AdapterExecutionContext
} from '../base.js';
import {
  FridayyToolDefinition,
  ParameterDefinition,
  RequestBodyDefinition,
  ToolAuthentication,
  ToolExecutionResult
} from '../../core/schema/types.js';
import { OpenApiParser } from './parser.js';
import { buildUnifiedInputSchema } from '../../core/schema/json-schema.js';
import { sanitizeToolName, generateToolNameFromRoute } from '../../core/tool-generator/name-sanitizer.js';
import { buildToolDescription } from '../../core/tool-generator/description-builder.js';
import { classifyOperation } from '../../core/permissions/classifier.js';
import { buildHttpRequest } from './request-builder.js';
import { defaultRestExecutor, RestExecutor } from '../rest/executor.js';
import { AuthenticationManager } from '../../core/authentication/manager.js';
import { defaultSecretResolver } from '../../core/authentication/secret-resolver.js';

export class OpenApiAdapter extends BaseAdapter {
  public readonly name = 'openapi';
  public readonly description = 'Adapter for OpenAPI 3.0, 3.1, and Swagger 2.0 specifications';

  private parser = new OpenApiParser();
  private restExecutor = defaultRestExecutor;

  public async detect(context: AdapterScanContext): Promise<{ detected: boolean; details?: any }> {
    const rootDir = context.rootDir;
    const candidates = [
      'openapi.yaml',
      'openapi.yml',
      'openapi.json',
      'swagger.yaml',
      'swagger.yml',
      'swagger.json',
      'api/openapi.yaml',
      'api/openapi.json',
      'docs/openapi.yaml',
      'docs/openapi.json'
    ];

    const foundFiles: string[] = [];
    for (const rel of candidates) {
      const full = path.resolve(rootDir, rel);
      if (fs.existsSync(full)) {
        foundFiles.push(rel);
      }
    }

    return {
      detected: foundFiles.length > 0,
      details: { foundFiles }
    };
  }

  public async generateTools(context: AdapterGenerationContext): Promise<FridayyToolDefinition[]> {
    const rootDir = context.rootDir || process.cwd();
    let specSource = context.sourcePath || context.config?.source?.path || 'openapi.yaml';

    const spec = await this.parser.parse(specSource, rootDir);
    const tools: FridayyToolDefinition[] = [];
    const serverBaseUrl =
      defaultSecretResolver.resolveBaseUrl(context.config?.source?.baseUrl) ||
      spec.servers[0]?.url ||
      'http://localhost:3000';

    const usedToolNames = new Set<string>();

    for (const [routePath, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
      const pathLevelParams: ParameterDefinition[] = this.extractParameters(pathItem.parameters);

      for (const method of httpMethods) {
        const operation = (pathItem as any)[method];
        if (!operation || typeof operation !== 'object') continue;

        // Extract parameters
        const opParams: ParameterDefinition[] = this.extractParameters(operation.parameters);
        const allParams = [...pathLevelParams, ...opParams];

        const pathParams = allParams.filter(p => p.in === 'path');
        const queryParams = allParams.filter(p => p.in === 'query');
        const headerParams = allParams.filter(p => p.in === 'header');
        const cookieParams = allParams.filter(p => p.in === 'cookie');

        // Extract request body
        const requestBody = this.extractRequestBody(operation.requestBody, operation);

        // Generate tool name
        let toolName = operation.operationId
          ? sanitizeToolName(operation.operationId)
          : generateToolNameFromRoute(method, routePath);

        // Ensure unique tool names
        if (usedToolNames.has(toolName)) {
          let suffix = 2;
          while (usedToolNames.has(`${toolName}_${suffix}`)) {
            suffix++;
          }
          toolName = `${toolName}_${suffix}`;
        }
        usedToolNames.add(toolName);

        // Classify permissions
        const classification = classifyOperation(
          {
            method,
            path: routePath,
            operationId: operation.operationId,
            name: toolName,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags
          },
          context.config
        );

        // Build description
        const description = buildToolDescription({
          summary: operation.summary,
          description: operation.description,
          method,
          path: routePath,
          tags: operation.tags,
          permissionType: classification.permissions.type,
          risk: classification.risk
        });

        // Build unified input schema
        const inputSchema = buildUnifiedInputSchema({
          parameters: {
            path: pathParams,
            query: queryParams,
            header: headerParams,
            cookie: cookieParams
          },
          requestBody
        });

        // Determine authentication requirement
        const auth = this.extractSecurity(operation.security || spec.rawDoc.security, spec.securityDefinitions);

        const tool: FridayyToolDefinition = {
          id: `tool_${toolName}`,
          name: toolName,
          description,
          inputSchema,
          source: {
            type: 'openapi',
            method: method.toUpperCase(),
            path: routePath,
            baseUrl: serverBaseUrl,
            operationId: operation.operationId,
            tags: operation.tags,
            summary: operation.summary
          },
          parameters: {
            path: pathParams,
            query: queryParams,
            header: headerParams,
            cookie: cookieParams
          },
          requestBody,
          authentication: auth,
          permissions: classification.permissions,
          risk: classification.risk,
          status: classification.status,
          metadata: {
            createdAt: new Date().toISOString(),
            autoGenerated: true,
            sourceFile: specSource
          }
        };

        tools.push(tool);
      }
    }

    return tools;
  }

  public async executeTool(
    tool: FridayyToolDefinition,
    input: Record<string, any>,
    context: AdapterExecutionContext = {}
  ): Promise<ToolExecutionResult> {
    const authManager = new AuthenticationManager(context.config);
    const baseUrl = defaultSecretResolver.resolveBaseUrl(context.config?.source?.baseUrl);

    // Build base request
    const preparedReq = buildHttpRequest(tool, input, baseUrl);

    // Apply custom execution context headers
    if (context.headers) {
      Object.assign(preparedReq.headers, context.headers);
    }

    // Apply authentication
    authManager.applyAuth(tool.authentication, {
      headers: preparedReq.headers,
      queryParams: {}
    });

    // Execute via REST executor
    return await this.restExecutor.execute(preparedReq, tool.name, {
      timeoutMs: context.timeoutMs
    });
  }

  private extractParameters(rawParams: any): ParameterDefinition[] {
    if (!rawParams || !Array.isArray(rawParams)) return [];

    return rawParams.map((p: any) => ({
      name: p.name,
      in: p.in || 'query',
      required: p.required ?? p.in === 'path',
      description: p.description,
      schema: p.schema || { type: p.type || 'string' },
      example: p.example
    }));
  }

  private extractRequestBody(rawBody: any, operation: any): RequestBodyDefinition | undefined {
    // OpenAPI 3.x
    if (rawBody && rawBody.content) {
      const contentTypes = Object.keys(rawBody.content);
      const primaryType = contentTypes.find(t => t.includes('json')) || contentTypes[0] || 'application/json';
      const contentDef = rawBody.content[primaryType];

      return {
        contentType: primaryType,
        required: rawBody.required ?? false,
        description: rawBody.description,
        schema: contentDef?.schema || { type: 'object' },
        example: contentDef?.example
      };
    }

    // Swagger 2.0 (body parameter)
    if (operation && operation.parameters && Array.isArray(operation.parameters)) {
      const bodyParam = operation.parameters.find((p: any) => p.in === 'body');
      if (bodyParam) {
        return {
          contentType: 'application/json',
          required: bodyParam.required ?? false,
          description: bodyParam.description,
          schema: bodyParam.schema || { type: 'object' },
          example: bodyParam.example
        };
      }
    }

    return undefined;
  }

  private extractSecurity(opSecurity: any, securityDefinitions: any): ToolAuthentication | undefined {
    if (!opSecurity || !Array.isArray(opSecurity) || opSecurity.length === 0) {
      return undefined;
    }

    const firstSec = opSecurity[0];
    const schemeName = Object.keys(firstSec)[0];
    if (!schemeName) return undefined;

    const schemeDef = securityDefinitions?.[schemeName];
    if (!schemeDef) {
      return {
        required: true,
        schemeName,
        type: 'apiKey'
      };
    }

    if (schemeDef.type === 'http') {
      if (schemeDef.scheme === 'bearer') {
        return {
          required: true,
          type: 'bearer',
          schemeName
        };
      }
      if (schemeDef.scheme === 'basic') {
        return {
          required: true,
          type: 'basic',
          schemeName
        };
      }
    }

    if (schemeDef.type === 'apiKey') {
      return {
        required: true,
        type: 'apiKey',
        schemeName,
        headerName: schemeDef.in === 'header' ? schemeDef.name : undefined,
        queryParam: schemeDef.in === 'query' ? schemeDef.name : undefined
      };
    }

    if (schemeDef.type === 'oauth2') {
      return {
        required: true,
        type: 'oauth2',
        schemeName
      };
    }

    return {
      required: true,
      schemeName,
      type: 'apiKey'
    };
  }
}
