import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
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
    const byName = Object.fromEntries(tools.map(t => [t.name, t]));

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
});
