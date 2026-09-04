/**
 * Fridayy - Secrets Command
 * Manages the global, per-device credentials store (see config/credentials-store.ts)
 * so an API key can be configured once on a machine and reused by every Fridayy
 * project there, instead of being duplicated in plaintext per-project config files.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { defaultCredentialsStore } from '../../config/credentials-store.js';
import { logger } from '../ui/logger.js';

export function registerSecretsCommand(program: Command): void {
  const secretsCmd = program
    .command('secrets')
    .description('Manage the global per-device credentials store');

  secretsCmd
    .command('set <name> <value>')
    .description('Store a secret (e.g. FRIDAYY_API_KEY) in the global credentials store for this device')
    .action((name: string, value: string) => {
      defaultCredentialsStore.set(name, value);
      logger.success(`Stored secret ${chalk.cyan(name)} in ${chalk.gray(defaultCredentialsStore.getPath())}`);
      console.log(
        chalk.gray(
          '  Any project on this device can now resolve this secret via envKey / auth scheme name, ' +
            'without storing it in fridayy.config.json.'
        )
      );
    });

  secretsCmd
    .command('list')
    .description('List the names of secrets stored in the global credentials store (values are not shown)')
    .action(() => {
      const names = defaultCredentialsStore.list();
      if (names.length === 0) {
        console.log(chalk.gray(`No secrets stored in ${defaultCredentialsStore.getPath()}`));
        return;
      }
      console.log(chalk.bold(`Secrets in ${defaultCredentialsStore.getPath()}:\n`));
      for (const name of names) {
        console.log(`  - ${name}`);
      }
    });

  secretsCmd
    .command('remove <name>')
    .description('Remove a secret from the global credentials store')
    .action((name: string) => {
      const removed = defaultCredentialsStore.remove(name);
      if (removed) {
        logger.success(`Removed secret ${chalk.cyan(name)}`);
      } else {
        logger.error(`No secret named "${name}" found.`);
      }
    });
}
