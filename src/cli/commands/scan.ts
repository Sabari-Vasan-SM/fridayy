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
      const spinner = ora({
        text: chalk.cyan('Deep scanning project for OpenAPI specs, routes & authentication...'),
        spinner: 'dots12',
        color: 'cyan'
      }).start();

      try {
        await new Promise(r => setTimeout(r, 400));
        const scanResult = await defaultProjectScanner.scan(rootDir);
        spinner.succeed(chalk.green('Deep scan completed.\n'));

        if (scanResult.hasOpenApi) {
          logger.success('OpenAPI specification detected');
          for (const spec of scanResult.details.openApiSpecs || []) {
            console.log(`  └─ ${chalk.cyan.bold(spec.path)} (${spec.title}, ${chalk.green(spec.endpointsCount)} endpoints)`);
          }
        }

        if (scanResult.hasNodeJs) {
          logger.success(`Node.js application detected (${chalk.cyan(scanResult.nodeJsFramework || 'standard')})`);
        }

        logger.success(`${chalk.bold.green(scanResult.discoveredEndpointsCount)} total endpoints discovered`);

        if (scanResult.authSchemesDetected.length > 0) {
          logger.success(`Authentication detected: [${chalk.yellow(scanResult.authSchemesDetected.join(', '))}]`);
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

        console.log('\n' + chalk.bold.underline('Candidate MCP tools:'));
        candidateTools.forEach((tool, index) => {
          const typeBadge =
            tool.permissions.type === 'READ'
              ? chalk.bgGreen.black(' READ ')
              : tool.permissions.type === 'WRITE'
              ? chalk.bgYellow.black(' WRITE ')
              : chalk.bgRed.white.bold(' DESTRUCTIVE ');
          console.log(`  ${chalk.gray(String(index + 1).padStart(2, '0') + '.')} ${chalk.bold(tool.name)} ${typeBadge} - ${chalk.gray(tool.description)}`);
        });

        console.log(`\n${chalk.bold.green(candidateTools.length)} candidate tools identified.`);
        console.log(`\nNext step: Run ${chalk.cyan.bold('fridayy review')} to review and approve generated tools.`);
        console.log(`           Run ${chalk.cyan.bold('fridayy start')}  to launch the MCP server.\n`);
      } catch (err: any) {
        spinner.fail(`Scan failed: ${err.message}`);
      }
    });
}
