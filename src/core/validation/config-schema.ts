/**
 * Fridayy - Configuration Validation Schema
 * Uses Zod to validate Fridayy configuration and tool definitions.
 */

import { z } from 'zod';

export const ToolPermissionTypeSchema = z.enum(['READ', 'WRITE', 'DESTRUCTIVE']);
export const ToolRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export const ToolApprovalStatusSchema = z.enum(['APPROVED', 'PENDING', 'BLOCKED', 'REJECTED']);

export const ParameterDefinitionSchema = z.object({
  name: z.string(),
  in: z.enum(['path', 'query', 'header', 'cookie']),
  required: z.boolean().default(false),
  description: z.string().optional(),
  schema: z.record(z.any()).default({ type: 'string' }),
  example: z.any().optional()
});

export const RequestBodyDefinitionSchema = z.object({
  contentType: z.string().default('application/json'),
  required: z.boolean().default(false),
  description: z.string().optional(),
  schema: z.record(z.any()).default({ type: 'object' }),
  example: z.any().optional()
});

export const ToolAuthenticationSchema = z.object({
  required: z.boolean().default(false),
  type: z.enum(['apiKey', 'bearer', 'basic', 'customHeader', 'oauth2', 'none']).optional(),
  envKey: z.string().optional(),
  headerName: z.string().optional(),
  queryParam: z.string().optional(),
  schemeName: z.string().optional(),
  description: z.string().optional()
});

export const FridayyToolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Tool name must contain only alphanumeric characters, underscores, and dashes'),
  description: z.string(),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()).optional().default({}),
    required: z.array(z.string()).optional().default([]),
    additionalProperties: z.boolean().optional()
  }).passthrough(),
  outputSchema: z.record(z.any()).optional(),
  source: z.object({
    type: z.string(),
    method: z.string().optional(),
    url: z.string().optional(),
    path: z.string().optional(),
    baseUrl: z.string().optional(),
    handler: z.string().optional(),
    endpoint: z.string().optional(),
    operationId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    summary: z.string().optional()
  }).passthrough(),
  parameters: z.object({
    path: z.array(ParameterDefinitionSchema).optional(),
    query: z.array(ParameterDefinitionSchema).optional(),
    header: z.array(ParameterDefinitionSchema).optional(),
    cookie: z.array(ParameterDefinitionSchema).optional()
  }).optional(),
  requestBody: RequestBodyDefinitionSchema.optional(),
  authentication: ToolAuthenticationSchema.optional(),
  permissions: z.object({
    type: ToolPermissionTypeSchema,
    read: z.boolean(),
    write: z.boolean(),
    destructive: z.boolean(),
    requiresConfirmation: z.boolean().optional()
  }),
  risk: ToolRiskLevelSchema,
  status: ToolApprovalStatusSchema,
  rateLimit: z.object({
    maxRequests: z.number().positive(),
    windowSeconds: z.number().positive()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export const FridayyConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  version: z.string().optional().default('1.0.0'),
  description: z.string().optional(),
  source: z.object({
    type: z.enum(['openapi', 'rest', 'nodejs', 'manual', 'auto']),
    path: z.string().optional(),
    url: z.string().optional(),
    baseUrl: z.string().optional(),
    rootDir: z.string().optional()
  }).passthrough(),
  server: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    transport: z.enum(['stdio', 'sse']).optional().default('stdio'),
    port: z.number().optional().default(3000),
    host: z.string().optional().default('localhost'),
    maxRequestsPerMinute: z.number().optional().default(60)
  }).optional().default({}),
  security: z.object({
    requireApprovalForDestructive: z.boolean().optional().default(true),
    autoApproveRead: z.boolean().optional().default(true),
    autoApproveWrite: z.boolean().optional().default(false),
    allowlist: z.array(z.string()).optional(),
    denylist: z.array(z.string()).optional(),
    rateLimit: z.object({
      maxRequests: z.number().positive(),
      windowSeconds: z.number().positive()
    }).optional(),
    secretEnvPrefix: z.string().optional().default('FRIDAYY_')
  }).optional().default({}),
  auth: z.record(z.object({
    type: z.enum(['apiKey', 'bearer', 'basic', 'customHeader', 'oauth2', 'none']),
    envKey: z.string().optional(),
    headerName: z.string().optional(),
    queryParam: z.string().optional(),
    value: z.string().optional()
  })).optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
    auditLogPath: z.string().optional(),
    maskSecrets: z.boolean().optional().default(true)
  }).optional().default({}),
  tools: z.object({
    autoGenerate: z.boolean().optional().default(true),
    toolsFile: z.string().optional().default('./fridayy.tools.json'),
    includeTags: z.array(z.string()).optional(),
    excludeTags: z.array(z.string()).optional(),
    includePaths: z.array(z.string()).optional(),
    excludePaths: z.array(z.string()).optional()
  }).optional().default({})
});

export const ToolsFileSchema = z.object({
  version: z.string().default('1.0.0'),
  generatedAt: z.string(),
  source: z.string(),
  tools: z.array(FridayyToolDefinitionSchema)
});
