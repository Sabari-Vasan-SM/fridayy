/**
 * Fridayy - CLI Banner & Styling Helpers
 */

import chalk from 'chalk';

export function getBanner(): string {
  const logo = `
  ${chalk.cyan.bold('███████╗██████╗ ██╗██████╗  █████╗ ██╗   ██╗██╗   ██╗')}
  ${chalk.cyan.bold('██╔════╝██╔══██╗██║██╔══██╗██╔══██╗╚██╗ ██╔╝╚██╗ ██╔╝')}
  ${chalk.cyan.bold('█████╗  ██████╔╝██║██║  ██║███████║ ╚████╔╝  ╚████╔╝ ')}
  ${chalk.cyan.bold('██╔══╝  ██╔══██╗██║██║  ██║██╔══██║  ╚██╔╝    ╚██╔╝  ')}
  ${chalk.cyan.bold('██║     ██║  ██║██║██████╔╝██║  ██║   ██║      ██║   ')}
  ${chalk.cyan.bold('╚═╝     ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝      ╚═╝   ')}
  `;

  const tagline = chalk.gray('  Universal Application-to-MCP Platform — Turn existing APIs into AI-ready tools\n');
  return logo + '\n' + tagline;
}

export function printBanner(): void {
  console.log(getBanner());
}
