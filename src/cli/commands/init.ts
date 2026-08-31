/**
 * Fridayy - Init Command
 * Initializes fridayy.config.json in the current project.
 */

import path from 'node:path';
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { defaultConfigManager } from '../../config/config-manager.js';
import { defaultProjectScanner } from '../../core/discovery/project-scanner.js';
import { DEFAULT_CONFIG } from '../../config/defaults.js';
import { FridayyConfig } from '../../core/schema/types.js';
import { logger } from '../ui/logger.js';
import { printBanner } from '../ui/banner.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Fridayy configuration in the current project')
    .option('-y, --yes', 'Skip prompts and accept recommended defaults')
    .option('-f, --force', 'Overwrite existing configuration file')
    .option('--name <name>', 'Project name')
    .option('--spec <path>', 'Path to OpenAPI specification file')
    .option('--url <url>', 'Target API base URL')
    .action(async (options) => {
      printBanner();
      const rootDir = process.cwd();

      if (defaultConfigManager.configExists(rootDir) && !options.force) {
        logger.warn('Configuration file fridayy.config.json already exists.');
        logger.info('Use --force to overwrite or run `fridayy scan` to analyze project.');
        return;
      }

      const spinner = ora('Analyzing project structure...').start();
      const scanResult = await defaultProjectScanner.scan(rootDir);
      spinner.succeed('Project analysis complete.');

      let config: FridayyConfig = {
        ...DEFAULT_CONFIG,
        ...(scanResult.recommendedConfig as FridayyConfig)
      };

      if (options.name) config.name = options.name;
      if (options.spec) {
        config.source = { type: 'openapi', path: options.spec };
      }
      if (options.url) {
        config.source.baseUrl = options.url;
      }

      const savedPath = defaultConfigManager.saveConfig(config, rootDir);
      logger.success(`Created configuration: ${chalk.bold(path.basename(savedPath))}`);
      console.log(`\nNext steps:`);
      console.log(`  1. Run ${chalk.cyan('fridayy scan')} to inspect discovered endpoints`);
      console.log(`  2. Run ${chalk.cyan('fridayy generate')} to build MCP tool definitions`);
      console.log(`  3. Run ${chalk.cyan('fridayy review')} to approve candidate tools`);
      console.log(`  4. Run ${chalk.cyan('fridayy start')} to launch your MCP server\n`);
    });
}
