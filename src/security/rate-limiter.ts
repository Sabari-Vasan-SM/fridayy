/**
 * Fridayy - Rate Limiting Engine
 * Protects backend services from runaway agent loops using a sliding window.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export class RateLimiter {
  private requestLog: Map<string, number[]> = new Map();
  private defaultConfig: RateLimitConfig;

  constructor(defaultConfig: RateLimitConfig = { maxRequests: 60, windowSeconds: 60 }) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Checks if a request is allowed under the rate limit.
   * Returns { allowed: true } or { allowed: false, retryAfterSeconds: number }.
   */
  public checkLimit(key: string, customLimit?: RateLimitConfig): { allowed: boolean; retryAfterSeconds?: number; currentCount: number } {
    const config = customLimit || this.defaultConfig;
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const cutoff = now - windowMs;

    const timestamps = this.requestLog.get(key) || [];
    const validTimestamps = timestamps.filter(t => t > cutoff);

    if (validTimestamps.length >= config.maxRequests) {
      const oldestValid = validTimestamps[0];
      const retryAfterMs = oldestValid + windowMs - now;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

      this.requestLog.set(key, validTimestamps);
      return {
        allowed: false,
        retryAfterSeconds,
        currentCount: validTimestamps.length
      };
    }

    validTimestamps.push(now);
    this.requestLog.set(key, validTimestamps);

    return {
      allowed: true,
      currentCount: validTimestamps.length
    };
  }

  /**
   * Cleans up expired entries periodically to prevent memory growth.
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.requestLog.entries()) {
      const valid = timestamps.filter(t => t > now - 3600000); // 1 hour max
      if (valid.length === 0) {
        this.requestLog.delete(key);
      } else {
        this.requestLog.set(key, valid);
      }
    }
  }

  public reset(key?: string): void {
    if (key) {
      this.requestLog.delete(key);
    } else {
      this.requestLog.clear();
    }
  }
}
