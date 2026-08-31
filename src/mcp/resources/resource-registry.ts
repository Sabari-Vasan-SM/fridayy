/**
 * Fridayy - MCP Resource Registry
 * Exposes system resources, API documentation, and tools schema to MCP clients.
 */

import { FridayyConfig } from '../../core/schema/types.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { sanitizeData } from '../../security/sanitizer.js';

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export class ResourceRegistry {
  private config?: FridayyConfig;
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry, config?: FridayyConfig) {
    this.toolRegistry = toolRegistry;
    this.config = config;
  }

  public listResources(): McpResource[] {
    return [
      {
        uri: 'fridayy://config',
        name: 'Fridayy Server Configuration',
        description: 'Active server configuration and security settings',
        mimeType: 'application/json'
      },
      {
        uri: 'fridayy://tools',
        name: 'Fridayy Tool Catalog',
        description: 'Complete catalog of all approved and candidate MCP tools',
        mimeType: 'application/json'
      },
      {
        uri: 'fridayy://health',
        name: 'Fridayy Server Health',
        description: 'Server status, uptime, and active adapter metrics',
        mimeType: 'application/json'
      }
    ];
  }

  public readResource(uri: string): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
    if (uri === 'fridayy://config') {
      const sanitizedConfig = sanitizeData(this.config || {});
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(sanitizedConfig, null, 2)
          }
        ]
      };
    }

    if (uri === 'fridayy://tools') {
      const allTools = this.toolRegistry.getAll();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              allTools.map(t => ({
                name: t.name,
                description: t.description,
                status: t.status,
                risk: t.risk,
                permissions: t.permissions,
                source: t.source
              })),
              null,
              2
            )
          }
        ]
      };
    }

    if (uri === 'fridayy://health') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptimeSeconds: Math.floor(process.uptime()),
                totalTools: this.toolRegistry.size(),
                exposedTools: this.toolRegistry.getExposedTools().length
              },
              null,
              2
            )
          }
        ]
      };
    }

    throw new Error(`Resource not found: ${uri}`);
  }
}
