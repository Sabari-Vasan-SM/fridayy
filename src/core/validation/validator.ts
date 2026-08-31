/**
 * Fridayy - Input Validation Engine
 * Validates tool call arguments against the tool's JSON Schema before dispatching.
 */

import { z } from 'zod';
import { FridayyToolDefinition } from '../schema/types.js';

export class ValidationError extends Error {
  public readonly code = 'INVALID_INPUT';
  public readonly toolName: string;
  public readonly errors: Array<{ path: string; message: string }>;

  constructor(toolName: string, errors: Array<{ path: string; message: string }>) {
    const msg = `Input validation failed for tool "${toolName}":\n` +
      errors.map(e => `  - ${e.path}: ${e.message}`).join('\n');
    super(msg);
    this.name = 'ValidationError';
    this.toolName = toolName;
    this.errors = errors;
  }
}

/**
 * Validates input against simple JSON Schema rules (type, required, properties, enum, minimum, maximum).
 */
export function validateToolInput(
  tool: FridayyToolDefinition,
  input: Record<string, any> = {}
): { valid: boolean; errors: Array<{ path: string; message: string }> } {
  const schema = tool.inputSchema || { type: 'object', properties: {}, required: [] };
  const errors: Array<{ path: string; message: string }> = [];

  // Check if input is an object
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Input must be a JSON object.' }]
    };
  }

  // 1. Check required properties
  const required = schema.required || [];
  for (const field of required) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push({
        path: field,
        message: `Missing required parameter: "${field}"`
      });
    }
  }

  // 2. Validate property types & constraints
  const properties = schema.properties || {};
  for (const [key, value] of Object.entries(input)) {
    const propSchema = properties[key];
    if (!propSchema) {
      // If additionalProperties is explicitly false, warn or error
      if (schema.additionalProperties === false) {
        errors.push({
          path: key,
          message: `Unknown property "${key}" is not accepted by this tool.`
        });
      }
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    const expectedType = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];

    // Basic type validation
    if (expectedType.includes('string')) {
      if (typeof value !== 'string') {
        errors.push({ path: key, message: `Expected string, got ${typeof value}` });
      } else {
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push({
            path: key,
            message: `Value must be one of: [${propSchema.enum.join(', ')}]`
          });
        }
      }
    } else if (expectedType.includes('integer') || expectedType.includes('number')) {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({ path: key, message: `Expected number, got ${typeof value}` });
      } else {
        if (propSchema.minimum !== undefined && num < propSchema.minimum) {
          errors.push({ path: key, message: `Value ${num} is less than minimum ${propSchema.minimum}` });
        }
        if (propSchema.maximum !== undefined && num > propSchema.maximum) {
          errors.push({ path: key, message: `Value ${num} is greater than maximum ${propSchema.maximum}` });
        }
      }
    } else if (expectedType.includes('boolean')) {
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        errors.push({ path: key, message: `Expected boolean, got ${typeof value}` });
      }
    } else if (expectedType.includes('array')) {
      if (!Array.isArray(value)) {
        errors.push({ path: key, message: `Expected array, got ${typeof value}` });
      }
    } else if (expectedType.includes('object')) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ path: key, message: `Expected object, got ${typeof value}` });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
