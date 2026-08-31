/**
 * Fridayy - Use Command (How-To Guide & Product Vision)
 * Explains the application motto, architecture, step-by-step usage, and AI client setups.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { printBanner } from '../ui/banner.js';

export function registerUseCommand(program: Command): void {
  program
    .command('use')
    .description('Display detailed how-to guide, product vision, architecture, and client setup instructions')
    .option('--json', 'Output guide in JSON format')
    .action((options) => {
      printBanner();

      if (options.json) {
        const guide = {
          name: 'fridayy',
          tagline: 'Universal Application-to-MCP Platform — Turn existing APIs into AI-ready tools',
          motto: 'Build once. Connect everywhere.',
          author: 'Sabarivasan',
          workflow: [
            { step: 1, command: 'fridayy init', description: 'Initialize Fridayy configuration' },
            { step: 2, command: 'fridayy scan', description: 'Detect APIs, routes, and auth schemes' },
            { step: 3, command: 'fridayy generate', description: 'Generate MCP candidate tools' },
            { step: 4, command: 'fridayy review', description: 'Approve or block candidate tools' },
            { step: 5, command: 'fridayy start', description: 'Start standards-compliant MCP server' }
          ]
        };
        console.log(JSON.stringify(guide, null, 2));
        return;
      }

      console.log(chalk.bold.hex('#00d2ff')('================================================================================'));
      console.log(chalk.bold.hex('#00d2ff')('  🎯 THE FRIDAYY MOTTO & PRODUCT VISION'));
      console.log(chalk.bold.hex('#00d2ff')('================================================================================\n'));

      console.log(`  ${chalk.bold.white('“Turn existing applications and APIs into AI-ready tools with zero code rewriting.”')}\n`);
      console.log(`  ${chalk.gray('Existing applications shouldn’t need a complete rewrite to be useful to AI models.')}`);
      console.log(`  ${chalk.gray('Fridayy creates a safe, reviewable bridge between your backend and modern AI agents.')}\n`);

      console.log(chalk.bold.hex('#00b4d8')('================================================================================'));
      console.log(chalk.bold.hex('#00b4d8')('  ⚙️ HOW IT WORKS UNDER THE HOOD'));
      console.log(chalk.bold.hex('#00b4d8')('================================================================================\n'));

      console.log(`  ${chalk.cyan('1. Capability Discovery:')}`);
      console.log(`     Scans OpenAPI specs (v3.0, v3.1, Swagger 2.0) or Node.js Express/Fastify routes.`);
      console.log(`  ${chalk.cyan('2. Schema Normalization:')}`);
      console.log(`     Merges URL path variables, query parameters, headers, and request bodies into`);
      console.log(`     a unified, typed JSON Schema for LLMs.`);
      console.log(`  ${chalk.cyan('3. Zero-Trust Security & Risk Engine:')}`);
      console.log(`     Classifies actions into ${chalk.green('READ')} (safe), ${chalk.yellow('WRITE')} (mutating), and ${chalk.red.bold('DESTRUCTIVE')} (delete/purge).`);
      console.log(`     Destructive tools default to ${chalk.red.bold('BLOCKED')} until you approve them.`);
      console.log(`  ${chalk.cyan('4. Zero-Leak Secret Isolation:')}`);
      console.log(`     API keys/tokens are loaded strictly from environment variables at execution time`);
      console.log(`     and never leaked in LLM prompts or tool schemas.`);
      console.log(`  ${chalk.cyan('5. Official MCP Server Transport:')}`);
      console.log(`     Exposes tools via standard Stdio & SSE protocols for Claude Desktop, Cursor, etc.\n`);

      console.log(chalk.bold.hex('#7209b7')('================================================================================'));
      console.log(chalk.bold.hex('#7209b7')('  🚀 STEP-BY-STEP WORKFLOW'));
      console.log(chalk.bold.hex('#7209b7')('================================================================================\n'));

      console.log(`  ${chalk.bold.white('Step 1:')} ${chalk.cyan.bold('fridayy init')}      ${chalk.gray('→ Creates fridayy.config.json')}`);
      console.log(`  ${chalk.bold.white('Step 2:')} ${chalk.cyan.bold('fridayy scan')}      ${chalk.gray('→ Inspects your endpoints and auth schemes')}`);
      console.log(`  ${chalk.bold.white('Step 3:')} ${chalk.cyan.bold('fridayy generate')}  ${chalk.gray('→ Builds candidate MCP tools into fridayy.tools.json')}`);
      console.log(`  ${chalk.bold.white('Step 4:')} ${chalk.cyan.bold('fridayy review')}    ${chalk.gray('→ Approve safe tools (e.g. fridayy review --approve-read)')}`);
      console.log(`  ${chalk.bold.white('Step 5:')} ${chalk.cyan.bold('fridayy start')}     ${chalk.gray('→ Launches the live Model Context Protocol server')}\n`);

      console.log(chalk.bold.hex('#b5179e')('================================================================================'));
      console.log(chalk.bold.hex('#b5179e')('  🤖 CONNECTING TO AI CLIENTS'));
      console.log(chalk.bold.hex('#b5179e')('================================================================================\n'));

      console.log(`  ${chalk.bold('1. Claude Desktop')} (add to claude_desktop_config.json):`);
      console.log(chalk.gray(`     {`));
      console.log(chalk.gray(`       "mcpServers": {`));
      console.log(chalk.gray(`         "my-api": {`));
      console.log(chalk.gray(`           "command": "npx",`));
      console.log(chalk.gray(`           "args": ["fridayy", "start"],`));
      console.log(chalk.gray(`           "env": { "FRIDAYY_API_KEY": "your-api-key" }`));
      console.log(chalk.gray(`         }`));
      console.log(chalk.gray(`       }`));
      console.log(chalk.gray(`     }\n`));

      console.log(`  ${chalk.bold('2. Cursor IDE')} (Settings → Features → MCP):`);
      console.log(chalk.gray(`     Type: command | Command: npx fridayy start\n`));

      console.log(`  ${chalk.bold('3. Pointing AI to this Project:')}`);
      console.log(`     Simply point your AI agent to ${chalk.cyan.bold('point/AI_INSTRUCTIONS.md')}`);
      console.log(`     The AI will automatically understand your architecture and run necessary setup.\n`);

      console.log(chalk.bold.hex('#00f5d4')('================================================================================'));
      console.log(chalk.bold.hex('#00f5d4')('  💡 PRO TIPS'));
      console.log(chalk.bold.hex('#00f5d4')('================================================================================\n'));

      console.log(`  • Run ${chalk.cyan.bold('fridayy doctor')} anytime to check secrets, endpoints, and health.`);
      console.log(`  • Use ${chalk.cyan.bold('fridayy tools --approved')} to see active tools exposed to AI.`);
      console.log(`  • Use ${chalk.cyan.bold('fridayy start --transport sse --port 3000')} for remote network clients.\n`);

      console.log(`  ${chalk.cyan.bold('friday')} - ${chalk.gray('build once. connect everywhere.')}`);
      console.log(`  ${chalk.gray('Developed by sabarivasan')}\n`);
    });
}
