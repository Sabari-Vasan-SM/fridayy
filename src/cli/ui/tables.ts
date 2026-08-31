/**
 * Fridayy - Table Formatters & Visual Helpers
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import { FridayyToolDefinition, ToolPermissionType, ToolApprovalStatus, ToolRiskLevel } from '../../core/schema/types.js';

export function formatPermissionBadge(type: ToolPermissionType): string {
  switch (type) {
    case 'READ':
      return chalk.bgGreen.black(' READ ');
    case 'WRITE':
      return chalk.bgYellow.black(' WRITE ');
    case 'DESTRUCTIVE':
      return chalk.bgRed.white.bold(' DESTRUCTIVE ');
    default:
      return chalk.bgGray.white(` ${type} `);
  }
}

export function formatStatusBadge(status: ToolApprovalStatus): string {
  switch (status) {
    case 'APPROVED':
      return chalk.green.bold('✓ APPROVED');
    case 'PENDING':
      return chalk.yellow('⏳ PENDING');
    case 'BLOCKED':
      return chalk.red.bold('🚫 BLOCKED');
    case 'REJECTED':
      return chalk.gray('✗ REJECTED');
    default:
      return chalk.white(status);
  }
}

export function formatRiskBadge(risk: ToolRiskLevel): string {
  switch (risk) {
    case 'low':
      return chalk.green('low');
    case 'medium':
      return chalk.yellow('medium');
    case 'high':
      return chalk.red.bold('high');
    default:
      return risk;
  }
}

export function createToolsTable(tools: FridayyToolDefinition[], verbose = false): string {
  const table = new Table({
    head: [
      chalk.bold('Tool Name'),
      chalk.bold('Type'),
      chalk.bold('Risk'),
      chalk.bold('Source Endpoint'),
      chalk.bold('Status')
    ],
    style: {
      head: ['cyan'],
      border: ['gray']
    }
  });

  for (const tool of tools) {
    const sourceInfo = tool.source.method
      ? `${chalk.cyan(tool.source.method)} ${tool.source.path || tool.source.url || '/'}`
      : tool.source.type;

    table.push([
      chalk.bold(tool.name),
      formatPermissionBadge(tool.permissions.type),
      formatRiskBadge(tool.risk),
      sourceInfo,
      formatStatusBadge(tool.status)
    ]);
  }

  return table.toString();
}
