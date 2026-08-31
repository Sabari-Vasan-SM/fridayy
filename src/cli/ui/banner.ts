/**
 * Fridayy - CLI Banner & Styling Helpers
 * Rich ASCII branding, animated effects, and author credits.
 */

import chalk from 'chalk';

export function getBanner(): string {
  const line1 = chalk.hex('#00d2ff').bold('  ███████╗██████╗ ██╗██████╗  █████╗ ██╗   ██╗██╗   ██╗');
  const line2 = chalk.hex('#00b4d8').bold('  ██╔════╝██╔══██╗██║██╔══██╗██╔══██╗╚██╗ ██╔╝╚██╗ ██╔╝');
  const line3 = chalk.hex('#0096c7').bold('  █████╗  ██████╔╝██║██║  ██║███████║ ╚████╔╝  ╚████╔╝ ');
  const line4 = chalk.hex('#0077b6').bold('  ██╔══╝  ██╔══██╗██║██║  ██║██╔══██║  ╚██╔╝    ╚██╔╝  ');
  const line5 = chalk.hex('#7209b7').bold('  ██║     ██║  ██║██║██████╔╝██║  ██║   ██║      ██║   ');
  const line6 = chalk.hex('#b5179e').bold('  ╚═╝     ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝      ╚═╝   ');

  const logo = `\n${line1}\n${line2}\n${line3}\n${line4}\n${line5}\n${line6}\n`;

  const tagline = `  ${chalk.bold.white('Universal Application-to-MCP Platform')} ${chalk.gray('— Turn existing APIs into AI tools')}`;
  const badges = `  ${chalk.bgCyan.black.bold(' v1.0.1 ')} ${chalk.bgHex('#7209b7').white.bold(' MCP Standard ')} ${chalk.gray('•')} ${chalk.hex('#00f5d4').bold('⚡ Developed with ❤️ by Sabarivasan')}`;
  const link = `  ${chalk.gray('Repository:')} ${chalk.underline.cyan('https://github.com/Sabari-Vasan-SM/fridayy')}\n`;

  return `${logo}\n${tagline}\n${badges}\n${link}`;
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
