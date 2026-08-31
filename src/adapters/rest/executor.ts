/**
 * Fridayy - REST API Executor
 * Executes HTTP requests with timeout, error handling, and structured response parsing.
 */

import { ToolExecutionResult } from '../../core/schema/types.js';
import { PreparedHttpRequest } from '../openapi/request-builder.js';

export interface RestExecutorOptions {
  timeoutMs?: number;
}

export class RestExecutor {
  private defaultTimeoutMs: number;

  constructor(options: RestExecutorOptions = {}) {
    this.defaultTimeoutMs = options.timeoutMs || 30000;
  }

  /**
   * Executes a prepared HTTP request.
   */
  public async execute(
    request: PreparedHttpRequest,
    toolName: string,
    options: RestExecutorOptions = {}
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      const contentType = response.headers.get('content-type') || '';
      let responseData: any;

      if (contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch {
          responseData = await response.text();
        }
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: `API returned HTTP ${response.status} ${response.statusText}`,
            details: responseData
          },
          metadata: {
            statusCode: response.status,
            durationMs,
            timestamp: new Date().toISOString(),
            toolName
          }
        };
      }

      return {
        success: true,
        data: responseData,
        metadata: {
          statusCode: response.status,
          durationMs,
          timestamp: new Date().toISOString(),
          toolName
        }
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (err.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `Request timed out after ${timeoutMs}ms: ${request.method} ${request.url}`
          },
          metadata: {
            durationMs,
            timestamp: new Date().toISOString(),
            toolName
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: `Network error invoking ${request.method} ${request.url}: ${err.message}`,
          details: err.stack
        },
        metadata: {
          durationMs,
          timestamp: new Date().toISOString(),
          toolName
        }
      };
    }
  }
}

export const defaultRestExecutor = new RestExecutor();
