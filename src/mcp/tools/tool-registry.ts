/**
 * Fridayy - Tool Registry for MCP Server
 * Manages active tools, visibility filtering, and runtime lookups.
 */

import { FridayyToolDefinition, FridayyConfig } from '../../core/schema/types.js';
import { PermissionEnforcer } from '../../core/permissions/enforcer.js';

export class ToolRegistry {
  private toolsMap: Map<string, FridayyToolDefinition> = new Map();
  private enforcer: PermissionEnforcer;

  constructor(tools: FridayyToolDefinition[] = [], config?: FridayyConfig) {
    this.enforcer = new PermissionEnforcer(config);
    this.setTools(tools);
  }

  public setTools(tools: FridayyToolDefinition[]): void {
    this.toolsMap.clear();
    for (const tool of tools) {
      this.toolsMap.set(tool.name, tool);
    }
  }

  public register(tool: FridayyToolDefinition): void {
    this.toolsMap.set(tool.name, tool);
  }

  public get(name: string): FridayyToolDefinition | undefined {
    return this.toolsMap.get(name);
  }

  public getAll(): FridayyToolDefinition[] {
    return Array.from(this.toolsMap.values());
  }

  /**
   * Returns only tools that are approved and allowed to be exposed to MCP clients.
   */
  public getExposedTools(): FridayyToolDefinition[] {
    return this.getAll().filter(tool => this.enforcer.isToolExposed(tool));
  }

  public size(): number {
    return this.toolsMap.size;
  }
}
