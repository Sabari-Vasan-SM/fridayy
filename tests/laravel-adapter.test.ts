import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LaravelAdapter } from '../src/adapters/laravel/adapter.js';
import { FridayyConfig } from '../src/core/schema/types.js';

describe('Laravel Adapter', () => {
  const adapter = new LaravelAdapter();
  let projectDir: string;

  const config: FridayyConfig = {
    name: 'laravel-demo',
    source: { type: 'laravel', rootDir: './', baseUrl: 'http://localhost:8000' },
    security: { requireApprovalForDestructive: true, autoApproveRead: true, autoApproveWrite: false }
  };

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-laravel-'));
    fs.writeFileSync(path.join(projectDir, 'artisan'), '#!/usr/bin/env php\n<?php // fake artisan\n');
    fs.writeFileSync(
      path.join(projectDir, 'composer.json'),
      JSON.stringify({ require: { 'laravel/framework': '^11.0' } }, null, 2)
    );
    fs.mkdirSync(path.join(projectDir, 'routes'));
    fs.writeFileSync(
      path.join(projectDir, 'routes', 'api.php'),
      `<?php
use Illuminate\\Support\\Facades\\Route;

// List all products
Route::get('/products', [ProductController::class, 'index']);

Route::apiResource('orders', OrderController::class)->only(['index', 'show']);

Route::delete('/products/{id}', [ProductController::class, 'destroy']);
`
    );
  });

  beforeEach(() => {
    vi.stubEnv('FRIDAYY_API_URL', '');
    vi.stubEnv('FRIDAYY_BASE_URL', '');
    vi.stubEnv('API_URL', '');
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('detects a Laravel project via artisan + composer.json', async () => {
    const result = await adapter.detect({ rootDir: projectDir, config });
    expect(result.detected).toBe(true);
    expect(result.details.framework).toBe('laravel');
  });

  it('does not detect a Laravel project in an unrelated empty directory', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-not-laravel-'));
    try {
      const result = await adapter.detect({ rootDir: emptyDir, config });
      expect(result.detected).toBe(false);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('generates tools with correct classification for discovered routes', async () => {
    const tools = await adapter.generateTools({ rootDir: projectDir, config });

    const getProducts = tools.find(t => t.source.method === 'GET' && t.source.path === '/api/products');
    expect(getProducts).toBeDefined();
    expect(getProducts!.permissions.type).toBe('READ');
    expect(getProducts!.status).toBe('APPROVED');
    expect(getProducts!.source.baseUrl).toBe('http://localhost:8000');

    const deleteProduct = tools.find(t => t.source.method === 'DELETE' && t.source.path === '/api/products/{id}');
    expect(deleteProduct).toBeDefined();
    expect(deleteProduct!.permissions.type).toBe('DESTRUCTIVE');
    // Destructive operations must be BLOCKED by default, same guarantee as every other adapter.
    expect(deleteProduct!.status).toBe('BLOCKED');

    const orderRoutes = tools.filter(t => t.source.path?.startsWith('/api/orders'));
    expect(orderRoutes.length).toBe(2); // ->only(['index', 'show']) should limit apiResource expansion
  });

  it('detects Lumen from require-dev and route-only PHP projects with useful details', async () => {
    const lumenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-lumen-'));
    const routeOnlyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-route-only-'));
    try {
      fs.writeFileSync(
        path.join(lumenDir, 'composer.json'),
        JSON.stringify({ 'require-dev': { 'laravel/lumen-framework': '^10.0' } })
      );

      fs.mkdirSync(path.join(routeOnlyDir, 'routes'));
      fs.writeFileSync(path.join(routeOnlyDir, 'routes', 'web.php'), `<?php\nRoute::get('/status', StatusController::class);\n`);
      fs.writeFileSync(path.join(routeOnlyDir, 'composer.json'), '{ malformed json');

      await expect(adapter.detect({ rootDir: lumenDir, config })).resolves.toMatchObject({
        detected: true,
        details: { framework: 'laravel', discoveredRoutesCount: 0 }
      });
      await expect(adapter.detect({ rootDir: routeOnlyDir, config })).resolves.toMatchObject({
        detected: true,
        details: { framework: 'custom-php', discoveredRoutesCount: 1 }
      });
    } finally {
      fs.rmSync(lumenDir, { recursive: true, force: true });
      fs.rmSync(routeOnlyDir, { recursive: true, force: true });
    }
  });

  it('generates required path schemas, source metadata, and stable collision suffixes', async () => {
    const resourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-laravel-resource-'));
    try {
      fs.mkdirSync(path.join(resourceDir, 'routes'));
      fs.writeFileSync(
        path.join(resourceDir, 'routes', 'api.php'),
        `<?php
Route::apiResource('orders', App\\Http\\Controllers\\OrderController::class);
`
      );

      const tools = await adapter.generateTools({ rootDir: resourceDir, config });
      const showOrder = tools.find(tool => tool.source.method === 'GET' && tool.source.path === '/api/orders/{id}');

      expect(tools.map(tool => tool.name)).toEqual([
        'get_orders',
        'create_order',
        'get_order',
        'update_order',
        'update_order_2',
        'delete_order'
      ]);
      expect(showOrder?.parameters?.path).toEqual([
        expect.objectContaining({ name: 'id', in: 'path', required: true, schema: { type: 'string' } })
      ]);
      expect(showOrder?.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        additionalProperties: false,
        properties: { id: { type: 'string', description: 'Path parameter id' } }
      });
      expect(showOrder?.metadata).toMatchObject({
        autoGenerated: true,
        sourceFile: path.join(resourceDir, 'routes', 'api.php'),
        line: 2,
        controller: 'App\\Http\\Controllers\\OrderController'
      });
      expect(showOrder?.metadata?.createdAt).toEqual(expect.any(String));
    } finally {
      fs.rmSync(resourceDir, { recursive: true, force: true });
    }
  });

  it('executes generated tools with encoded path input, request body, custom headers, and configured auth', async () => {
    const [tool] = (await adapter.generateTools({ rootDir: projectDir, config })).filter(
      candidate => candidate.source.method === 'DELETE'
    );
    tool.authentication = { required: true, type: 'bearer', schemeName: 'admin' };
    const executionConfig: FridayyConfig = {
      ...config,
      source: { ...config.source, baseUrl: 'http://laravel.test' },
      auth: { admin: { type: 'bearer', value: 'secret-token' } }
    };
    const input = { id: 'product/42', reason: 'duplicate' };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adapter.executeTool(tool, input, {
      config: executionConfig,
      headers: { 'X-Trace-Id': 'trace-123' },
      timeoutMs: 250
    });

    expect(result).toMatchObject({ success: true, data: { deleted: true } });
    expect(input).toEqual({ id: 'product/42', reason: 'duplicate' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('http://laravel.test/api/products/product%2F42');
    expect(request).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ reason: 'duplicate' }),
      headers: expect.objectContaining({
        Accept: 'application/json, text/plain, */*',
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json',
        'X-Trace-Id': 'trace-123'
      })
    });
  });
});
