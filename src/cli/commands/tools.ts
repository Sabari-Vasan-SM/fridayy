/**
 * Fridayy - Tools Command
 * Lists available MCP tools with formatting, filter options, and JSON export.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { defaultConfigManager } from '../../config/config-manager.js';
import { createToolsTable } from '../ui/tables.js';
import { printBanner } from '../ui/banner.js';
import { logger } from '../ui/logger.js';

export function registerToolsCommand(program: Command): void {
  program
    .command('tools')
    .description('List available MCP tools and their approval status')
    .option('--approved', 'Show only APPROVED tools')
    .option('--pending', 'Show only PENDING tools')
    .option('--blocked', 'Show only BLOCKED tools')
    .option('--json', 'Output tools as JSON')
    .action(async (options) => {
      const rootDir = process.cwd();

      if (!defaultConfigManager.configExists(rootDir)) {
        logger.error('No configuration found. Run `fridayy init` first.');
        return;
      }

      let tools = defaultConfigManager.loadTools(rootDir);

      if (options.approved) {
        tools = tools.filter(t => t.status === 'APPROVED');
      } else if (options.pending) {
        tools = tools.filter(t => t.status === 'PENDING');
      } else if (options.blocked) {
        tools = tools.filter(t => t.status === 'BLOCKED');
      }

      if (options.json) {
        console.log(JSON.stringify(tools, null, 2));
        return;
      }

      printBanner();
      if (tools.length === 0) {
        logger.warn('No tools matching filter criteria.');
        return;
      }

      console.log(createToolsTable(tools) + '\n');

      const approvedCount = tools.filter(t => t.status === 'APPROVED').length;
      console.log(
        `Total shown: ${tools.length} (${chalk.green(`${approvedCount} approved and ready for AI models`)})\n`
      );
    });
}
