import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { OpenApiParser } from '../src/adapters/openapi/parser.js';

describe('OpenApiParser', () => {
  const parser = new OpenApiParser();

  it('should parse an OpenAPI 3.0 YAML file', async () => {
    const specPath = path.resolve('examples/ecommerce/openapi.yaml');
    const spec = await parser.parse(specPath);

    expect(spec.version).toBe('3.0.3');
    expect(spec.title).toBe('Fridayy E-Commerce Store API');
    expect(spec.paths).toBeDefined();
    expect(spec.paths['/products']).toBeDefined();
    expect(spec.paths['/products'].get).toBeDefined();
    expect(spec.paths['/orders'].post).toBeDefined();
  });

  it('should parse raw JSON string spec with $ref resolution', async () => {
    const rawJson = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      servers: [{ url: 'https://api.example.com' }],
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      },
      paths: {
        '/users': {
          get: {
            summary: 'Get all users',
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const parsed = await parser.parse(rawJson);
    expect(parsed.title).toBe('Test API');
    expect(parsed.servers[0].url).toBe('https://api.example.com');
    const responseSchema = parsed.paths['/users'].get.responses['200'].content['application/json'].schema;
    expect(responseSchema.items.properties.name.type).toBe('string');
  });

  it('should normalize Swagger 2.0 specs to components/schemas', async () => {
    const swaggerDoc = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Legacy Swagger API', version: '2.0.0' },
      host: 'legacy.example.com',
      basePath: '/v2',
      schemes: ['https'],
      paths: {
        '/items': {
          get: {
            summary: 'List items',
            parameters: [
              { name: 'q', in: 'query', type: 'string' }
            ]
          }
        }
      }
    });

    const parsed = await parser.parse(swaggerDoc);
    expect(parsed.title).toBe('Legacy Swagger API');
    expect(parsed.servers[0].url).toBe('https://legacy.example.com/v2');
    expect(parsed.paths['/items'].get.parameters[0].name).toBe('q');
  });

  it('should throw clear error on missing file', async () => {
    await expect(parser.parse('non-existent-spec.yaml')).rejects.toThrow('OpenAPI specification file not found');
  });
});
