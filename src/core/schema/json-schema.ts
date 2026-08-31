/**
 * Fridayy - JSON Schema Unifier and Normalizer
 * Combines OpenAPI/REST path, query, header parameters and request bodies
 * into a single unified JSON Schema for standard MCP tools.
 */

import { ParameterDefinition, RequestBodyDefinition } from './types.js';

export interface UnifySchemaOptions {
  parameters?: {
    path?: ParameterDefinition[];
    query?: ParameterDefinition[];
    header?: ParameterDefinition[];
    cookie?: ParameterDefinition[];
  };
  requestBody?: RequestBodyDefinition;
}

/**
 * Normalizes an OpenAPI / JSON Schema type object into standard JSON Schema Draft-7 / 2020-12
 */
export function normalizeSchema(rawSchema: any): Record<string, any> {
  if (!rawSchema || typeof rawSchema !== 'object') {
    return { type: 'string' };
  }

  const schema: Record<string, any> = { ...rawSchema };

  // Handle nullable
  if (schema.nullable && schema.type) {
    if (typeof schema.type === 'string') {
      schema.type = [schema.type, 'null'];
    }
    delete schema.nullable;
  }

  // Handle recursive objects
  if (schema.type === 'object' && schema.properties) {
    const normalizedProps: Record<string, any> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      normalizedProps[key] = normalizeSchema(prop);
    }
    schema.properties = normalizedProps;
  }

  // Handle arrays
  if (schema.type === 'array' && schema.items) {
    schema.items = normalizeSchema(schema.items);
  }

  // Clean up non-standard OpenAPI properties from tool input schema
  delete schema.xml;
  delete schema.externalDocs;
  delete schema.example;

  return schema;
}

/**
 * Unifies all parameters and request body into a top-level MCP Tool inputSchema object.
 */
export function buildUnifiedInputSchema(options: UnifySchemaOptions): {
  type: 'object';
  properties: Record<string, any>;
  required: string[];
  additionalProperties?: boolean;
} {
  const properties: Record<string, any> = {};
  const requiredFields: Set<string> = new Set();

  // 1. Process Path Parameters
  if (options.parameters?.path) {
    for (const param of options.parameters.path) {
      const propSchema = normalizeSchema(param.schema);
      if (param.description && !propSchema.description) {
        propSchema.description = param.description;
      }
      properties[param.name] = propSchema;
      // Path parameters are always required
      requiredFields.add(param.name);
    }
  }

  // 2. Process Query Parameters
  if (options.parameters?.query) {
    for (const param of options.parameters.query) {
      const propSchema = normalizeSchema(param.schema);
      if (param.description && !propSchema.description) {
        propSchema.description = param.description;
      }
      properties[param.name] = propSchema;
      if (param.required) {
        requiredFields.add(param.name);
      }
    }
  }

  // 3. Process Header Parameters (skip standard auth headers to avoid exposing secrets)
  if (options.parameters?.header) {
    for (const param of options.parameters.header) {
      const lower = param.name.toLowerCase();
      if (lower === 'authorization' || lower === 'x-api-key') {
        continue;
      }
      const propSchema = normalizeSchema(param.schema);
      if (param.description && !propSchema.description) {
        propSchema.description = param.description;
      }
      properties[param.name] = propSchema;
      if (param.required) {
        requiredFields.add(param.name);
      }
    }
  }

  // 4. Process Request Body
  if (options.requestBody && options.requestBody.schema) {
    const bodySchema = normalizeSchema(options.requestBody.schema);

    if (bodySchema.type === 'object' && bodySchema.properties) {
      // Flatten top-level properties if they don't collide with path/query params
      for (const [propName, propVal] of Object.entries(bodySchema.properties)) {
        if (!properties[propName]) {
          properties[propName] = propVal;
          if (Array.isArray(bodySchema.required) && bodySchema.required.includes(propName)) {
            if (options.requestBody.required) {
              requiredFields.add(propName);
            }
          }
        } else {
          // If collision, put into a nested body object
          properties['body'] = bodySchema;
          if (options.requestBody.required) {
            requiredFields.add('body');
          }
          break;
        }
      }
    } else {
      // Primitive or array body
      properties['body'] = {
        ...bodySchema,
        description: options.requestBody.description || 'Request payload'
      };
      if (options.requestBody.required) {
        requiredFields.add('body');
      }
    }
  }

  return {
    type: 'object',
    properties,
    required: Array.from(requiredFields),
    additionalProperties: false
  };
}
