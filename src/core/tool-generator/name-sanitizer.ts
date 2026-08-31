/**
 * Fridayy - Tool Name Sanitizer & Generator
 * Converts API operations, methods, and paths into clean snake_case MCP tool names.
 */

/**
 * Sanitizes an operation ID or string to a valid MCP tool name.
 */
export function sanitizeToolName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // camelCase to snake_case
    .replace(/[^a-zA-Z0-9_]/g, '_')         // replace non-alphanumeric with underscore
    .replace(/_+/g, '_')                    // collapse consecutive underscores
    .replace(/^_+|_+$/g, '')                // trim leading/trailing underscores
    .toLowerCase();
}

/**
 * Generates an intuitive tool name from HTTP method and path if operationId is missing.
 * E.g.:
 * - GET /users -> get_users
 * - GET /users/{id} -> get_user
 * - POST /orders -> create_order
 * - PUT /users/{id} -> update_user
 * - DELETE /users/{id} -> delete_user
 * - PUT /customers/{id}/profile -> update_customer_profile
 * - POST /auth/login -> login
 */
export function generateToolNameFromRoute(method: string, pathStr: string): string {
  const m = method.toLowerCase();

  // Strip leading and trailing slashes, remove /api/v1, /api prefixes
  let cleanedPath = pathStr
    .replace(/^\/?(api\/v\d+|api)\//i, '')
    .replace(/^\/|\/$/g, '');

  const rawSegments = cleanedPath.split('/').filter(Boolean);
  const resourceSegments: string[] = [];

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    if (seg.startsWith('{') || seg.startsWith(':')) {
      // If previous segment was plural, singularize it
      if (resourceSegments.length > 0) {
        const lastIdx = resourceSegments.length - 1;
        const prev = resourceSegments[lastIdx];
        if (prev.endsWith('s') && !prev.endsWith('ss') && !prev.endsWith('us')) {
          resourceSegments[lastIdx] = prev.slice(0, -1);
        }
      }
    } else {
      let cleanSeg = seg;
      // If trailing segment on POST/DELETE/PUT and plural, singularize
      if ((m === 'post' || m === 'delete' || m === 'put') && i === rawSegments.length - 1) {
        if (cleanSeg.endsWith('s') && !cleanSeg.endsWith('ss') && !cleanSeg.endsWith('us')) {
          cleanSeg = cleanSeg.slice(0, -1);
        }
      }
      resourceSegments.push(cleanSeg);
    }
  }

  let resource = resourceSegments.length > 0 ? resourceSegments.join('_') : 'resource';

  let prefix = m;
  if (m === 'get') {
    prefix = 'get';
  } else if (m === 'post') {
    prefix = 'create';
  } else if (m === 'put') {
    prefix = 'update';
  } else if (m === 'patch') {
    prefix = 'update';
  } else if (m === 'delete') {
    prefix = 'delete';
  }

  // Handle special cases like /login, /logout, /search, /checkout
  if (resourceSegments.length === 1) {
    const single = resourceSegments[0].toLowerCase();
    if (['login', 'logout', 'search', 'checkout', 'register', 'ping', 'health'].includes(single)) {
      return sanitizeToolName(single);
    }
  }

  return sanitizeToolName(`${prefix}_${resource}`);
}
