/**
 * Fridayy - Tool Generator Engine
 * Coordinates adapters to generate, filter, and normalize candidate MCP tools.
 */

import { FridayyToolDefinition, FridayyConfig } from '../schema/types.js';
import { AdapterRegistry, defaultAdapterRegistry } from '../../adapters/registry.js';
import { isToolAllowed } from '../../security/allowlist.js';

export interface GenerationOptions {
  rootDir?: string;
  config: FridayyConfig;
  preserveStatuses?: Map<string, 'APPROVED' | 'PENDING' | 'BLOCKED' | 'REJECTED'>;
}

export class ToolGenerator {
  private adapterRegistry: AdapterRegistry;

  constructor(adapterRegistry: AdapterRegistry = defaultAdapterRegistry) {
    this.adapterRegistry = adapterRegistry;
  }

  /**
   * Generates MCP tools from the configured source adapter.
   */
  public async generate(options: GenerationOptions): Promise<FridayyToolDefinition[]> {
    const { config, rootDir = process.cwd(), preserveStatuses } = options;
    const sourceType = config.source.type || 'openapi';

    const adapter = this.adapterRegistry.get(sourceType);
    if (!adapter) {
      throw new Error(`Unsupported source adapter: "${sourceType}". Registered adapters: [${this.adapterRegistry.getAll().map(a => a.name).join(', ')}]`);
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
