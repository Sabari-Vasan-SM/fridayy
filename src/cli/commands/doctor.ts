/**
 * Fridayy - Doctor Command
 * Diagnoses project configuration, environment variables, target API connectivity, and permissions.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { defaultConfigManager } from '../../config/config-manager.js';
import { defaultSecretResolver } from '../../core/authentication/secret-resolver.js';
import { printBanner } from '../ui/banner.js';
import { logger } from '../ui/logger.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check configuration, dependencies, secrets, and API connectivity')
    .action(async () => {
      printBanner();
      const rootDir = process.cwd();
      console.log(chalk.bold('Running Fridayy Health & Diagnostic Checks...\n'));

      let passedCount = 0;
      let warnCount = 0;
      let errorCount = 0;

      // 1. Check config file
      let config: any;
      if (defaultConfigManager.configExists(rootDir)) {
        try {
          config = defaultConfigManager.loadConfig(rootDir);
          console.log(chalk.green('✓') + ' Configuration: fridayy.config.json is valid');
          passedCount++;
        } catch (err: any) {
          console.log(chalk.red('✖') + ` Configuration error: ${err.message}`);
          errorCount++;
        }
      } else {
        console.log(chalk.red('✖') + ' Configuration: fridayy.config.json not found (run `fridayy init`)');
        errorCount++;
      }

      // 2. Check tools file
      const tools = defaultConfigManager.loadTools(rootDir);
      if (tools.length > 0) {
        console.log(chalk.green('✓') + ` Tools Definition: fridayy.tools.json found with ${tools.length} tools`);
        passedCount++;
      } else {
        console.log(chalk.yellow('⚠') + ' Tools Definition: fridayy.tools.json is empty or not generated (run `fridayy generate`)');
        warnCount++;
      }

      // 3. Check Approval Breakdown & Destructive Safety
      if (tools.length > 0) {
        const approved = tools.filter(t => t.status === 'APPROVED').length;
        const pending = tools.filter(t => t.status === 'PENDING').length;
        const blocked = tools.filter(t => t.status === 'BLOCKED').length;
        const destructive = tools.filter(t => t.permissions.type === 'DESTRUCTIVE');
        const approvedDestructive = destructive.filter(t => t.status === 'APPROVED');

        console.log(chalk.green('✓') + ` Tool Status Breakdown: ${approved} approved, ${pending} pending, ${blocked} blocked`);
        passedCount++;

        if (destructive.length > 0) {
          if (approvedDestructive.length > 0) {
            console.log(
              chalk.yellow('⚠') +
                ` Security: ${approvedDestructive.length} DESTRUCTIVE tool(s) explicitly APPROVED for LLM invocation: [${approvedDestructive.map(t => t.name).join(', ')}]`
            );
            warnCount++;
          } else {
            console.log(
              chalk.green('✓') +
                ` Security: All ${destructive.length} DESTRUCTIVE tool(s) are safely BLOCKED pending explicit review`
            );
            passedCount++;
          }
        }
      }

      // 4. Check Environment Variables & Secrets
      if (tools.length > 0) {
        const authSchemes = tools
          .filter(t => t.authentication?.required)
          .map(t => t.authentication!);

        const requiredEnvVars = defaultSecretResolver.getRequiredEnvVars(authSchemes);
        if (requiredEnvVars.length > 0) {
          const missingVars = requiredEnvVars.filter(v => !process.env[v]);
          if (missingVars.length === 0) {
            console.log(chalk.green('✓') + ` Environment Secrets: All required auth variables present [${requiredEnvVars.join(', ')}]`);
            passedCount++;
          } else {
            console.log(
              chalk.yellow('⚠') +
                ` Environment Secrets: Missing auth variable(s): [${chalk.bold(
                  missingVars.join(', ')
                )}]. Requests requiring authentication will fail until set.`
            );
            warnCount++;
          }
        } else {
          console.log(chalk.green('✓') + ' Environment Secrets: No mandatory secrets required for active tools');
          passedCount++;
        }
      }

      // 5. Target API Connectivity Check
      const baseUrl = defaultSecretResolver.resolveBaseUrl(config?.source?.baseUrl);
      if (baseUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(baseUrl, { method: 'HEAD', signal: controller.signal }).catch(() => null);
          clearTimeout(timeoutId);

          if (res) {
            console.log(chalk.green('✓') + ` Target API Connectivity: Successfully reached ${baseUrl} (HTTP ${res.status})`);
            passedCount++;
          } else {
            console.log(chalk.yellow('⚠') + ` Target API Connectivity: Could not reach ${baseUrl} (server may be offline or local dev server)`);
            warnCount++;
          }
        } catch {
          console.log(chalk.yellow('⚠') + ` Target API Connectivity: Connection to ${baseUrl} timed out`);
          warnCount++;
        }
      }

      console.log('\n' + chalk.bold('Doctor Summary:'));
      console.log(`  ${chalk.green(`✓ ${passedCount} passed`)}, ${chalk.yellow(`⚠ ${warnCount} warnings`)}, ${chalk.red(`✖ ${errorCount} errors`)}\n`);

      if (errorCount === 0) {
        logger.success('Fridayy environment is healthy and ready for MCP clients!');
      } else {
        logger.warn('Please address the error(s) above before starting the server.');
      }
      console.log('');
    });
}
