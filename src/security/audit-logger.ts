/**
 * Fridayy - Structured Audit Logger
 * Records tool invocations, inputs, execution duration, and outcomes with secret masking.
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { sanitizeData } from './sanitizer.js';

export interface AuditLogEntry {
  timestamp: string;
  toolName: string;
  input: any;
  result?: {
    success: boolean;
    statusCode?: number;
    durationMs: number;
    error?: string;
  };
  client?: {
    id?: string;
    ip?: string;
    userAgent?: string;
  };
}

export class AuditLogger {
  private logFilePath?: string;
  private maskSecrets: boolean;
  private consoleLogging: boolean;

  constructor(options: { logFilePath?: string; maskSecrets?: boolean; consoleLogging?: boolean } = {}) {
    this.logFilePath = options.logFilePath;
    this.maskSecrets = options.maskSecrets ?? true;
    this.consoleLogging = options.consoleLogging ?? false;

    if (this.logFilePath) {
      const dir = path.dirname(path.resolve(this.logFilePath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Logs a tool invocation event.
   */
  public log(entry: AuditLogEntry): void {
    const sanitizedEntry: AuditLogEntry = {
      ...entry,
      input: this.maskSecrets ? sanitizeData(entry.input) : entry.input
    };

    const jsonString = JSON.stringify(sanitizedEntry);

    // File log
    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, jsonString + '\n', 'utf-8');
      } catch (err) {
        // Fail silently on logging error to avoid breaking server
      }
    }

    // Console log (if enabled or debug mode)
    if (this.consoleLogging) {
      const statusText = entry.result?.success
        ? chalk.green('SUCCESS')
        : chalk.red(`FAILED (${entry.result?.error || 'Unknown error'})`);
      const duration = entry.result?.durationMs ? chalk.gray(`${entry.result.durationMs}ms`) : '';

      console.error(
        `${chalk.gray(entry.timestamp)} ${chalk.cyan('[AUDIT]')} ${chalk.bold(entry.toolName)} → ${statusText} ${duration}`
      );
    }
  }
}
