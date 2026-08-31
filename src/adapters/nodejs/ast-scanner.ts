/**
 * Fridayy - Node.js Route Scanner
 * Scans JavaScript and TypeScript files for Express/Fastify/Koa route declarations.
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

const ROUTE_PATTERN = /(?:app|router|fastify|server)\.(get|post|put|patch|delete|options|head)\s*\(\s*(['"`])([^'"`]+)\2/g;

export class NodeJsScanner {
  /**
   * Scans a directory recursively for Express/Fastify routes.
   */
  public async scanDirectory(rootDir: string, maxFiles = 200): Promise<DiscoveredRoute[]> {
    const discovered: DiscoveredRoute[] = [];
    const files = this.collectSourceFiles(rootDir, maxFiles);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const fileRoutes = this.scanFileContent(content, file);
        discovered.push(...fileRoutes);
      } catch {
        // Skip unreadable files
      }
    }

    return discovered;
  }

  public scanFileContent(content: string, filePath: string): DiscoveredRoute[] {
    const routes: DiscoveredRoute[] = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      ROUTE_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = ROUTE_PATTERN.exec(line)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[3];

        // Extract comment from previous lines
        let comment: string | undefined;
        if (lineIndex > 0) {
          const prevLine = lines[lineIndex - 1].trim();
          if (prevLine.startsWith('//')) {
            comment = prevLine.replace(/^\/\/\s*/, '');
          } else if (prevLine.endsWith('*/')) {
            // Find start of JSDoc block
            let jsDocStart = lineIndex - 1;
            while (jsDocStart > 0 && !lines[jsDocStart].includes('/**')) {
              jsDocStart--;
            }
            const block = lines.slice(jsDocStart, lineIndex).join('\n');
            const summaryMatch = block.match(/@summary\s+([^\n*]+)/i) || block.match(/\*\s*([^*@\n/]+)/);
            if (summaryMatch) {
              comment = summaryMatch[1].trim();
            }
          }
        }

        // Extract path parameters like :id or :userId
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
    }

    return routes;
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
          if (!['node_modules', 'dist', '.git', '.gemini', 'coverage', 'build', '.next'].includes(entry.name)) {
            this.collectSourceFiles(fullPath, maxFiles, collected);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.js', '.ts', '.mjs', '.cjs'].includes(ext) && !entry.name.endsWith('.d.ts') && !entry.name.includes('.test.')) {
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
