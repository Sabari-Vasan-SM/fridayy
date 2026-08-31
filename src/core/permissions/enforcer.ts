/**
 * Fridayy - Permission & Security Enforcer
 * Enforces permission gates, status checks, and access rules for MCP tool invocation.
 */

import { FridayyToolDefinition, FridayyConfig } from '../schema/types.js';

export class PermissionDeniedError extends Error {
  public readonly code: string;
  public readonly toolName: string;
  public readonly details?: any;

  constructor(message: string, toolName: string, code = 'PERMISSION_DENIED', details?: any) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.code = code;
    this.toolName = toolName;
    this.details = details;
  }
}

export class PermissionEnforcer {
  private config?: FridayyConfig;

  constructor(config?: FridayyConfig) {
    this.config = config;
  }

  /**
   * Checks if a tool should be visible and exposable to MCP clients.
   */
  public isToolExposed(tool: FridayyToolDefinition): boolean {
    // 1. Must be APPROVED
    if (tool.status !== 'APPROVED') {
      return false;
    }

    // 2. Check allowlist / denylist from config
    const toolName = tool.name;
    const allowlist = this.config?.security?.allowlist;
    const denylist = this.config?.security?.denylist;

    if (denylist && denylist.includes(toolName)) {
      return false;
    }

    if (allowlist && allowlist.length > 0 && !allowlist.includes(toolName) && !allowlist.includes('*')) {
      return false;
    }

    return true;
  }

  /**
   * Enforces permissions before executing a tool. Throws PermissionDeniedError if execution is not allowed.
   */
  public validateExecution(tool: FridayyToolDefinition): void {
    // Check status
    if (tool.status === 'BLOCKED') {
      throw new PermissionDeniedError(
        `Tool "${tool.name}" is BLOCKED. Destructive operations require explicit developer approval via 'fridayy review'.`,
        tool.name,
        'TOOL_BLOCKED',
        { status: tool.status, permissions: tool.permissions }
      );
    }

    if (tool.status === 'REJECTED') {
      throw new PermissionDeniedError(
        `Tool "${tool.name}" is REJECTED and cannot be executed.`,
        tool.name,
        'TOOL_REJECTED',
        { status: tool.status }
      );
    }

    if (tool.status === 'PENDING') {
      throw new PermissionDeniedError(
        `Tool "${tool.name}" is PENDING developer review. Run 'fridayy review' to approve it before invoking.`,
        tool.name,
        'TOOL_PENDING_APPROVAL',
        { status: tool.status }
      );
    }

    if (tool.status !== 'APPROVED') {
      throw new PermissionDeniedError(
        `Tool "${tool.name}" has invalid status "${tool.status}" and cannot be executed.`,
        tool.name,
        'TOOL_NOT_APPROVED'
      );
    }

    // Denylist check
    const denylist = this.config?.security?.denylist;
    if (denylist && denylist.includes(tool.name)) {
      throw new PermissionDeniedError(
        `Tool "${tool.name}" is explicitly denylisted in fridayy configuration.`,
        tool.name,
        'TOOL_DENYLISTED'
      );
    }

    // Allowlist check
    const allowlist = this.config?.security?.allowlist;
    if (allowlist && allowlist.length > 0 && !allowlist.includes(tool.name) && !allowlist.includes('*')) {
      throw new PermissionDeniedError(
        `Tool "${tool.name}" is not included in the security allowlist.`,
        tool.name,
        'TOOL_NOT_ALLOWLISTED'
      );
    }
  }
}
