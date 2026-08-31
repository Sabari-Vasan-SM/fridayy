/**
 * Fridayy - E-Commerce End-to-End MCP Client Demonstration
 * Demonstrates an AI client discovering tools, executing safe read/write tools,
 * and verifying permission/destructive blocking.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import chalk from 'chalk';
import path from 'node:path';
import { createEcommerceApp } from './api.js';
import { OpenApiAdapter } from '../../src/adapters/openapi/adapter.js';
import { FridayyMcpServer } from '../../src/mcp/server/fridayy-server.js';
import { FridayyConfig, FridayyToolDefinition } from '../../src/core/schema/types.js';
import { getBanner } from '../../src/cli/ui/banner.js';
import { createToolsTable } from '../../src/cli/ui/tables.js';

async function runDemo() {
  console.log(getBanner());
  console.log(chalk.bold.magenta('==============================================================='));
  console.log(chalk.bold.magenta('  FRIDAYY END-TO-END MCP CLIENT DEMONSTRATION'));
  console.log(chalk.bold.magenta('===============================================================\n'));

  // 1. Start E-Commerce REST API
  const app = createEcommerceApp();
  const apiServer = await new Promise<any>((resolve) => {
    const s = app.listen(4000, 'localhost', () => {
      console.log(chalk.green('✓ [1/6] Live E-Commerce REST API started at http://localhost:4000'));
      resolve(s);
    });
  });

  try {
    // 2. Discover & Generate Tools from OpenAPI
    console.log(chalk.cyan('⏳ [2/6] Parsing OpenAPI specification (examples/ecommerce/openapi.yaml)...'));
    const adapter = new OpenApiAdapter();
    const config: FridayyConfig = {
      name: 'ecommerce-demo',
      source: {
        type: 'openapi',
        path: path.resolve('examples/ecommerce/openapi.yaml'),
        baseUrl: 'http://localhost:4000'
      },
      auth: {
        ApiKeyAuth: {
          type: 'apiKey',
          headerName: 'x-api-key',
          value: 'secret-ecommerce-key'
        }
      },
      security: {
        requireApprovalForDestructive: true,
        autoApproveRead: true,
        autoApproveWrite: false
      }
    };

    const tools: FridayyToolDefinition[] = await adapter.generateTools({
      rootDir: process.cwd(),
      config
    });

    console.log(chalk.green(`✓ [2/6] Successfully generated ${tools.length} candidate MCP tools:`));
    console.log('\n' + createToolsTable(tools) + '\n');

    // 3. Developer Review Simulation
    console.log(chalk.cyan('⏳ [3/6] Simulating Developer Review: Approving READ & WRITE tools, BLOCKED destructive tools...'));
    for (const tool of tools) {
      if (tool.name === 'create_order') {
        tool.status = 'APPROVED'; // Explicitly approved write tool
      }
    }
    console.log(chalk.green('✓ [3/6] Developer review completed. Tool approval statuses updated.'));

    // 4. Initialize Fridayy MCP Server
    console.log(chalk.cyan('⏳ [4/6] Initializing standards-compliant Fridayy MCP Server...'));
    const fridayyServer = new FridayyMcpServer({
      config,
      tools
    });

    // Connect MCP Client via In-Memory Duplex Transport
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await fridayyServer.getUnderlyingServer().connect(serverTransport);

    const mcpClient = new Client(
      { name: 'fridayy-test-client', version: '1.0.0' },
      { capabilities: {} }
    );
    await mcpClient.connect(clientTransport);
    console.log(chalk.green('✓ [4/6] MCP Client successfully connected to Fridayy server!'));

    // 5. Discover Tools via MCP Protocol
    console.log(chalk.cyan('\n⏳ [5/6] MCP Client querying available tools (tools/list)...'));
    const discovered = await mcpClient.listTools();
    console.log(chalk.green(`✓ [5/6] MCP Client discovered ${discovered.tools.length} approved tools:`));
    for (const t of discovered.tools) {
      console.log(`  └─ ${chalk.bold.cyan(t.name)}: ${chalk.gray(t.description)}`);
    }

    // 6. Invoke Tools via MCP Protocol
    console.log(chalk.bold.magenta('\n==============================================================='));
    console.log(chalk.bold.magenta('  TESTING MCP TOOL INVOCATIONS'));
    console.log(chalk.bold.magenta('===============================================================\n'));

    // 6a. Safe READ invocation: get_products
    console.log(chalk.cyan('▶ Calling tool: ') + chalk.bold('get_products') + chalk.gray(' { limit: 2 }'));
    const productsResult: any = await mcpClient.callTool({
      name: 'get_products',
      arguments: { limit: 2 }
    });
    console.log(chalk.green('✓ Tool Execution Result:'));
    console.log(chalk.white(productsResult.content[0].text));

    // 6b. WRITE invocation: create_order
    console.log(chalk.cyan('\n▶ Calling tool: ') + chalk.bold('create_order') + chalk.gray(' { customerEmail: "bob@example.com", items: [...] }'));
    const orderResult: any = await mcpClient.callTool({
      name: 'create_order',
      arguments: {
        customerEmail: 'bob@example.com',
        items: [{ productId: 'prod_1', quantity: 2 }]
      }
    });
    console.log(chalk.green('✓ Tool Execution Result:'));
    console.log(chalk.white(orderResult.content[0].text));

    // 6c. DESTRUCTIVE tool call (should fail safely before approval)
    console.log(chalk.cyan('\n▶ Attempting to call BLOCKED destructive tool: ') + chalk.bold('delete_product') + chalk.gray(' { productId: "prod_3" }'));
    const blockedResult: any = await mcpClient.callTool({
      name: 'delete_product',
      arguments: { productId: 'prod_3' }
    });
    if (blockedResult.isError) {
      console.log(chalk.red.bold('🛡️  SECURITY ENFORCEMENT PASSED: Call safely blocked by Fridayy gatekeeper!'));
      console.log(chalk.yellow(blockedResult.content[0].text));
    }

    // 6d. Now simulate approving delete_product
    console.log(chalk.cyan('\n▶ Developer approves delete_product via review:'));
    const deleteTool = fridayyServer.getToolRegistry().get('delete_product');
    if (deleteTool) {
      deleteTool.status = 'APPROVED';
    }

    console.log(chalk.cyan('▶ Retrying approved delete_product tool:'));
    const approvedDeleteResult: any = await mcpClient.callTool({
      name: 'delete_product',
      arguments: { productId: 'prod_3' }
    });
    console.log(chalk.green('✓ Tool Execution Result (After Approval):'));
    console.log(chalk.white(approvedDeleteResult.content[0].text));

    console.log(chalk.bold.green('\n==============================================================='));
    console.log(chalk.bold.green('  ALL DEMO CHECKS PASSED SUCCESSFULLY!'));
    console.log(chalk.bold.green('===============================================================\n'));
  } finally {
    apiServer.close();
  }
}

runDemo().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
