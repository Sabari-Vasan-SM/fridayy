import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCli } from '../src/cli/index.js';
import { defaultConfigManager } from '../src/config/config-manager.js';

describe('CLI Commands Integration', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-cli-test-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should register all expected CLI subcommands', () => {
    const cli = createCli();
    const commandNames = cli.commands.map(c => c.name());

    expect(commandNames).toContain('init');
    expect(commandNames).toContain('scan');
    expect(commandNames).toContain('generate');
    expect(commandNames).toContain('review');
    expect(commandNames).toContain('start');
    expect(commandNames).toContain('tools');
    expect(commandNames).toContain('config');
    expect(commandNames).toContain('doctor');
  });

  it('should execute init command and create valid fridayy.config.json', async () => {
    const cli = createCli();
    await cli.parseAsync(['node', 'fridayy', 'init', '--yes', '--name', 'my-test-app']);

    expect(defaultConfigManager.configExists(tmpDir)).toBe(true);
    const config = defaultConfigManager.loadConfig(tmpDir);
    expect(config.name).toBe('my-test-app');
  });

  it('should execute generate and review commands', async () => {
    // Copy e-commerce openapi spec to tmpDir
    const specSource = path.resolve(originalCwd, 'examples/ecommerce/openapi.yaml');
    fs.copyFileSync(specSource, path.join(tmpDir, 'openapi.yaml'));

    const cli = createCli();
    await cli.parseAsync(['node', 'fridayy', 'init', '--yes', '--name', 'test-app', '--spec', './openapi.yaml']);
    await cli.parseAsync(['node', 'fridayy', 'generate']);

    const tools = defaultConfigManager.loadTools(tmpDir);
    expect(tools.length).toBeGreaterThan(0);

    // Run review --approve-all
    await cli.parseAsync(['node', 'fridayy', 'review', '--approve-all']);
    const reviewedTools = defaultConfigManager.loadTools(tmpDir);
    expect(reviewedTools.every(t => t.status === 'APPROVED')).toBe(true);
  });
});
