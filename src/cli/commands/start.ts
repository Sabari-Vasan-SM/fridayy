/**
 * Fridayy - Start Command
 * Boots the MCP server over Stdio or SSE transports.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { defaultConfigManager } from '../../config/config-manager.js';
import { FridayyMcpServer } from '../../mcp/server/fridayy-server.js';
import { defaultAdapterRegistry } from '../../adapters/registry.js';
import { getBanner } from '../ui/banner.js';

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the Fridayy MCP server')
    .option('-t, --transport <type>', 'Transport mechanism: stdio or sse', 'stdio')
    .option('-p, --port <port>', 'Port number for SSE transport', '3000')
    .option('-h, --host <host>', 'Host address for SSE transport', 'localhost')
    .action(async (options) => {
      const rootDir = process.cwd();

      if (!defaultConfigManager.configExists(rootDir)) {
        console.error(chalk.red('✖ Configuration not found. Run `fridayy init` first.'));
        process.exit(1);
      }

      const config = defaultConfigManager.loadConfig(rootDir);
      const tools = defaultConfigManager.loadTools(rootDir);

      const server = new FridayyMcpServer({
        config,
        tools,
        adapterRegistry: defaultAdapterRegistry
      });

      const exposedTools = server.getToolRegistry().getExposedTools();

      if (exposedTools.length === 0) {
        console.error(
          chalk.yellow('⚠ Warning: No tools are currently APPROVED. MCP clients will discover 0 tools.')
        );
        console.error(chalk.gray('  Run `fridayy review --approve-read` or `fridayy review --approve-all` to approve tools.'));
      }

      const transport = options.transport || config.server?.transport || 'stdio';

      if (transport === 'sse') {
        const port = parseInt(options.port || String(config.server?.port || 3000), 10);
        const host = options.host || config.server?.host || 'localhost';

        console.log(getBanner());
        console.log(chalk.green(`✓ Fridayy MCP Server (SSE) running at http://${host}:${port}`));
        console.log(chalk.cyan(`  - SSE Endpoint:   http://${host}:${port}/sse`));
        console.log(chalk.cyan(`  - Messages Post:  http://${host}:${port}/messages`));
        console.log(chalk.cyan(`  - Health Check:   http://${host}:${port}/health`));
        console.log(`\nExposing ${chalk.bold.green(exposedTools.length)} approved tools to MCP clients.`);

        await server.startSse(port, host);
      } else {
        // Stdio transport: Logs must go to stderr to preserve stdout for JSON-RPC
        console.error(
          chalk.cyan(`[fridayy] Stdio MCP Server started with ${exposedTools.length} approved tools.`)
        );
        await server.startStdio();
      }
    });
}
