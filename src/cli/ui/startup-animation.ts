/**
 * Fridayy - Startup Animation & Visual Experience
 * Exact terminal animation sequence matching Fridayy brand design.
 */

import chalk from 'chalk';

export interface StartupAnimationOptions {
  interactive?: boolean;
  onComplete?: () => void;
}

const SPINNER_FRAMES = ['◐', '◓', '◑', '◒'];

export async function runStartupAnimation(options: StartupAnimationOptions = {}): Promise<void> {
  const isTTY = process.stdout.isTTY && !process.env.CI;

  const steps = [
    { text: 'Pulling project context...', color: '#00d2ff' },
    { text: 'Initialising MCP runtime...', color: '#0096c7' },
    { text: 'Turning existing APIs into tools...', color: '#7209b7' },
    { text: 'Orchestrating AI capabilities...', color: '#00f5d4' },
    { text: 'Connecting MCP interface...', color: '#52b788' }
  ];

  console.log(chalk.bold.white('> Starting Fridayy\n'));

  if (!isTTY) {
    // Fast path for non-TTY environments
    for (const step of steps) {
      console.log(`  ${chalk.green('✔')} ${step.text}`);
    }
  } else {
    // Animated sequence for interactive terminal
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const frameDelay = 45;
      const totalFrames = 8;

      for (let f = 0; f < totalFrames; f++) {
        const spinner = chalk.hex(step.color)(SPINNER_FRAMES[f % SPINNER_FRAMES.length]);
        process.stdout.write(`\r  ${spinner} ${step.text}`);
        await new Promise(r => setTimeout(r, frameDelay));
      }

      // Settle on completed checkmark
      process.stdout.write(`\r  ${chalk.green('✔')} ${step.text}\n`);
    }
  }

  console.log('\n' + chalk.bold.green('✔ DONE') + ' ' + chalk.bold.white('Fridayy is ready.\n'));

  // Status block
  console.log(`  ${chalk.white('MCP Server')}     ${chalk.green('●')} ${chalk.green('Ready')}`);
  console.log(`  ${chalk.white('AI Tools')}       ${chalk.green('●')} ${chalk.green('Connected')}`);
  console.log(`  ${chalk.white('Runtime')}        ${chalk.green('●')} ${chalk.green('Active')}\n`);

  // Signature footer
  console.log(`  ${chalk.cyan.bold('friday')} - ${chalk.gray('build once. connect everywhere.')}`);
  console.log(`  ${chalk.gray('Developed by sabarivasan')}\n`);
}
