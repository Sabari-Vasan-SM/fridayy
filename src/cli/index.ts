#!/usr/bin/env node
/**
 * Fridayy - Universal Application-to-MCP Platform CLI
 */

import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
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
import { getPackageVersion } from '../config/package-info.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('fridayy')
    .description('Universal Application-to-MCP Platform — Turn existing APIs into AI-ready MCP tools')
    .version(getPackageVersion())
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

// If directly executed. Compares *resolved* (symlink-following) filesystem
// paths, via fs.realpathSync + fileURLToPath, rather than raw URL/argv
// strings or an `endsWith(...)` heuristic.
//
// Both matter: a plain path.resolve() comparison breaks on Windows, where
// import.meta.url and argv[1] differ in separator style and percent-encoding.
// And an `endsWith('fridayy')` fallback is actively dangerous — `npm install
// -g` creates the CLI's bin entry as a symlink literally named `fridayy` (no
// extension), so process.argv[1] for every real installed invocation matches
// that heuristic. That made this module think it was run directly and call
// run() during bin/fridayy.js's `import`, which then calls run() again itself
// — every command executed twice for every user who installed the package,
// while `node bin/fridayy.js` and `tsx src/cli/index.ts` in local dev never
// triggered it. realpath comparison has no such false positive: the installed
// symlink resolves to bin/fridayy.js, not to this file.
const isDirectlyExecuted = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(entry);
  } catch {
    return false;
  }
})();

if (isDirectlyExecuted) {
  run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
