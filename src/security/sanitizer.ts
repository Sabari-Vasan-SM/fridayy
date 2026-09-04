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

// Matches JWTs (three dot-separated base64url segments) anywhere in a string.
const JWT_PATTERN = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

// Matches long hex-only tokens (session ids, hashes, many API secrets). Requiring
// pure hex (no separators, no other letters) keeps the false-positive rate on
// ordinary human-readable identifiers ("order-20250904-checkout") very low.
const HEX_TOKEN_PATTERN = /\b[0-9a-fA-F]{32,}\b/g;

// Common vendor API-key prefixes (Stripe, GitHub, Slack, Google, GitLab, npm,
// Shopify, AWS, ...). Deliberately prefix-anchored rather than a generic
// "long alphanumeric string" heuristic, which would also redact harmless
// identifiers, slugs, and order numbers that happen to be long.
const VENDOR_KEY_PATTERN =
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{12,}|ASIA[0-9A-Z]{12,}|AIza[0-9A-Za-z_-]{20,}|glpat-[A-Za-z0-9_-]{15,}|npm_[A-Za-z0-9]{20,}|shpat_[A-Za-z0-9]{20,}/g;

/**
 * Checks if a key name matches common sensitive parameter naming patterns.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Redacts secret-shaped substrings (JWTs, bearer tokens, long API-key-like
 * tokens) from a string, independent of the field name it came from.
 */
function redactSecretShapes(value: string): string {
  let result = value;
  if (/bearer\s+/i.test(result)) {
    result = result.replace(/bearer\s+\S+/gi, 'Bearer [REDACTED]');
  }
  result = result.replace(JWT_PATTERN, '[REDACTED]');
  result = result.replace(VENDOR_KEY_PATTERN, '[REDACTED]');
  result = result.replace(HEX_TOKEN_PATTERN, '[REDACTED]');
  return result;
}

/**
 * Deeply sanitizes an object, replacing sensitive values with '[REDACTED]'.
 */
export function sanitizeData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactSecretShapes(data);
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
