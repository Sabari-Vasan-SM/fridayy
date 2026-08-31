import { describe, it, expect } from 'vitest';
import { buildUnifiedInputSchema, normalizeSchema } from '../src/core/schema/json-schema.js';

describe('Schema Normalizer & Converter', () => {
  it('should normalize nullable types and remove non-standard fields', () => {
    const raw = {
      type: 'string',
      nullable: true,
      xml: { name: 'Item' },
      example: 'foo'
    };
    const normalized = normalizeSchema(raw);
    expect(normalized.type).toEqual(['string', 'null']);
    expect(normalized.xml).toBeUndefined();
    expect(normalized.example).toBeUndefined();
  });

  it('should unify path parameters, query parameters, and request body into a single JSON schema', () => {
    const unified = buildUnifiedInputSchema({
      parameters: {
        path: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' }, description: 'User ID' }
        ],
        query: [
          { name: 'verbose', in: 'query', required: false, schema: { type: 'boolean' } }
        ],
        header: [
          { name: 'X-Custom-Tenant', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'Authorization', in: 'header', required: true, schema: { type: 'string' } } // Should be stripped
        ]
      },
      requestBody: {
        contentType: 'application/json',
        required: true,
        schema: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['admin', 'user'] },
            notes: { type: 'string' }
          }
        }
      }
    });

    expect(unified.type).toBe('object');
    expect(unified.properties.userId).toBeDefined();
    expect(unified.properties.userId.description).toBe('User ID');
    expect(unified.properties.verbose).toBeDefined();
    expect(unified.properties['X-Custom-Tenant']).toBeDefined();
    // Authorization header must be excluded
    expect(unified.properties['Authorization']).toBeUndefined();
    // Body properties merged
    expect(unified.properties.role).toBeDefined();
    expect(unified.properties.notes).toBeDefined();
    // Required fields: userId (path param) and role (from required body)
    expect(unified.required).toContain('userId');
    expect(unified.required).toContain('role');
  });
});
