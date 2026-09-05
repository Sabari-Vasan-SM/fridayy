import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AdapterRegistry } from '../src/adapters/registry.js';
import { createCli } from '../src/cli/index.js';
import { defaultConfigManager } from '../src/config/config-manager.js';
import { ProjectScanner } from '../src/core/discovery/project-scanner.js';
import { FridayyConfigSchema } from '../src/core/validation/config-schema.js';

describe('Laravel integration points', () => {
  let projectDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-laravel-integration-'));
    vi.stubEnv('FRIDAYY_API_URL', '');
    vi.stubEnv('FRIDAYY_BASE_URL', '');
    vi.stubEnv('API_URL', '');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(projectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('registers the Laravel adapter and accepts Laravel configuration', () => {
    const registry = new AdapterRegistry();
    const parsed = FridayyConfigSchema.parse({
      name: 'laravel-app',
      source: { type: 'laravel', rootDir: './', baseUrl: 'http://localhost:8000' }
    });

    expect(registry.has('laravel')).toBe(true);
    expect(registry.get('LARAVEL')).toMatchObject({ name: 'laravel' });
    expect(parsed.source).toEqual({
      type: 'laravel',
      rootDir: './',
      baseUrl: 'http://localhost:8000'
    });
  });

  it('discovers Lumen through require-dev and recommends the Laravel adapter with route details', async () => {
    fs.writeFileSync(
      path.join(projectDir, 'composer.json'),
      JSON.stringify({ 'require-dev': { 'laravel/lumen-framework': '^10.0' } })
    );
    fs.mkdirSync(path.join(projectDir, 'routes', 'internal'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'routes', 'internal', 'api.php'),
      `<?php
Route::get('/health', HealthController::class);
Route::post('/jobs', JobController::class);
`
    );

    const result = await new ProjectScanner().scan(projectDir);

    expect(result).toMatchObject({
      hasOpenApi: false,
      hasNodeJs: false,
      hasLaravel: true,
      discoveredEndpointsCount: 2,
      recommendedConfig: {
        source: { type: 'laravel', rootDir: './', baseUrl: 'http://localhost:8000' }
      }
    });
    expect(result.details.routes?.map(route => `${route.method} ${route.path}`)).toEqual([
      'GET /api/health',
      'POST /api/jobs'
    ]);
  });

  it('keeps OpenAPI precedence when a project also contains Laravel markers', async () => {
    fs.writeFileSync(path.join(projectDir, 'artisan'), '#!/usr/bin/env php\n');
    fs.mkdirSync(path.join(projectDir, 'routes'));
    fs.writeFileSync(path.join(projectDir, 'routes', 'api.php'), `<?php\nRoute::get('/users', UserController::class);\n`);
    fs.writeFileSync(
      path.join(projectDir, 'openapi.json'),
      JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Public API', version: '1.0.0' },
        paths: { '/status': { get: { responses: { 200: { description: 'OK' } } } } }
      })
    );

    const result = await new ProjectScanner().scan(projectDir);

    expect(result.hasLaravel).toBe(true);
    expect(result.recommendedConfig.source).toMatchObject({ type: 'openapi', path: 'openapi.json' });
    expect(result.discoveredEndpointsCount).toBe(1);
    expect(result.details.openApiSpecs).toEqual([
      expect.objectContaining({ path: 'openapi.json', title: 'Public API', endpointsCount: 1 })
    ]);
  });

  it.each([
    {
      label: 'healthy project',
      files: ['artisan', 'routes'],
      expected: 'Laravel application detected (artisan + routes/) and active'
    },
    {
      label: 'missing artisan warning',
      files: ['routes'],
      expected: 'routes/ directory found but no `artisan` file'
    },
    {
      label: 'missing Laravel files error',
      files: [],
      expected: 'No `artisan` file or routes/ directory found'
    }
  ])('reports the Laravel doctor status for a $label', async ({ files, expected }) => {
    if (files.includes('artisan')) fs.writeFileSync(path.join(projectDir, 'artisan'), '#!/usr/bin/env php\n');
    if (files.includes('routes')) fs.mkdirSync(path.join(projectDir, 'routes'));
    defaultConfigManager.saveConfig({ name: 'doctor-test', source: { type: 'laravel' } }, projectDir);
    process.chdir(projectDir);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await createCli().parseAsync(['node', 'fridayy', 'doctor']);

    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain(expected);
  });
});
