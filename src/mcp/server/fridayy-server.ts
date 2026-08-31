/**
 * Fridayy - Official Model Context Protocol (MCP) Server
 * Implements standard MCP tools, resources, and prompts over Stdio and SSE transports.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { FridayyConfig, FridayyToolDefinition } from '../../core/schema/types.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { ToolHandler } from '../tools/tool-handler.js';
import { ResourceRegistry } from '../resources/resource-registry.js';
import { PromptRegistry } from '../prompts/prompt-registry.js';
import { AdapterRegistry, defaultAdapterRegistry } from '../../adapters/registry.js';

export interface FridayyServerOptions {
  config: FridayyConfig;
  tools: FridayyToolDefinition[];
  adapterRegistry?: AdapterRegistry;
}

export class FridayyMcpServer {
  private server: Server;
  private config: FridayyConfig;
  private toolRegistry: ToolRegistry;
  private toolHandler: ToolHandler;
  private resourceRegistry: ResourceRegistry;
  private promptRegistry: PromptRegistry;
  private sseTransports: Map<string, SSEServerTransport> = new Map();

  constructor(options: FridayyServerOptions) {
    this.config = options.config;
    const serverName = options.config.server?.name || options.config.name || 'fridayy-mcp-server';
    const serverVersion = options.config.server?.version || options.config.version || '1.0.0';

    this.server = new Server(
      {
        name: serverName,
        version: serverVersion
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    this.toolRegistry = new ToolRegistry(options.tools, options.config);
    this.toolHandler = new ToolHandler({
      config: options.config,
      adapterRegistry: options.adapterRegistry || defaultAdapterRegistry
    });
    this.resourceRegistry = new ResourceRegistry(this.toolRegistry, options.config);
    this.promptRegistry = new PromptRegistry();

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // 1. List Tools Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const exposedTools = this.toolRegistry.getExposedTools();
      return {
        tools: exposedTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    });

    // 2. Call Tool Handler
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      return await this.toolHandler.handleCall(name, args || {}, this.toolRegistry);
    });

    // 3. List Resources Handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: this.resourceRegistry.listResources()
      };
    });

    // 4. Read Resource Handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async request => {
      return this.resourceRegistry.readResource(request.params.uri);
    });

    // 5. List Prompts Handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: this.promptRegistry.listPrompts()
      };
    });

    // 6. Get Prompt Handler
    this.server.setRequestHandler(GetPromptRequestSchema, async request => {
      return this.promptRegistry.getPrompt(request.params.name, request.params.arguments);
    });
  }

  /**
   * Starts the server on Stdio transport (default for Claude Desktop, Cursor, local tools).
   */
  public async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Starts the server on HTTP / SSE transport (for remote or network clients).
   */
  public async startSse(port = 3000, host = 'localhost'): Promise<{ app: any; close: () => Promise<void> }> {
    const app = express();
    app.use(express.json());

    // SSE endpoint
    app.get('/sse', async (req, res) => {
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      this.sseTransports.set(sessionId, transport);

      req.on('close', () => {
        this.sseTransports.delete(sessionId);
      });

      await this.server.connect(transport);
    });

    // Message receiver endpoint
    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = this.sseTransports.get(sessionId);

      if (!transport) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      await transport.handlePostMessage(req, res);
    });

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: this.config.server?.name || this.config.name,
        exposedToolsCount: this.toolRegistry.getExposedTools().length
      });
    });

    return new Promise((resolve) => {
      const serverInstance = app.listen(port, host, () => {
        resolve({
          app,
          close: async () => {
            await new Promise<void>((r) => serverInstance.close(() => r()));
          }
        });
      });
    });
  }

  public getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  public getUnderlyingServer(): Server {
    return this.server;
  }
}
