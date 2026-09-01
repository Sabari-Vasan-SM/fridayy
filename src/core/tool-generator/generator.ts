/**
 * Fridayy - Tool Generator Engine
 * Coordinates adapters to generate, filter, and normalize candidate MCP tools.
 * Features intelligent auto-fallback across adapters when files are missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { FridayyToolDefinition, FridayyConfig } from '../schema/types.js';
import { AdapterRegistry, defaultAdapterRegistry } from '../../adapters/registry.js';
import { isToolAllowed } from '../../security/allowlist.js';

export interface GenerationOptions {
  rootDir?: string;
  config: FridayyConfig;
  sourceTypeOverride?: 'openapi' | 'nodejs' | 'rest' | 'manual';
  preserveStatuses?: Map<string, 'APPROVED' | 'PENDING' | 'BLOCKED' | 'REJECTED'>;
}

export class ToolGenerator {
  private adapterRegistry: AdapterRegistry;

  constructor(adapterRegistry: AdapterRegistry = defaultAdapterRegistry) {
    this.adapterRegistry = adapterRegistry;
  }

  /**
   * Generates MCP tools with automated adapter fallback capabilities.
   */
  public async generate(options: GenerationOptions): Promise<FridayyToolDefinition[]> {
    const { config, rootDir = process.cwd(), preserveStatuses, sourceTypeOverride } = options;
    let sourceType = sourceTypeOverride || config.source.type || 'openapi';

    // Auto-fallback check if OpenAPI file does not exist
    if (sourceType === 'openapi') {
      const specPath = config.source.path ? path.resolve(rootDir, config.source.path) : null;
      const specExists = specPath && fs.existsSync(specPath);

      if (!specExists) {
        // Check if Node.js project exists
        const hasPkgJson = fs.existsSync(path.join(rootDir, 'package.json'));
        if (hasPkgJson && this.adapterRegistry.has('nodejs')) {
          console.warn(
            chalk.yellow(
              `⚠ OpenAPI specification not found at "${config.source.path || './openapi.yaml'}". Automatically switching to Node.js route discovery.`
            )
          );
          sourceType = 'nodejs';
        } else if (config.source.baseUrl && this.adapterRegistry.has('rest')) {
          console.warn(
            chalk.yellow(
              `⚠ OpenAPI specification not found at "${config.source.path || './openapi.yaml'}". Automatically switching to REST adapter for ${config.source.baseUrl}.`
            )
          );
          sourceType = 'rest';
        }
      }
    }

    let adapter = this.adapterRegistry.get(sourceType);
    if (!adapter) {
      // Fallback to first available adapter
      const allAdapters = this.adapterRegistry.getAll();
      if (allAdapters.length > 0) {
        adapter = allAdapters[0];
      } else {
        throw new Error(`No compatible source adapters found for type "${sourceType}".`);
      }
    }

    const generatedRawTools = await adapter.generateTools({
      rootDir,
      config,
      sourcePath: config.source.path,
      sourceUrl: config.source.url
    });

    // Filter tools based on config
    const filteredTools = generatedRawTools.filter(tool => {
      // 1. Tag filters
      if (config.tools?.includeTags && config.tools.includeTags.length > 0) {
        const toolTags = tool.source.tags || [];
        const hasTag = config.tools.includeTags.some(t => toolTags.includes(t));
        if (!hasTag) return false;
      }

      if (config.tools?.excludeTags && config.tools.excludeTags.length > 0) {
        const toolTags = tool.source.tags || [];
        const hasExcluded = config.tools.excludeTags.some(t => toolTags.includes(t));
        if (hasExcluded) return false;
      }

      // 2. Allowlist / Denylist
      return isToolAllowed(tool.name, {
        allowlist: config.security?.allowlist,
        denylist: config.security?.denylist
      });
    });

    // Preserve previous approval statuses if available
    if (preserveStatuses && preserveStatuses.size > 0) {
      for (const tool of filteredTools) {
        if (preserveStatuses.has(tool.name)) {
          tool.status = preserveStatuses.get(tool.name)!;
        }
      }
    }

    return filteredTools;
  }
}

export const defaultToolGenerator = new ToolGenerator();
