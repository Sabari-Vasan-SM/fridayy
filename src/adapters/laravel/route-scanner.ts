/**
 * Fridayy - Laravel Route Scanner
 * Scans a Laravel application's routes/*.php files for `Route::` declarations
 * (including prefix/middleware groups and resource/apiResource shorthand) and
 * turns them into the same DiscoveredRoute shape the Node.js scanner produces,
 * so both can feed the same tool-generation pipeline.
 *
 * This is a regex/line-based heuristic scanner, not a real PHP parser (Laravel
 * route files can contain arbitrarily complex PHP). It handles the common,
 * conventionally-formatted patterns Laravel's own documentation and starter
 * kits use: one route/group-opener per line, with the group's opening `{` on
 * the same line as `->group(`.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface DiscoveredRoute {
  method: string;
  path: string;
  file: string;
  line: number;
  description?: string;
  pathParams: string[];
  controller?: string;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options'] as const;

// Route::get('/users', ...), Route::post('/users', [UserController::class, 'store']), etc.
// `any`/`match` are intentionally excluded: their effective HTTP method(s) can't be
// determined from the call site alone.
const ROUTE_CALL_PATTERN = /Route::(get|post|put|patch|delete|options)\s*\(\s*(['"])((?:(?!\2).)*)\2/i;

// Route::apiResource('users', UserController::class) / Route::resource('users', UserController::class)
const RESOURCE_CALL_PATTERN =
  /Route::(apiResource|resource)\s*\(\s*(['"])((?:(?!\2).)*)\2\s*,\s*([A-Za-z0-9_\\]+)(?:::class)?\s*\)/i;

const ONLY_MODIFIER_PATTERN = /->only\(\s*\[([^\]]*)\]\s*\)/i;
const EXCEPT_MODIFIER_PATTERN = /->except\(\s*\[([^\]]*)\]\s*\)/i;

// Route::prefix('v1')->middleware('api')->group(function () {   <- opens a prefixed group
const PREFIX_GROUP_OPEN_PATTERN =
  /Route::prefix\s*\(\s*(['"])((?:(?!\1).)*)\1\s*\)(?:\s*->\s*[a-zA-Z]+\([^)]*\))*\s*->\s*group\s*\([^{]*\{/i;

// Route::middleware('api')->group(function () {   <- opens a group with no added path prefix
const PLAIN_GROUP_OPEN_PATTERN = /Route::(?:middleware|group)\s*\([^)]*\)\s*->\s*group\s*\([^{]*\{/i;

interface GroupFrame {
  prefix: string;
  depthAfterOpen: number;
}

const RESOURCE_ACTIONS: Record<string, { method: string; suffix: string }[]> = {
  apiResource: [
    { method: 'GET', suffix: '' },
    { method: 'POST', suffix: '' },
    { method: 'GET', suffix: '/{id}' },
    { method: 'PUT', suffix: '/{id}' },
    { method: 'PATCH', suffix: '/{id}' },
    { method: 'DELETE', suffix: '/{id}' }
  ],
  resource: [
    { method: 'GET', suffix: '' },
    { method: 'GET', suffix: '/create' },
    { method: 'POST', suffix: '' },
    { method: 'GET', suffix: '/{id}' },
    { method: 'GET', suffix: '/{id}/edit' },
    { method: 'PUT', suffix: '/{id}' },
    { method: 'PATCH', suffix: '/{id}' },
    { method: 'DELETE', suffix: '/{id}' }
  ]
};

// Maps each synthesized action to the Laravel resource-controller method name,
// used to honor ->only([...]) / ->except([...]) filters.
const RESOURCE_ACTION_NAMES: Record<string, string> = {
  'GET:': 'index',
  'POST:': 'store',
  'GET:/create': 'create',
  'GET:/{id}': 'show',
  'GET:/{id}/edit': 'edit',
  'PUT:/{id}': 'update',
  'PATCH:/{id}': 'update',
  'DELETE:/{id}': 'destroy'
};

function joinPaths(...segments: string[]): string {
  const cleaned = segments
    .map(s => s.trim().replace(/^\/+|\/+$/g, ''))
    .filter(s => s.length > 0);
  return `/${cleaned.join('/')}`;
}

function extractPathParams(routePath: string): string[] {
  return (routePath.match(/\{([a-zA-Z0-9_]+)\??\}/g) || []).map(p => p.replace(/[{}?]/g, ''));
}

export class LaravelRouteScanner {
  /**
   * Scans a Laravel project's routes/ directory (routes/web.php, routes/api.php,
   * and any other *.php files under routes/) for route declarations.
   */
  public async scanDirectory(rootDir: string, maxFiles = 200): Promise<DiscoveredRoute[]> {
    const routesDir = path.join(rootDir, 'routes');
    const discovered: DiscoveredRoute[] = [];
    const files = this.collectRouteFiles(routesDir, maxFiles);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        discovered.push(...this.scanFileContent(content, file));
      } catch {
        // Skip unreadable files
      }
    }

    // Deduplicate by method + path (a route registered in multiple files/groups
    // should only produce one tool).
    const uniqueMap = new Map<string, DiscoveredRoute>();
    for (const r of discovered) {
      const key = `${r.method}:${r.path}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, r);
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Scans a single route file's content. `filePath`'s basename drives Laravel's
   * conventional default prefix: routes registered in a file named `api.php`
   * are served under `/api` unless the path is already prefixed with it.
   */
  public scanFileContent(content: string, filePath: string): DiscoveredRoute[] {
    const routes: DiscoveredRoute[] = [];
    const lines = content.split('\n');
    const basename = path.basename(filePath).toLowerCase();
    const isApiFile = basename === 'api.php';

    const groupStack: GroupFrame[] = [];
    let depth = 0;

    const currentPrefix = () => groupStack.map(g => g.prefix).filter(Boolean);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // 1. Group openers (checked before applying this line's brace delta, since
      // the opening brace they introduce belongs to the *new* nested depth).
      const prefixGroupMatch = line.match(PREFIX_GROUP_OPEN_PATTERN);
      const plainGroupMatch = !prefixGroupMatch && line.match(PLAIN_GROUP_OPEN_PATTERN);

      const braceDelta = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      const newDepth = depth + braceDelta;

      if (prefixGroupMatch) {
        groupStack.push({ prefix: prefixGroupMatch[2], depthAfterOpen: newDepth });
      } else if (plainGroupMatch) {
        groupStack.push({ prefix: '', depthAfterOpen: newDepth });
      }

      depth = newDepth;

      // Pop any group frames we've closed out of.
      while (groupStack.length > 0 && groupStack[groupStack.length - 1].depthAfterOpen > depth) {
        groupStack.pop();
      }

      // 2. Resource / apiResource shorthand.
      const resourceMatch = line.match(RESOURCE_CALL_PATTERN);
      if (resourceMatch) {
        const kind: 'apiResource' | 'resource' = resourceMatch[1].toLowerCase() === 'apiresource' ? 'apiResource' : 'resource';
        const resourceName = resourceMatch[3];
        const controller = resourceMatch[4];

        const onlyMatch = line.match(ONLY_MODIFIER_PATTERN);
        const exceptMatch = line.match(EXCEPT_MODIFIER_PATTERN);
        const onlyActions = onlyMatch
          ? onlyMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          : undefined;
        const exceptActions = exceptMatch
          ? exceptMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          : undefined;

        for (const action of RESOURCE_ACTIONS[kind]) {
          const actionName = RESOURCE_ACTION_NAMES[`${action.method}:${action.suffix}`];
          if (onlyActions && !onlyActions.includes(actionName)) continue;
          if (exceptActions && exceptActions.includes(actionName)) continue;

          const rawPath = joinPaths(...currentPrefix(), resourceName) + action.suffix;
          const finalPath = isApiFile && !rawPath.startsWith('/api/') && rawPath !== '/api' ? `/api${rawPath}` : rawPath;

          routes.push({
            method: action.method,
            path: finalPath,
            file: filePath,
            line: lineIndex + 1,
            description: `Laravel ${kind} route (${resourceName}.${actionName})`,
            pathParams: extractPathParams(finalPath),
            controller
          });
        }
        continue;
      }

      // 3. Plain Route::{method}(...) calls.
      const routeMatch = line.match(ROUTE_CALL_PATTERN);
      if (routeMatch) {
        const method = routeMatch[1].toUpperCase();
        const rawPath = joinPaths(...currentPrefix(), routeMatch[3]);
        const finalPath = isApiFile && !rawPath.startsWith('/api/') && rawPath !== '/api' ? `/api${rawPath}` : rawPath;
        const comment = this.extractComment(lines, lineIndex);

        routes.push({
          method,
          path: finalPath,
          file: filePath,
          line: lineIndex + 1,
          description: comment,
          pathParams: extractPathParams(finalPath)
        });
      }
    }

    return routes;
  }

  private extractComment(lines: string[], lineIndex: number): string | undefined {
    if (lineIndex <= 0) return undefined;
    const prevLine = lines[lineIndex - 1].trim();

    if (prevLine.startsWith('//') || prevLine.startsWith('#')) {
      return prevLine.replace(/^(\/\/|#)\s*/, '');
    }

    // PHP doc block: /** ... */ possibly spanning several lines, with the
    // route directly following the closing `*/`. Walk back to find the last
    // non-empty content line inside the block.
    if (prevLine === '*/' || prevLine.endsWith('*/')) {
      for (let i = lineIndex - 2; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('/**') || line.startsWith('/*')) break;
        const cleaned = line.replace(/^\*\s?/, '').trim();
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
      return undefined;
    }

    if (prevLine.startsWith('*')) {
      const cleaned = prevLine.replace(/^\*\s*/, '').trim();
      return cleaned.length > 0 ? cleaned : undefined;
    }

    return undefined;
  }

  private collectRouteFiles(routesDir: string, maxFiles: number, collected: string[] = []): string[] {
    if (!fs.existsSync(routesDir)) return collected;
    if (collected.length >= maxFiles) return collected;

    try {
      const entries = fs.readdirSync(routesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (collected.length >= maxFiles) break;
        const fullPath = path.join(routesDir, entry.name);

        if (entry.isDirectory()) {
          this.collectRouteFiles(fullPath, maxFiles, collected);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.php')) {
          collected.push(fullPath);
        }
      }
    } catch {
      // ignore permission errors
    }

    return collected;
  }
}

export const HTTP_METHOD_LIST = HTTP_METHODS;
