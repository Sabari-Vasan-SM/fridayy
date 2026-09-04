/**
 * Fridayy - Config Command
 * Views, gets, sets, and validates Fridayy configuration.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { defaultConfigManager } from '../../config/config-manager.js';
import { printBanner } from '../ui/banner.js';
import { logger } from '../ui/logger.js';
import { sanitizeData } from '../../security/sanitizer.js';

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('View or modify Fridayy configuration')
    .action(async () => {
      printBanner();
      const rootDir = process.cwd();

      if (!defaultConfigManager.configExists(rootDir)) {
        logger.error('No configuration found. Run `fridayy init` first.');
        return;
      }

      const config = defaultConfigManager.loadConfig(rootDir);
      console.log(chalk.bold('Active Configuration (fridayy.config.json):\n'));
      console.log(JSON.stringify(maskConfigSecrets(config), null, 2) + '\n');
    });

  configCmd
    .command('get <key>')
    .description('Get a specific configuration property')
    .action((key: string) => {
      const rootDir = process.cwd();
      if (!defaultConfigManager.configExists(rootDir)) {
        logger.error('No configuration found.');
        return;
      }

      const config = defaultConfigManager.loadConfig(rootDir);
      const val = getNestedValue(maskConfigSecrets(config), key);
      if (val === undefined) {
        console.log(chalk.gray('undefined'));
      } else if (typeof val === 'object') {
        console.log(JSON.stringify(val, null, 2));
      } else {
        console.log(String(val));
      }
    });

  configCmd
    .command('set <key> <val>')
    .description('Set a specific configuration property')
    .action((key: string, val: string) => {
      const rootDir = process.cwd();
      if (!defaultConfigManager.configExists(rootDir)) {
        logger.error('No configuration found.');
        return;
      }

      const config = defaultConfigManager.loadConfig(rootDir);
      let parsedVal: any = val;
      if (val === 'true') parsedVal = true;
      else if (val === 'false') parsedVal = false;
      else if (!isNaN(Number(val))) parsedVal = Number(val);

      setNestedValue(config, key, parsedVal);
      defaultConfigManager.saveConfig(config, rootDir);

      if (/^auth\.[^.]+\.value$/.test(key)) {
        logger.success(`Updated ${chalk.cyan(key)} = [REDACTED]`);
        console.log(
          chalk.yellow(
            '⚠ Storing a secret directly in fridayy.config.json. Prefer setting an "envKey" and an ' +
              'environment variable instead — this file is easy to accidentally commit to source control.'
          )
        );
      } else {
        logger.success(`Updated ${chalk.cyan(key)} = ${chalk.bold(String(parsedVal))}`);
      }
    });
}

/**
 * Masks inline secret values (e.g. `auth.<scheme>.value`) before printing config
 * to the terminal — plaintext secrets should never be echoed to stdout/shell
 * history/CI logs, even though storing them there at all is discouraged.
 */
function maskConfigSecrets(config: any): any {
  const clone = JSON.parse(JSON.stringify(config));
  if (clone.auth && typeof clone.auth === 'object') {
    for (const scheme of Object.values(clone.auth) as any[]) {
      if (scheme && typeof scheme.value === 'string' && scheme.value.length > 0) {
        scheme.value = '[REDACTED]';
      }
    }
  }
  return sanitizeData(clone);
}

function getNestedValue(obj: any, pathStr: string): any {
  const parts = pathStr.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && p in curr) {
      curr = curr[p];
    } else {
      return undefined;
    }
  }
  return curr;
}

function setNestedValue(obj: any, pathStr: string, value: any): void {
  const parts = pathStr.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!curr[p] || typeof curr[p] !== 'object') {
      curr[p] = {};
    }
    curr = curr[p];
  }
  curr[parts[parts.length - 1]] = value;
}
