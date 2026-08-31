/**
 * Fridayy - Scan Command
 * Analyzes the project or API and identifies available capabilities.
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { defaultProjectScanner } from '../../core/discovery/project-scanner.js';
import { defaultToolGenerator } from '../../core/tool-generator/generator.js';
import { defaultConfigManager } from '../../config/config-manager.js';
import { DEFAULT_CONFIG } from '../../config/defaults.js';
import { FridayyConfig } from '../../core/schema/types.js';
import { printBanner } from '../ui/banner.js';
import { logger } from '../ui/logger.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan project or API to detect capabilities, endpoints, and candidate tools')
    .option('--spec <path>', 'Path to OpenAPI specification file')
    .action(async (options) => {
      printBanner();
      const rootDir = process.cwd();
      const spinner = ora('Scanning project...').start();

      try {
        const scanResult = await defaultProjectScanner.scan(rootDir);
        spinner.succeed('Scan completed.\n');

        if (scanResult.hasOpenApi) {
          logger.success('OpenAPI specification detected');
          for (const spec of scanResult.details.openApiSpecs || []) {
            console.log(`  └─ ${chalk.cyan(spec.path)} (${spec.title}, ${spec.endpointsCount} endpoints)`);
          }
        }

        if (scanResult.hasNodeJs) {
          logger.success(`Node.js application detected (${chalk.cyan(scanResult.nodeJsFramework || 'standard')})`);
        }

        logger.success(`${scanResult.discoveredEndpointsCount} endpoints discovered`);

        if (scanResult.authSchemesDetected.length > 0) {
          logger.success(`Authentication detected: [${scanResult.authSchemesDetected.join(', ')}]`);
        } else {
          logger.info('No explicit authentication schemes detected');
        }

        // Try generating candidate tools
        let config: FridayyConfig;
        if (defaultConfigManager.configExists(rootDir)) {
          config = defaultConfigManager.loadConfig(rootDir);
        } else {
          config = {
            ...DEFAULT_CONFIG,
            ...(scanResult.recommendedConfig as FridayyConfig)
          };
          if (options.spec) {
            config.source = { type: 'openapi', path: options.spec };
          }
        }

        const candidateTools = await defaultToolGenerator.generate({
          config,
          rootDir
        });

        console.log('\n' + chalk.bold('Candidate MCP tools:'));
        candidateTools.forEach((tool, index) => {
          const typeBadge =
            tool.permissions.type === 'READ'
              ? chalk.green('READ')
              : tool.permissions.type === 'WRITE'
              ? chalk.yellow('WRITE')
              : chalk.red.bold('DESTRUCTIVE');
          console.log(`  ${index + 1}. ${chalk.bold(tool.name)} [${typeBadge}] - ${tool.description}`);
        });

        console.log(`\n${chalk.bold.green(candidateTools.length)} tools generated.`);
        console.log(`\nRun ${chalk.cyan('fridayy review')} to review and approve generated tools.`);
        console.log(`Run ${chalk.cyan('fridayy start')} to launch the MCP server.\n`);
      } catch (err: any) {
        spinner.fail(`Scan failed: ${err.message}`);
      }
    });
}
