import { describe, it, expect } from 'vitest';
import { LaravelRouteScanner } from '../src/adapters/laravel/route-scanner.js';

describe('Laravel Route Scanner', () => {
  const scanner = new LaravelRouteScanner();

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
});
