import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LaravelRouteScanner } from '../src/adapters/laravel/route-scanner.js';

describe('Laravel Route Scanner', () => {
  const scanner = new LaravelRouteScanner();
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-laravel-scanner-'));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('extracts plain Route::{method}() declarations with path params and comments', () => {
    const content = `<?php

use Illuminate\\Support\\Facades\\Route;

// List all active products
Route::get('/products', [ProductController::class, 'index']);

/**
 * Retrieve a single product by ID
 */
Route::get('/products/{id}', [ProductController::class, 'show']);

Route::post('/products', [ProductController::class, 'store']);

Route::delete('/products/{id}', [ProductController::class, 'destroy']);
`;

    const routes = scanner.scanFileContent(content, 'routes/web.php');

    expect(routes.length).toBe(4);

    expect(routes[0].method).toBe('GET');
    expect(routes[0].path).toBe('/products');
    expect(routes[0].description).toBe('List all active products');

    expect(routes[1].method).toBe('GET');
    expect(routes[1].path).toBe('/products/{id}');
    expect(routes[1].pathParams).toEqual(['id']);
    expect(routes[1].description).toBe('Retrieve a single product by ID');

    expect(routes[2].method).toBe('POST');
    expect(routes[2].path).toBe('/products');

    expect(routes[3].method).toBe('DELETE');
    expect(routes[3].path).toBe('/products/{id}');
    expect(routes[3].pathParams).toEqual(['id']);
  });

  it('prefixes routes declared in api.php with /api by Laravel convention', () => {
    const content = `<?php
Route::get('/users', [UserController::class, 'index']);
`;
    const routes = scanner.scanFileContent(content, 'routes/api.php');
    expect(routes[0].path).toBe('/api/users');
  });

  it('does not double-prefix a route that already starts with /api', () => {
    const content = `<?php
Route::get('/api/users', [UserController::class, 'index']);
`;
    const routes = scanner.scanFileContent(content, 'routes/api.php');
    expect(routes[0].path).toBe('/api/users');
  });

  it('applies Route::prefix()->group() prefixes, including nested groups', () => {
    const content = `<?php
Route::prefix('v1')->middleware('api')->group(function () {
    Route::get('/orders', [OrderController::class, 'index']);

    Route::prefix('admin')->group(function () {
        Route::delete('/orders/{id}', [OrderController::class, 'destroy']);
    });
});

Route::get('/status', [StatusController::class, 'index']);
`;
    const routes = scanner.scanFileContent(content, 'routes/api.php');

    const byPath = Object.fromEntries(routes.map(r => [`${r.method} ${r.path}`, r]));
    expect(byPath['GET /api/v1/orders']).toBeDefined();
    expect(byPath['DELETE /api/v1/admin/orders/{id}']).toBeDefined();
    // Route declared after the group closes must not inherit its prefix.
    expect(byPath['GET /api/status']).toBeDefined();
  });

  it('expands Route::apiResource into the standard RESTful action set', () => {
    const content = `<?php
Route::apiResource('users', UserController::class);
`;
    const routes = scanner.scanFileContent(content, 'routes/api.php');
    const byMethodPath = routes.map(r => `${r.method} ${r.path}`).sort();

    expect(byMethodPath).toEqual(
      [
        'GET /api/users',
        'POST /api/users',
        'GET /api/users/{id}',
        'PUT /api/users/{id}',
        'PATCH /api/users/{id}',
        'DELETE /api/users/{id}'
      ].sort()
    );
  });

  it('expands Route::resource with create/edit form routes included', () => {
    const content = `<?php
Route::resource('posts', PostController::class);
`;
    const routes = scanner.scanFileContent(content, 'routes/web.php');
    const paths = routes.map(r => `${r.method} ${r.path}`);

    expect(paths).toContain('GET /posts/create');
    expect(paths).toContain('GET /posts/{id}/edit');
    expect(routes.length).toBe(8);
  });

  it('honors ->only([...]) on a resource route', () => {
    const content = `<?php
Route::apiResource('comments', CommentController::class)->only(['index', 'show']);
`;
    const routes = scanner.scanFileContent(content, 'routes/api.php');
    const paths = routes.map(r => `${r.method} ${r.path}`).sort();
    expect(paths).toEqual(['GET /api/comments', 'GET /api/comments/{id}'].sort());
  });

  it('honors ->except([...]) on a resource route', () => {
    const content = `<?php
Route::apiResource('comments', CommentController::class)->except(['destroy']);
`;
    const routes = scanner.scanFileContent(content, 'routes/api.php');
    expect(routes.some(r => r.method === 'DELETE')).toBe(false);
    expect(routes.length).toBe(5);
  });

  it('classifies a route with an optional path parameter correctly', () => {
    const content = `<?php
Route::get('/reports/{year?}', [ReportController::class, 'index']);
`;
    const routes = scanner.scanFileContent(content, 'routes/web.php');
    expect(routes[0].pathParams).toEqual(['year']);
  });

  it('supports every unambiguous HTTP method and ignores any/match declarations', () => {
    const content = `<?php
Route::get('/health', HealthController::class);
Route::post('/jobs', JobController::class);
Route::put('/jobs/{job_id}', JobController::class);
Route::patch('/jobs/{job_id}', JobController::class);
Route::delete('/jobs/{job_id}', JobController::class);
Route::options('/jobs', JobController::class);
Route::any('/catch-all', CatchAllController::class);
Route::match(['get', 'post'], '/matched', MatchedController::class);
`;

    const routes = scanner.scanFileContent(content, 'routes/web.php');

    expect(routes.map(route => route.method)).toEqual([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ]);
    expect(routes.every(route => !['/catch-all', '/matched'].includes(route.path))).toBe(true);
    expect(routes[2].pathParams).toEqual(['job_id']);
  });

  it('preserves an outer prefix through a nested middleware-only group', () => {
    const content = `<?php
Route::prefix('v2')->group(function () {
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/profile', ProfileController::class);
    });
    Route::get('/status', StatusController::class);
});
Route::get('/public', PublicController::class);
`;

    const routes = scanner.scanFileContent(content, 'routes/api.php');

    expect(routes.map(route => route.path)).toEqual([
      '/api/v2/profile',
      '/api/v2/status',
      '/api/public'
    ]);
  });

  it('reports source locations and hash comments while normalizing extra slashes', () => {
    const content = `<?php

# Administrative audit log
Route::get('//admin/audit//', AuditController::class);
`;

    const [route] = scanner.scanFileContent(content, '/project/routes/web.php');

    expect(route).toMatchObject({
      method: 'GET',
      path: '/admin/audit',
      file: '/project/routes/web.php',
      line: 4,
      description: 'Administrative audit log'
    });
  });

  it('recursively scans PHP files, ignores other extensions, and deduplicates method/path pairs', async () => {
    const routesDir = path.join(projectDir, 'routes');
    const nestedDir = path.join(routesDir, 'admin');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(routesDir, 'api.php'), `<?php\nRoute::get('/users', UserController::class);\n`);
    fs.writeFileSync(path.join(nestedDir, 'duplicate.php'), `<?php\nRoute::get('/api/users', UserController::class);\n`);
    fs.writeFileSync(path.join(nestedDir, 'reports.PHP'), `<?php\nRoute::post('/reports', ReportController::class);\n`);
    fs.writeFileSync(path.join(routesDir, 'ignored.txt'), `Route::delete('/users', UserController::class);\n`);

    const routes = await scanner.scanDirectory(projectDir);

    expect(routes.map(route => `${route.method} ${route.path}`).sort()).toEqual([
      'GET /api/users',
      'POST /reports'
    ]);
    expect(routes.filter(route => route.path === '/api/users')).toHaveLength(1);
    expect(await scanner.scanDirectory(projectDir, 1)).toHaveLength(1);
  });

  it('returns no routes when the routes directory is absent or contains no declarations', async () => {
    expect(await scanner.scanDirectory(projectDir)).toEqual([]);

    fs.mkdirSync(path.join(projectDir, 'routes'));
    fs.writeFileSync(path.join(projectDir, 'routes', 'web.php'), '<?php\n// Route definitions are loaded dynamically.\n');

    expect(await scanner.scanDirectory(projectDir)).toEqual([]);
  });
});
