/**
 * Fridayy - Review Command
 * Interactive and automated developer review workflow to approve, reject, modify, or block MCP tools.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { defaultConfigManager } from '../../config/config-manager.js';
import { FridayyToolDefinition, ToolApprovalStatus } from '../../core/schema/types.js';
import { printBanner } from '../ui/banner.js';
import { logger } from '../ui/logger.js';
import { formatPermissionBadge, formatStatusBadge } from '../ui/tables.js';

export function registerReviewCommand(program: Command): void {
  program
    .command('review')
    .description('Review, approve, reject, or block candidate MCP tools')
    .option('--approve-all', 'Approve all tools (including write and destructive)')
    .option('--approve-read', 'Approve all safe READ tools')
    .option('--approve <name>', 'Approve a specific tool by name')
    .option('--reject <name>', 'Reject a specific tool by name')
    .option('--block <name>', 'Block a specific tool by name')
    .action(async (options) => {
      printBanner();
      const rootDir = process.cwd();

      if (!defaultConfigManager.configExists(rootDir)) {
        logger.error('No configuration found. Run `fridayy init` first.');
        return;
      }

      let tools = defaultConfigManager.loadTools(rootDir);
      if (tools.length === 0) {
        logger.warn('No tools found in fridayy.tools.json. Run `fridayy generate` first.');
        return;
      }

      // Flag-based handling
      if (options.approveAll) {
        const count = defaultConfigManager.bulkUpdateStatus(() => true, 'APPROVED', rootDir);
        logger.success(`Approved all ${chalk.bold(count)} tools.`);
        printToolsSummary(defaultConfigManager.loadTools(rootDir));
        return;
      }

      if (options.approveRead) {
        const count = defaultConfigManager.bulkUpdateStatus(
          t => t.permissions.type === 'READ',
          'APPROVED',
          rootDir
        );
        logger.success(`Approved all ${chalk.bold(count)} READ tools.`);
        printToolsSummary(defaultConfigManager.loadTools(rootDir));
        return;
      }

      if (options.approve) {
        const ok = defaultConfigManager.updateToolStatus(options.approve, 'APPROVED', rootDir);
        if (ok) {
          logger.success(`Approved tool "${chalk.bold(options.approve)}".`);
        } else {
          logger.error(`Tool "${options.approve}" not found.`);
        }
        return;
      }

      if (options.reject) {
        const ok = defaultConfigManager.updateToolStatus(options.reject, 'REJECTED', rootDir);
        if (ok) {
          logger.success(`Rejected tool "${chalk.bold(options.reject)}".`);
        } else {
          logger.error(`Tool "${options.reject}" not found.`);
        }
        return;
      }

      if (options.block) {
        const ok = defaultConfigManager.updateToolStatus(options.block, 'BLOCKED', rootDir);
        if (ok) {
          logger.success(`Blocked tool "${chalk.bold(options.block)}".`);
        } else {
          logger.error(`Tool "${options.block}" not found.`);
        }
        return;
      }

      // Display current tools
      printToolsSummary(tools);

      // Interactive Review Menu (if stdin is a TTY)
      if (process.stdin.isTTY) {
        await runInteractiveReview(tools, rootDir);
      } else {
        console.log(`\nUse review flags to modify tool statuses:`);
        console.log(`  ${chalk.cyan('fridayy review --approve-read')}  (Approve all read-only tools)`);
        console.log(`  ${chalk.cyan('fridayy review --approve-all')}   (Approve all tools)`);
        console.log(`  ${chalk.cyan('fridayy review --approve <name>')} (Approve specific tool)`);
        console.log(`  ${chalk.cyan('fridayy review --block <name>')}   (Block specific tool)\n`);
      }
    });
}

function printToolsSummary(tools: FridayyToolDefinition[]): void {
  console.log(chalk.bold('\nCurrent Tools Review Status:\n'));

  for (const tool of tools) {
    const sourceInfo = tool.source.method
      ? `${tool.source.method} ${tool.source.path || tool.source.url || '/'}`
      : tool.source.type;

    console.log(`${chalk.bold('Tool:')} ${chalk.cyan.bold(tool.name)}`);
    console.log(`  ${chalk.gray('Type:')}   ${formatPermissionBadge(tool.permissions.type)}`);
    console.log(`  ${chalk.gray('Source:')} ${chalk.white(sourceInfo)}`);
    console.log(`  ${chalk.gray('Status:')} ${formatStatusBadge(tool.status)}`);
    if (tool.description) {
      console.log(`  ${chalk.gray('Desc:')}   ${chalk.gray(tool.description)}`);
    }
    console.log('');
  }

  const approvedCount = tools.filter(t => t.status === 'APPROVED').length;
  const pendingCount = tools.filter(t => t.status === 'PENDING').length;
  const blockedCount = tools.filter(t => t.status === 'BLOCKED').length;

  console.log(
    `Summary: ${chalk.green(`${approvedCount} approved`)}, ${chalk.yellow(
      `${pendingCount} pending`
    )}, ${chalk.red(`${blockedCount} blocked`)} out of ${tools.length} total tools.\n`
  );
}

async function runInteractiveReview(tools: FridayyToolDefinition[], rootDir: string): Promise<void> {
  try {
    const action = await select({
      message: 'Choose a review action:',
      choices: [
        { name: '✓ Approve all safe READ tools', value: 'approve-read' },
        { name: '✓ Approve ALL candidate tools', value: 'approve-all' },
        { name: '🔍 Review tools individually', value: 'individual' },
        { name: '🚪 Done / Exit review', value: 'exit' }
      ]
    });

    if (action === 'approve-read') {
      const count = defaultConfigManager.bulkUpdateStatus(
        t => t.permissions.type === 'READ',
        'APPROVED',
        rootDir
      );
      logger.success(`Approved ${count} READ tools.`);
    } else if (action === 'approve-all') {
      const count = defaultConfigManager.bulkUpdateStatus(() => true, 'APPROVED', rootDir);
      logger.success(`Approved all ${count} tools.`);
    } else if (action === 'individual') {
      for (const tool of tools) {
        const choice = await select({
          message: `Tool "${tool.name}" [${tool.permissions.type}] (${tool.source.method || ''} ${tool.source.path || ''})`,
          choices: [
            { name: 'Approve', value: 'APPROVED' },
            { name: 'Reject', value: 'REJECTED' },
            { name: 'Block', value: 'BLOCKED' },
            { name: 'Keep current (' + tool.status + ')', value: 'KEEP' }
          ]
        });

        if (choice !== 'KEEP') {
          defaultConfigManager.updateToolStatus(tool.name, choice as ToolApprovalStatus, rootDir);
        }
      }
      logger.success('Individual review completed.');
    }
  } catch {
    // User cancelled interactive prompt
  }
}
