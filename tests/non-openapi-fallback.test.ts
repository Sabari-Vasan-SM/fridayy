import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCli } from '../src/cli/index.js';
import { defaultConfigManager } from '../src/config/config-manager.js';
import { defaultProjectScanner } from '../src/core/discovery/project-scanner.js';
import { defaultToolGenerator } from '../src/core/tool-generator/generator.js';

describe('Non-OpenAPI Fallback & Node/REST Source Selection', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-fallback-test-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should auto-detect Node.js project and set source.type = "nodejs" when no OpenAPI exists', async () => {
    // Create a mock package.json and an Express route file
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'mock-express-app', dependencies: { express: '^4.18.2' } })
    );
    fs.writeFileSync(
      path.join(tmpDir, 'server.js'),
      `
      const express = require('express');
      const app = express();
      app.get('/api/users', (req, res) => res.json([]));
      app.post('/api/users', (req, res) => res.json({}));
      `
    );

    const cli = createCli();
    await cli.parseAsync(['node', 'fridayy', 'init', '--yes']);

    expect(defaultConfigManager.configExists(tmpDir)).toBe(true);
    const config = defaultConfigManager.loadConfig(tmpDir);
    expect(config.source.type).toBe('nodejs');

    // Run generate
    await cli.parseAsync(['node', 'fridayy', 'generate']);
    const tools = defaultConfigManager.loadTools(tmpDir);
    expect(tools.length).toBe(2);
    expect(tools.map(t => t.name)).toContain('get_users');
    expect(tools.map(t => t.name)).toContain('create_user');
  });

  it('should support explicit --source rest and --url flags', async () => {
    const cli = createCli();
    await cli.parseAsync(['node', 'fridayy', 'init', '--yes', '--source', 'rest', '--url', 'http://localhost:4000']);

    const config = defaultConfigManager.loadConfig(tmpDir);
    expect(config.source.type).toBe('rest');
    expect(config.source.baseUrl).toBe('http://localhost:4000');

    // Run generate
    await cli.parseAsync(['node', 'fridayy', 'generate']);
    const tools = defaultConfigManager.loadTools(tmpDir);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.map(t => t.name)).toContain('check_api_health');
    expect(tools.map(t => t.name)).toContain('call_api_endpoint');
  });

  it('should auto-detect a Laravel project (artisan + composer.json) even when package.json is also present', async () => {
    // Laravel apps very commonly ship a package.json too (for Vite/Mix frontend
    // tooling), so detection must prefer Laravel over the generic Node.js path
    // when artisan/composer.json are present.
    fs.writeFileSync(path.join(tmpDir, 'artisan'), '#!/usr/bin/env php\n<?php\n');
    fs.writeFileSync(
      path.join(tmpDir, 'composer.json'),
      JSON.stringify({ require: { 'laravel/framework': '^11.0' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'frontend-assets' }));
    fs.mkdirSync(path.join(tmpDir, 'routes'));
    fs.writeFileSync(
      path.join(tmpDir, 'routes', 'api.php'),
      `<?php
Route::get('/users', [UserController::class, 'index']);
Route::apiResource('posts', PostController::class);
`
    );

    const cli = createCli();
    await cli.parseAsync(['node', 'fridayy', 'init', '--yes']);

    const config = defaultConfigManager.loadConfig(tmpDir);
    expect(config.source.type).toBe('laravel');
    expect(config.source.baseUrl).toBe('http://localhost:8000');

    await cli.parseAsync(['node', 'fridayy', 'generate']);
    const tools = defaultConfigManager.loadTools(tmpDir);
    expect(tools.map(t => t.name)).toContain('get_users');
    // 1 plain route + 6 apiResource actions
    expect(tools.length).toBe(7);
  });

  it('should support explicit --source laravel and --url flags', async () => {
    fs.mkdirSync(path.join(tmpDir, 'routes'));
    fs.writeFileSync(
      path.join(tmpDir, 'routes', 'api.php'),
      `<?php
Route::delete('/orders/{id}', [OrderController::class, 'destroy']);
`
    );

    const cli = createCli();
    await cli.parseAsync([
      'node',
      'fridayy',
      'init',
      '--yes',
      '--source',
      'laravel',
      '--url',
      'http://localhost:9000'
    ]);

    const config = defaultConfigManager.loadConfig(tmpDir);
    expect(config.source.type).toBe('laravel');
    expect(config.source.baseUrl).toBe('http://localhost:9000');

    await cli.parseAsync(['node', 'fridayy', 'generate']);
    const tools = defaultConfigManager.loadTools(tmpDir);
    expect(tools.length).toBe(1);
    expect(tools[0].status).toBe('BLOCKED'); // DELETE must stay blocked by default
  });

  it('should gracefully fallback when config points to a non-existent openapi file in a Node app', async () => {
    // Create a mock package.json and routes
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'mock-app', dependencies: { fastify: '^4.0.0' } })
    );
    fs.writeFileSync(
      path.join(tmpDir, 'app.js'),
      `
      fastify.get('/status', async () => ({ ok: true }));
      `
    );

    // Save config with non-existent openapi file
    defaultConfigManager.saveConfig(
      {
        name: 'test-fallback',
        version: '1.0.0',
        source: { type: 'openapi', path: './non_existent_openapi.yaml' }
      },
      tmpDir
    );

    const config = defaultConfigManager.loadConfig(tmpDir);
    const tools = await defaultToolGenerator.generate({ config, rootDir: tmpDir });
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('get_status');
  });
});
