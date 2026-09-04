#!/usr/bin/env node
/**
 * Fridayy - Universal Application-to-MCP Platform CLI
 */

import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { registerInitCommand } from './commands/init.js';
import { registerScanCommand } from './commands/scan.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerReviewCommand } from './commands/review.js';
import { registerStartCommand } from './commands/start.js';
import { registerToolsCommand } from './commands/tools.js';
import { registerConfigCommand } from './commands/config.js';
import { registerSecretsCommand } from './commands/secrets.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerUseCommand } from './commands/use.js';
import { printBanner } from './ui/banner.js';
import { runStartupAnimation } from './ui/startup-animation.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('fridayy')
    .description('Universal Application-to-MCP Platform — Turn existing APIs into AI-ready MCP tools')
    .version('1.2.1')
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
      console.log('  fridayy secrets   → Manage the global per-device credentials store');
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
  registerSecretsCommand(program);
  registerDoctorCommand(program);

  return program;
}

export async function run(): Promise<void> {
  const program = createCli();
  await program.parseAsync(process.argv);
}

// If directly executed. Compares resolved filesystem paths (via fileURLToPath)
// rather than raw URL/argv strings, since those differ in separator style and
// percent-encoding between POSIX and Windows and would otherwise never match
// on Windows, silently falling through to the `endsWith` heuristics below.
const isDirectlyExecuted = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entry)) {
      return true;
    }
  } catch {
    // import.meta.url wasn't a file:// URL; fall through to heuristics below
  }
  return entry.endsWith('fridayy') || entry.endsWith('index.ts') || entry.endsWith('index.js');
})();

if (isDirectlyExecuted) {
  run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
