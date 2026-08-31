#!/usr/bin/env node
/**
 * Fridayy - Universal Application-to-MCP Platform CLI
 */

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerScanCommand } from './commands/scan.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerReviewCommand } from './commands/review.js';
import { registerStartCommand } from './commands/start.js';
import { registerToolsCommand } from './commands/tools.js';
import { registerConfigCommand } from './commands/config.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerUseCommand } from './commands/use.js';
import { printBanner } from './ui/banner.js';
import { runStartupAnimation } from './ui/startup-animation.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('fridayy')
    .description('Universal Application-to-MCP Platform — Turn existing APIs into AI-ready MCP tools')
    .version('1.2.0')
    .action(async () => {
      printBanner();
      await runStartupAnimation();
      console.log('Available Commands:');
      console.log('  fridayy use       → Show guide, product vision & how it works');
      console.log('  fridayy init      → Initialize configuration');
      console.log('  fridayy scan      → Scan API endpoints and specs');
      console.log('  fridayy generate  → Generate candidate MCP tools');
      console.log('  fridayy review    → Review and approve tools');
      console.log('  fridayy start     → Start the MCP server');
      console.log('  fridayy tools     → List all tools and statuses');
      console.log('  fridayy doctor    → Run diagnostics and health check\n');
    });

  // Register subcommands
  registerUseCommand(program);
  registerInitCommand(program);
  registerScanCommand(program);
  registerGenerateCommand(program);
  registerReviewCommand(program);
  registerStartCommand(program);
  registerToolsCommand(program);
  registerConfigCommand(program);
  registerDoctorCommand(program);

  return program;
}

export async function run(): Promise<void> {
  const program = createCli();
  await program.parseAsync(process.argv);
}

// If directly executed
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fridayy') || process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
