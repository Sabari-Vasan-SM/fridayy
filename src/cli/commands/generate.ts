/**
 * Fridayy - Generate Command
 * Generates candidate MCP tools and saves them to fridayy.tools.json.
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { defaultConfigManager } from '../../config/config-manager.js';
import { defaultToolGenerator } from '../../core/tool-generator/generator.js';
import { createToolsTable } from '../ui/tables.js';
import { printBanner } from '../ui/banner.js';
import { logger } from '../ui/logger.js';

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate candidate MCP tools from configured API sources')
    .option('--force', 'Regenerate all tools and reset approval statuses')
    .option('--spec <path>', 'Path to OpenAPI specification')
    .action(async (options) => {
      printBanner();
      const rootDir = process.cwd();

      if (!defaultConfigManager.configExists(rootDir)) {
        logger.error('No configuration found. Please run `fridayy init` first.');
        return;
      }

      const config = defaultConfigManager.loadConfig(rootDir);
      if (options.spec) {
        config.source.path = options.spec;
      }

      const spinner = ora({
        text: chalk.cyan('Generating standardized MCP tools and mapping schemas...'),
        spinner: 'dots12',
        color: 'cyan'
      }).start();

      try {
        await new Promise(r => setTimeout(r, 400));
        let preserveMap: Map<string, any> | undefined;
        if (!options.force) {
          const existingTools = defaultConfigManager.loadTools(rootDir);
          if (existingTools.length > 0) {
            preserveMap = new Map();
            for (const t of existingTools) {
              preserveMap.set(t.name, t.status);
            }
          }
        }

        const tools = await defaultToolGenerator.generate({
          config,
          rootDir,
          preserveStatuses: preserveMap
        });

        const savedPath = defaultConfigManager.saveTools(tools, config.source.type, rootDir);
        spinner.succeed(`Generated ${chalk.bold.green(tools.length)} MCP tools.`);

        console.log('\n' + createToolsTable(tools) + '\n');
        logger.success(`Saved tools definition to ${chalk.bold.cyan(savedPath)}`);
        console.log(`\nNext step: Run ${chalk.cyan.bold('fridayy review')} to approve/reject candidate tools.\n`);
      } catch (err: any) {
        spinner.fail(`Generation failed: ${err.message}`);
      }
    });
}
