/**
 * Fridayy - CLI Logger and Pretty Printer
 */

import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.error(chalk.red('✖'), msg),
  title: (msg: string) => console.log('\n' + chalk.bold.underline(msg) + '\n'),
  step: (step: number, total: number, msg: string) =>
    console.log(chalk.cyan(`[${step}/${total}]`), chalk.bold(msg))
};
