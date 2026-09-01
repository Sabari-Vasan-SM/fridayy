/**
 * Fridayy - Enhanced Node.js Route Scanner
 * Scans JavaScript and TypeScript files for Express, Fastify, Koa, NestJS, and Next.js route declarations.
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
}

// Matches: app.get('/path', ...), router.post('/path', ...), server.delete('/path', ...), etc.
const ROUTE_PATTERN = /(?:app|router|fastify|server|api|v1|route|r|expressRouter)\.(get|post|put|patch|delete|options|head)\s*\(\s*(['"`])([^'"`]+)\2/gi;

// Matches NestJS / TypeScript decorators: @Get('/path'), @Post('/path'), etc.
const DECORATOR_PATTERN = /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*(?:(['"`])([^'"`]*)\2)?\s*\)/gi;

// Matches chained routes: .route('/users').get(...).post(...)
const CHAINED_ROUTE_PATTERN = /\.route\s*\(\s*(['"`])([^'"`]+)\1\s*\)/gi;

export class NodeJsScanner {
  /**
   * Scans a directory recursively for Express/Fastify/Koa/NestJS/Next.js routes.
   */
  public async scanDirectory(rootDir: string, maxFiles = 500): Promise<DiscoveredRoute[]> {
    const discovered: DiscoveredRoute[] = [];
    const files = this.collectSourceFiles(rootDir, maxFiles);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const fileRoutes = this.scanFileContent(content, file);
        discovered.push(...fileRoutes);

        // Also check if this file is a Next.js App Router / Pages API route
        const nextJsRoutes = this.scanNextJsRouteFile(content, file, rootDir);
        discovered.push(...nextJsRoutes);
      } catch {
        // Skip unreadable files
      }
    }

    // Deduplicate routes by method + path
    const uniqueMap = new Map<string, DiscoveredRoute>();
    for (const r of discovered) {
      const key = `${r.method}:${r.path}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, r);
      }
    }

    return Array.from(uniqueMap.values());
  }

  public scanFileContent(content: string, filePath: string): DiscoveredRoute[] {
    const routes: DiscoveredRoute[] = [];
    const lines = content.split('\n');

    // 1. Standard Express / Fastify / Koa routes
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      ROUTE_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = ROUTE_PATTERN.exec(line)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[3];

        const comment = this.extractComment(lines, lineIndex);
        const pathParams = (routePath.match(/:[a-zA-Z0-9_]+/g) || []).map(p => p.slice(1));

        routes.push({
          method,
          path: routePath,
          file: filePath,
          line: lineIndex + 1,
          description: comment,
          pathParams
        });
      }

      // 2. NestJS Decorator style routes: @Get('/users')
      DECORATOR_PATTERN.lastIndex = 0;
      let decMatch: RegExpExecArray | null;
      while ((decMatch = DECORATOR_PATTERN.exec(line)) !== null) {
        const method = decMatch[1].toUpperCase();
        let subPath = decMatch[3] || '';
        if (subPath && !subPath.startsWith('/')) {
          subPath = `/${subPath}`;
        }
        const finalPath = subPath || '/';
        const comment = this.extractComment(lines, lineIndex);
        const pathParams = (finalPath.match(/:[a-zA-Z0-9_]+/g) || []).map(p => p.slice(1));

        routes.push({
          method,
          path: finalPath,
          file: filePath,
          line: lineIndex + 1,
          description: comment,
          pathParams
        });
      }
    }

    return routes;
  }

  private scanNextJsRouteFile(content: string, filePath: string, rootDir: string): DiscoveredRoute[] {
    const routes: DiscoveredRoute[] = [];
    const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');

    // Check Next.js App Router: app/api/.../route.ts
    const appRouterMatch = rel.match(/(?:src\/)?app\/(api\/.*?)\/route\.[jt]sx?$/i);
    if (appRouterMatch) {
      const apiPath = `/${appRouterMatch[1]}`;
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      for (const m of methods) {
        const regex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`, 'i');
        if (regex.test(content)) {
          routes.push({
            method: m,
            path: apiPath,
            file: filePath,
            line: 1,
            description: `Next.js App Router ${m} ${apiPath}`,
            pathParams: (apiPath.match(/\[([a-zA-Z0-9_]+)\]/g) || []).map(p => p.slice(1, -1))
          });
        }
      }
    }

    // Check Next.js Pages Router: pages/api/...
    const pagesRouterMatch = rel.match(/(?:src\/)?pages\/(api\/.*?)\.[jt]sx?$/i);
    if (pagesRouterMatch) {
      const apiPath = `/${pagesRouterMatch[1]}`.replace(/\/index$/, '');
      routes.push({
        method: 'POST', // Default handler
        path: apiPath,
        file: filePath,
        line: 1,
        description: `Next.js Pages API ${apiPath}`,
        pathParams: (apiPath.match(/\[([a-zA-Z0-9_]+)\]/g) || []).map(p => p.slice(1, -1))
      });
    }

    return routes;
  }

  private extractComment(lines: string[], lineIndex: number): string | undefined {
    if (lineIndex <= 0) return undefined;
    const prevLine = lines[lineIndex - 1].trim();

    if (prevLine.startsWith('//')) {
      return prevLine.replace(/^\/\/\s*/, '');
    } else if (prevLine.endsWith('*/')) {
      let jsDocStart = lineIndex - 1;
      while (jsDocStart > 0 && !lines[jsDocStart].includes('/**')) {
        jsDocStart--;
      }
      const block = lines.slice(jsDocStart, lineIndex).join('\n');
      const summaryMatch = block.match(/@summary\s+([^\n*]+)/i) || block.match(/\*\s*([^*@\n/]+)/);
      if (summaryMatch) {
        return summaryMatch[1].trim();
      }
    }
    return undefined;
  }

  private collectSourceFiles(dir: string, maxFiles: number, collected: string[] = []): string[] {
    if (!fs.existsSync(dir)) return collected;
    if (collected.length >= maxFiles) return collected;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (collected.length >= maxFiles) break;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Ignore heavy or irrelevant folders
          if (!['node_modules', 'dist', '.git', '.gemini', 'coverage', 'build', '.next', '.turbo', '.cache'].includes(entry.name)) {
            this.collectSourceFiles(fullPath, maxFiles, collected);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx'].includes(ext) && !entry.name.endsWith('.d.ts') && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
            collected.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }

    return collected;
  }
}
