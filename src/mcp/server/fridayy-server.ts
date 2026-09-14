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
import { buildToolAnnotations } from '../tools/tool-annotations.js';
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
  private serverName: string;
  private serverVersion: string;
  private toolRegistry: ToolRegistry;
  private toolHandler: ToolHandler;
  private resourceRegistry: ResourceRegistry;
  private promptRegistry: PromptRegistry;
  private sseTransports: Map<string, SSEServerTransport> = new Map();
  private sseServers: Map<string, Server> = new Map();

  constructor(options: FridayyServerOptions) {
    this.config = options.config;
    this.serverName = options.config.server?.name || options.config.name || 'fridayy-mcp-server';
    this.serverVersion = options.config.server?.version || options.config.version || '1.0.0';

    this.toolRegistry = new ToolRegistry(options.tools, options.config);
    this.toolHandler = new ToolHandler({
      config: options.config,
      adapterRegistry: options.adapterRegistry || defaultAdapterRegistry
    });
    this.resourceRegistry = new ResourceRegistry(this.toolRegistry, options.config);
    this.promptRegistry = new PromptRegistry();

    // A single default Server instance, used by startStdio() (exactly one
    // client ever connects over stdio) and returned by getUnderlyingServer()
    // for direct in-process connections (e.g. tests using InMemoryTransport).
    this.server = this.createMcpServer();
  }

  /**
   * Builds a fresh MCP `Server` instance with the standard tool/resource/
   * prompt handlers registered on it.
   *
   * The MCP SDK's `Server.connect()` only supports one connected transport
   * at a time — calling it a second time on the same instance throws
   * "Already connected to a transport." A single shared `Server` therefore
   * cannot serve more than one SSE client concurrently, so `startSse()`
   * calls this once per incoming `/sse` connection rather than reusing one
   * instance across sessions.
   */
  private createMcpServer(): Server {
    const server = new Server(
      {
        name: this.serverName,
        version: this.serverVersion
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    this.registerHandlers(server);
    return server;
  }

  private registerHandlers(server: Server): void {
    // 1. List Tools Handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const exposedTools = this.toolRegistry.getExposedTools();
      return {
        tools: exposedTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: buildToolAnnotations(tool)
        }))
      };
    });

    // 2. Call Tool Handler
    server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      return await this.toolHandler.handleCall(name, args || {}, this.toolRegistry);
    });

    // 3. List Resources Handler
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: this.resourceRegistry.listResources()
      };
    });

    // 4. Read Resource Handler
    server.setRequestHandler(ReadResourceRequestSchema, async request => {
      return this.resourceRegistry.readResource(request.params.uri);
    });

    // 5. List Prompts Handler
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: this.promptRegistry.listPrompts()
      };
    });

    // 6. Get Prompt Handler
    server.setRequestHandler(GetPromptRequestSchema, async request => {
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
   *
   * If `apiKey` is provided, every request except `/health` must present it via
   * an `Authorization: Bearer <key>` header, an `x-api-key` header, or (for the
   * EventSource-based `/sse` GET request, which cannot always set headers) an
   * `?apiKey=` query parameter. Without an apiKey, the transport has no
   * authentication at all — callers exposing this beyond localhost are
   * responsible for restricting network access themselves.
   */
  public async startSse(
    port = 3000,
    host = 'localhost',
    apiKey?: string
  ): Promise<{ app: any; close: () => Promise<void> }> {
    const app = express();
    app.use(express.json());

    if (apiKey) {
      app.use((req, res, next) => {
        if (req.path === '/health') {
          next();
          return;
        }

        const authHeader = req.headers['authorization'];
        const bearerToken =
          typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : undefined;
        const provided =
          bearerToken || req.headers['x-api-key'] || (req.query.apiKey as string | undefined);

        if (provided !== apiKey) {
          res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Missing or invalid API key. Provide it via Authorization: Bearer <key>, x-api-key header, or ?apiKey= query parameter.'
          });
          return;
        }

        next();
      });
    }

    // SSE endpoint. Each connection gets its own Server instance (see
    // createMcpServer()) so concurrent clients don't fight over one
    // single-transport-at-a-time Server.
    app.get('/sse', async (req, res) => {
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      const sessionServer = this.createMcpServer();

      this.sseTransports.set(sessionId, transport);
      this.sseServers.set(sessionId, sessionServer);

      req.on('close', () => {
        this.sseTransports.delete(sessionId);
        this.sseServers.delete(sessionId);
      });

      await sessionServer.connect(transport);
    });

    // Message receiver endpoint. express.json() above has already consumed
    // and parsed the request body, so the underlying stream is no longer
    // readable — the SDK's handlePostMessage() must be given that parsed
    // body directly (its optional third argument) rather than re-reading
    // req itself, or every POST here fails with "stream is not readable"
    // and the SSE handshake can never complete.
    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = this.sseTransports.get(sessionId);

      if (!transport) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      await transport.handlePostMessage(req, res, req.body);
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
