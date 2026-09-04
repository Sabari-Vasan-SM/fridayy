/**
 * Fridayy - Start Command
 * Boots the MCP server with animated startup diagnostics.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { defaultConfigManager } from '../../config/config-manager.js';
import { FridayyMcpServer } from '../../mcp/server/fridayy-server.js';
import { defaultAdapterRegistry } from '../../adapters/registry.js';
import { printBanner } from '../ui/banner.js';
import { runStartupAnimation } from '../ui/startup-animation.js';

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the Fridayy MCP server with animated runtime diagnostics')
    .option('-t, --transport <type>', 'Transport mechanism: stdio or sse', 'stdio')
    .option('-p, --port <port>', 'Port number for SSE transport', '3000')
    .option('-h, --host <host>', 'Host address for SSE transport', 'localhost')
    .option('--no-animation', 'Skip startup animation')
    .option(
      '--allow-insecure',
      'Allow starting the SSE transport on a non-loopback host without an API key (not recommended)'
    )
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
      const transport = options.transport || config.server?.transport || 'stdio';

      if (transport === 'sse' || process.stdout.isTTY) {
        printBanner();
        if (options.animation !== false) {
          await runStartupAnimation();
        }
      }

      if (exposedTools.length === 0) {
        console.error(
          chalk.yellow('⚠ Warning: No tools are currently APPROVED. MCP clients will discover 0 tools.')
        );
        console.error(chalk.gray('  Run `fridayy review --approve-read` or `fridayy review --approve-all` to approve tools.'));
      }

      if (transport === 'sse') {
        const port = parseInt(options.port || String(config.server?.port || 3000), 10);
        const host = options.host || config.server?.host || 'localhost';
        const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(host);

        const apiKeyEnvVar = config.server?.apiKeyEnvVar || 'FRIDAYY_SERVER_API_KEY';
        const apiKey = process.env[apiKeyEnvVar];

        if (!isLoopback && !apiKey && !options.allowInsecure) {
          console.error(
            chalk.red(
              `✖ Refusing to start SSE transport on non-loopback host "${host}" without an API key.`
            )
          );
          console.error(
            chalk.yellow(
              `  Set the ${apiKeyEnvVar} environment variable (or config.server.apiKeyEnvVar) to require ` +
                `an API key for every request, or pass --allow-insecure to start anyway (not recommended).`
            )
          );
          process.exit(1);
        }

        if (!apiKey) {
          console.log(
            chalk.yellow(
              `⚠ No API key configured (${apiKeyEnvVar}). Anyone who can reach this host/port can invoke your approved tools.`
            )
          );
        }

        console.log(chalk.green(`✓ Fridayy MCP Server (SSE) running at http://${host}:${port}`));
        console.log(chalk.cyan(`  - SSE Endpoint:   http://${host}:${port}/sse`));
        console.log(chalk.cyan(`  - Messages Post:  http://${host}:${port}/messages`));
        console.log(chalk.cyan(`  - Health Check:   http://${host}:${port}/health`));
        console.log(`\nExposing ${chalk.bold.green(exposedTools.length)} approved tools to MCP clients.\n`);

        await server.startSse(port, host, apiKey);
      } else {
        // Stdio transport: Logs go to stderr to keep stdout pristine for JSON-RPC messages
        if (!process.stdout.isTTY) {
          console.error(
            chalk.cyan(`[fridayy] Stdio MCP Server active with ${exposedTools.length} approved tools.`)
          );
        }
        await server.startStdio();
      }
    });
}
