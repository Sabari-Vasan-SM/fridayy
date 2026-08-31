/**
 * Fridayy - CLI Banner & Styling Helpers
 * Exact layout and styling matching Fridayy design specifications.
 */

import chalk from 'chalk';

export function getBanner(): string {
  const line1 = chalk.bold.white('  ███████╗██████╗ ██╗██████╗  █████╗ ██╗   ██╗██╗   ██╗');
  const line2 = chalk.bold.white('  ██╔════╝██╔══██╗██║██╔══██╗██╔══██╗╚██╗ ██╔╝╚██╗ ██╔╝');
  const line3 = chalk.bold.white('  █████╗  ██████╔╝██║██║  ██║███████║ ╚████╔╝  ╚████╔╝ ');
  const line4 = chalk.bold.white('  ██╔══╝  ██╔══██╗██║██║  ██║██╔══██║  ╚██╔╝    ╚██╔╝  ');
  const line5 = chalk.bold.white('  ██║     ██║  ██║██║██████╔╝██║  ██║   ██║      ██║   ');
  const line6 = chalk.bold.white('  ╚═╝     ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝      ╚═╝   ');

  const logo = `\n${line1}\n${line2}\n${line3}\n${line4}\n${line5}\n${line6}\n`;

  const authorSub = chalk.gray('                             sabarivasan\n');
  const tagline = chalk.bold.white('   Universal Application-to-MCP Platform – Turn existing APIs into AI tools\n');
  const badges = `          ${chalk.cyan.bold('v1.0.2')}   ${chalk.bgHex('#5e17eb').white.bold(' MCP Standard ')}  ${chalk.gray('•')}  ${chalk.yellow('⚡')} Developed with ${chalk.red('❤️')} by ${chalk.hex('#00f5d4').bold('Sabarivasan')}\n`;
  const repo = `                 ${chalk.gray('Repository:')} ${chalk.underline.hex('#00d2ff')('https://github.com/Sabari-Vasan-SM/fridayy')}\n`;

  return `${logo}${authorSub}${tagline}${badges}${repo}`;
}

let bannerPrinted = false;

export function printBanner(force = false): void {
  if (!bannerPrinted || force) {
    console.log(getBanner());
    bannerPrinted = true;
  }
}

export function resetBannerFlag(): void {
  bannerPrinted = false;
}
