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

      const spinner = ora('Generating candidate MCP tools...').start();

      try {
        // Collect previous tool approval statuses unless --force is given
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
        logger.success(`Saved tools definition to ${chalk.bold(savedPath)}`);
        console.log(`\nNext step: Run ${chalk.cyan('fridayy review')} to approve/reject tools.\n`);
      } catch (err: any) {
        spinner.fail(`Generation failed: ${err.message}`);
      }
    });
}
