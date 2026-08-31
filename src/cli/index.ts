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

export function createCli(): Command {
  const program = new Command();

  program
    .name('fridayy')
    .description('Universal Application-to-MCP Platform — Turn existing APIs into AI-ready MCP tools')
    .version('1.0.0');

  // Register commands
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
