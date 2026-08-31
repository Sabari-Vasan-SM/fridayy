/**
 * Fridayy - Configuration & Tools File Manager
 * Handles loading, saving, and updating fridayy.config.json and fridayy.tools.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  FridayyConfig,
  FridayyToolDefinition,
  ToolsFileStructure,
  ToolApprovalStatus
} from '../core/schema/types.js';
import { FridayyConfigSchema, ToolsFileSchema } from '../core/validation/config-schema.js';
import { DEFAULT_CONFIG, DEFAULT_CONFIG_FILE, DEFAULT_TOOLS_FILE } from './defaults.js';

export class ConfigManager {
  /**
   * Loads and validates fridayy.config.json.
   */
  public loadConfig(rootDir: string = process.cwd(), customFile?: string): FridayyConfig {
    const configPath = path.resolve(rootDir, customFile || DEFAULT_CONFIG_FILE);

    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}. Run 'fridayy init' to create one.`);
    }

    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const validated = FridayyConfigSchema.parse(parsed);
      return validated as FridayyConfig;
    } catch (err: any) {
      if (err.errors) {
        const issues = err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Invalid configuration in ${configPath}: ${issues}`);
      }
      throw new Error(`Failed to read configuration from ${configPath}: ${err.message}`);
    }
  }

  /**
   * Saves fridayy.config.json.
   */
  public saveConfig(config: FridayyConfig, rootDir: string = process.cwd(), customFile?: string): string {
    const configPath = path.resolve(rootDir, customFile || DEFAULT_CONFIG_FILE);
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, content, 'utf-8');
    return configPath;
  }

  /**
   * Checks if configuration exists.
   */
  public configExists(rootDir: string = process.cwd(), customFile?: string): boolean {
    const configPath = path.resolve(rootDir, customFile || DEFAULT_CONFIG_FILE);
    return fs.existsSync(configPath);
  }

  /**
   * Loads fridayy.tools.json.
   */
  public loadTools(rootDir: string = process.cwd(), customFile?: string): FridayyToolDefinition[] {
    const toolsPath = path.resolve(rootDir, customFile || DEFAULT_TOOLS_FILE);

    if (!fs.existsSync(toolsPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(toolsPath, 'utf-8');
      const parsed: ToolsFileStructure = JSON.parse(raw);
      return parsed.tools || [];
    } catch (err: any) {
      throw new Error(`Failed to load tools from ${toolsPath}: ${err.message}`);
    }
  }

  /**
   * Saves tools to fridayy.tools.json.
   */
  public saveTools(
    tools: FridayyToolDefinition[],
    source: string = 'openapi',
    rootDir: string = process.cwd(),
    customFile?: string
  ): string {
    const toolsPath = path.resolve(rootDir, customFile || DEFAULT_TOOLS_FILE);
    const payload: ToolsFileStructure = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source,
      tools
    };

    fs.writeFileSync(toolsPath, JSON.stringify(payload, null, 2), 'utf-8');
    return toolsPath;
  }

  /**
   * Updates approval status of a single tool or multiple tools in fridayy.tools.json.
   */
  public updateToolStatus(
    toolName: string,
    status: ToolApprovalStatus,
    rootDir: string = process.cwd(),
    customFile?: string
  ): boolean {
    const tools = this.loadTools(rootDir, customFile);
    let found = false;

    for (const tool of tools) {
      if (tool.name === toolName || tool.id === toolName) {
        tool.status = status;
        if (status === 'APPROVED') {
          tool.metadata = {
            ...tool.metadata,
            approvedAt: new Date().toISOString(),
            approvedBy: 'developer'
          };
        }
        found = true;
      }
    }

    if (found) {
      this.saveTools(tools, 'updated', rootDir, customFile);
    }

    return found;
  }

  /**
   * Updates multiple tools at once (e.g. approve all read tools, approve all).
   */
  public bulkUpdateStatus(
    filter: (tool: FridayyToolDefinition) => boolean,
    status: ToolApprovalStatus,
    rootDir: string = process.cwd(),
    customFile?: string
  ): number {
    const tools = this.loadTools(rootDir, customFile);
    let updatedCount = 0;

    for (const tool of tools) {
      if (filter(tool)) {
        tool.status = status;
        if (status === 'APPROVED') {
          tool.metadata = {
            ...tool.metadata,
            approvedAt: new Date().toISOString(),
            approvedBy: 'developer'
          };
        }
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      this.saveTools(tools, 'bulk-update', rootDir, customFile);
    }

    return updatedCount;
  }
}

export const defaultConfigManager = new ConfigManager();
