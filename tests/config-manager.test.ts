import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '../src/config/config-manager.js';
import { FridayyConfig, FridayyToolDefinition } from '../src/core/schema/types.js';

describe('ConfigManager', () => {
  let tmpDir: string;
  let manager: ConfigManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-test-'));
    manager = new ConfigManager();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should save and load valid configuration', () => {
    const config: FridayyConfig = {
      name: 'test-app',
      version: '1.2.0',
      source: {
        type: 'openapi',
        path: './api.yaml'
      },
      security: {
        autoApproveRead: true,
        requireApprovalForDestructive: true
      }
    };

    manager.saveConfig(config, tmpDir);
    expect(manager.configExists(tmpDir)).toBe(true);

    const loaded = manager.loadConfig(tmpDir);
    expect(loaded.name).toBe('test-app');
    expect(loaded.version).toBe('1.2.0');
    expect(loaded.source.type).toBe('openapi');
  });

  it('should save, load, and update tool approval statuses in tools file', () => {
    const mockTools: FridayyToolDefinition[] = [
      {
        id: 'tool_1',
        name: 'list_items',
        description: 'List items',
        inputSchema: { type: 'object' },
        source: { type: 'rest' },
        permissions: { type: 'READ', read: true, write: false, destructive: false },
        risk: 'low',
        status: 'PENDING'
      },
      {
        id: 'tool_2',
        name: 'delete_item',
        description: 'Delete item',
        inputSchema: { type: 'object' },
        source: { type: 'rest' },
        permissions: { type: 'DESTRUCTIVE', read: false, write: true, destructive: true },
        risk: 'high',
        status: 'BLOCKED'
      }
    ];

    manager.saveTools(mockTools, 'test', tmpDir);
    const loaded = manager.loadTools(tmpDir);
    expect(loaded.length).toBe(2);
    expect(loaded[0].status).toBe('PENDING');

    // Update single tool status
    const updated = manager.updateToolStatus('list_items', 'APPROVED', tmpDir);
    expect(updated).toBe(true);

    const reloaded = manager.loadTools(tmpDir);
    expect(reloaded.find(t => t.name === 'list_items')?.status).toBe('APPROVED');
    expect(reloaded.find(t => t.name === 'list_items')?.metadata?.approvedBy).toBe('developer');
  });

  it('should bulk update tool statuses by filter', () => {
    const mockTools: FridayyToolDefinition[] = [
      {
        id: 'tool_1',
        name: 'read_1',
        description: 'Read 1',
        inputSchema: { type: 'object' },
        source: { type: 'rest' },
        permissions: { type: 'READ', read: true, write: false, destructive: false },
        risk: 'low',
        status: 'PENDING'
      },
      {
        id: 'tool_2',
        name: 'read_2',
        description: 'Read 2',
        inputSchema: { type: 'object' },
        source: { type: 'rest' },
        permissions: { type: 'READ', read: true, write: false, destructive: false },
        risk: 'low',
        status: 'PENDING'
      }
    ];

    manager.saveTools(mockTools, 'test', tmpDir);
    const count = manager.bulkUpdateStatus(t => t.permissions.type === 'READ', 'APPROVED', tmpDir);
    expect(count).toBe(2);

    const reloaded = manager.loadTools(tmpDir);
    expect(reloaded.every(t => t.status === 'APPROVED')).toBe(true);
  });
});
