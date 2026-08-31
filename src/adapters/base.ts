/**
 * Fridayy - Base Adapter Interface
 * Provides the foundational abstraction for all application and API adapters.
 */

import {
  FridayyToolDefinition,
  FridayyConfig,
  ToolExecutionResult,
  ScanResult
} from '../core/schema/types.js';

export interface AdapterScanContext {
  rootDir: string;
  config?: FridayyConfig;
}

export interface AdapterGenerationContext {
  rootDir: string;
  config?: FridayyConfig;
  sourcePath?: string;
  sourceUrl?: string;
}

export interface AdapterExecutionContext {
  config?: FridayyConfig;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export abstract class BaseAdapter {
  public abstract readonly name: string;
  public abstract readonly description: string;

  /**
   * Detects whether the current workspace/target contains assets supported by this adapter.
   */
  public abstract detect(context: AdapterScanContext): Promise<{ detected: boolean; details?: any }>;

  /**
   * Generates standardized FridayyToolDefinitions from the target source.
   */
  public abstract generateTools(context: AdapterGenerationContext): Promise<FridayyToolDefinition[]>;

  /**
   * Executes a tool invocation against the underlying system.
   */
  public abstract executeTool(
    tool: FridayyToolDefinition,
    input: Record<string, any>,
    context?: AdapterExecutionContext
  ): Promise<ToolExecutionResult>;
}
