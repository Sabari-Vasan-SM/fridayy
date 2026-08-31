import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { OpenApiAdapter } from '../src/adapters/openapi/adapter.js';
import { defaultToolGenerator } from '../src/core/tool-generator/generator.js';
import { sanitizeToolName, generateToolNameFromRoute } from '../src/core/tool-generator/name-sanitizer.js';
import { FridayyConfig } from '../src/core/schema/types.js';

describe('Tool Generator & Naming', () => {
  it('should sanitize tool names to snake_case identifiers', () => {
    expect(sanitizeToolName('getUserById')).toBe('get_user_by_id');
    expect(sanitizeToolName('Create-New-Order')).toBe('create_new_order');
    expect(sanitizeToolName('API.v1.ListAllUsers')).toBe('api_v1_list_all_users');
    expect(sanitizeToolName('delete___product__')).toBe('delete_product');
  });

  it('should generate intuitive names from HTTP routes', () => {
    expect(generateToolNameFromRoute('GET', '/users')).toBe('get_users');
    expect(generateToolNameFromRoute('GET', '/users/{id}')).toBe('get_user');
    expect(generateToolNameFromRoute('POST', '/orders')).toBe('create_order');
    expect(generateToolNameFromRoute('DELETE', '/products/{productId}')).toBe('delete_product');
    expect(generateToolNameFromRoute('PUT', '/customers/{id}/profile')).toBe('update_customer_profile');
  });

  it('should generate all candidate tools from OpenAPI spec', async () => {
    const adapter = new OpenApiAdapter();
    const config: FridayyConfig = {
      name: 'ecommerce-test',
      source: {
        type: 'openapi',
        path: path.resolve('examples/ecommerce/openapi.yaml'),
        baseUrl: 'http://localhost:4000'
      }
    };

    const tools = await adapter.generateTools({
      rootDir: process.cwd(),
      config
    });

    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('get_products');
    expect(toolNames).toContain('create_product');
    expect(toolNames).toContain('get_product');
    expect(toolNames).toContain('delete_product');
    expect(toolNames).toContain('get_orders');
    expect(toolNames).toContain('create_order');
    expect(toolNames).toContain('get_users');
    expect(toolNames).toContain('create_user');
    expect(toolNames).toContain('delete_user');

    const deleteTool = tools.find(t => t.name === 'delete_product')!;
    expect(deleteTool.permissions.type).toBe('DESTRUCTIVE');
    expect(deleteTool.risk).toBe('high');
    expect(deleteTool.status).toBe('BLOCKED');

    const getProductsTool = tools.find(t => t.name === 'get_products')!;
    expect(getProductsTool.permissions.type).toBe('READ');
    expect(getProductsTool.risk).toBe('low');
    expect(getProductsTool.status).toBe('APPROVED');
  });

  it('should filter candidate tools by allowlist', async () => {
    const config: FridayyConfig = {
      name: 'allowlist-test',
      source: {
        type: 'openapi',
        path: path.resolve('examples/ecommerce/openapi.yaml')
      },
      security: {
        allowlist: ['get_products', 'get_orders']
      }
    };

    const tools = await defaultToolGenerator.generate({ config });
    expect(tools.length).toBe(2);
    expect(tools.map(t => t.name).sort()).toEqual(['get_orders', 'get_products']);
  });
});
