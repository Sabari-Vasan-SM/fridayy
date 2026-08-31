/**
 * Fridayy - Allowlist & Denylist Filter
 * Filters candidate tools using exact names and wildcard patterns.
 */

export function matchesPattern(name: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === name) return true;

  // Simple wildcard match (e.g. "get_*", "*_user")
  const regexPattern = '^' + pattern.replace(/\*/g, '.*') + '$';
  return new RegExp(regexPattern).test(name);
}

export function isToolAllowed(
  toolName: string,
  options: { allowlist?: string[]; denylist?: string[] } = {}
): boolean {
  const { allowlist, denylist } = options;

  // Denylist has highest priority
  if (denylist && denylist.length > 0) {
    for (const pattern of denylist) {
      if (matchesPattern(toolName, pattern)) {
        return false;
      }
    }
  }

  // If allowlist is defined and non-empty, tool must match at least one pattern
  if (allowlist && allowlist.length > 0) {
    return allowlist.some(pattern => matchesPattern(toolName, pattern));
  }

  return true;
}
