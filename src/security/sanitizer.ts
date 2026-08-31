/**
 * Fridayy - Data & Secret Sanitizer
 * Redacts passwords, bearer tokens, and sensitive headers from logs, errors, and responses.
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
  /bearer/i,
  /cookie/i,
  /session/i
];

/**
 * Checks if a key name matches common sensitive parameter naming patterns.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Deeply sanitizes an object, replacing sensitive values with '[REDACTED]'.
 */
export function sanitizeData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Check if looks like a JWT or Bearer token
    if (data.startsWith('Bearer ') || data.startsWith('bearer ')) {
      return 'Bearer [REDACTED]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitizeData(value);
      }
    }
    return clean;
  }

  return data;
}

/**
 * Sanitizes HTTP headers.
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'authorization' || lower === 'x-api-key' || lower === 'cookie' || isSensitiveKey(key)) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = val;
    }
  }
  return clean;
}
