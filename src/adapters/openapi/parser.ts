/**
 * Fridayy - OpenAPI / Swagger Specification Parser & $ref Resolver
 * Supports OpenAPI 3.0.x, 3.1.x, and Swagger 2.0 (YAML & JSON).
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export interface ParsedOpenApiSpec {
  version: string;
  title: string;
  description?: string;
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, any>;
  components?: Record<string, any>;
  securityDefinitions?: Record<string, any>;
  rawDoc: any;
}

export class OpenApiParser {
  /**
   * Loads and parses an OpenAPI document from a file path, URL, or raw string.
   */
  public async parse(sourcePathOrContent: string, rootDir: string = process.cwd()): Promise<ParsedOpenApiSpec> {
    let rawContent: string;
    let filePath: string | undefined;

    if (sourcePathOrContent.startsWith('http://') || sourcePathOrContent.startsWith('https://')) {
      const res = await fetch(sourcePathOrContent);
      if (!res.ok) {
        throw new Error(`Failed to fetch OpenAPI spec from ${sourcePathOrContent}: ${res.status} ${res.statusText}`);
      }
      rawContent = await res.text();
    } else if (
      sourcePathOrContent.trim().startsWith('{') ||
      sourcePathOrContent.trim().startsWith('openapi:') ||
      sourcePathOrContent.trim().startsWith('swagger:')
    ) {
      rawContent = sourcePathOrContent;
    } else {
      filePath = path.isAbsolute(sourcePathOrContent)
        ? sourcePathOrContent
        : path.resolve(rootDir, sourcePathOrContent);

      if (!fs.existsSync(filePath)) {
        throw new Error(`OpenAPI specification file not found: ${filePath}`);
      }
      rawContent = fs.readFileSync(filePath, 'utf-8');
    }

    let parsed: any;
    try {
      if (rawContent.trim().startsWith('{')) {
        parsed = JSON.parse(rawContent);
      } else {
        parsed = YAML.parse(rawContent);
      }
    } catch (err: any) {
      throw new Error(`Failed to parse OpenAPI file as JSON/YAML: ${err.message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid OpenAPI document: document must be an object.');
    }

    // Resolve all internal $ref references
    const resolvedDoc = this.resolveRefs(parsed, parsed);

    return this.normalizeSpec(resolvedDoc);
  }

  /**
   * Resolves internal $ref pointers (e.g., #/components/schemas/User)
   */
  public resolveRefs(current: any, root: any, visited = new Set<string>()): any {
    if (current === null || current === undefined) {
      return current;
    }

    if (Array.isArray(current)) {
      return current.map(item => this.resolveRefs(item, root, visited));
    }

    if (typeof current === 'object') {
      if (current.$ref && typeof current.$ref === 'string') {
        const ref = current.$ref;
        if (ref.startsWith('#/')) {
          if (visited.has(ref)) {
            // Circular reference detected; return placeholder or shallow copy to prevent infinite loop
            return { type: 'object', description: `[Circular Ref: ${ref}]` };
          }
          visited.add(ref);
          const resolved = this.lookupRef(ref, root);
          const deepResolved = this.resolveRefs(resolved, root, new Set(visited));
          visited.delete(ref);
          return deepResolved;
        }
      }

      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(current)) {
        result[key] = this.resolveRefs(val, root, visited);
      }
      return result;
    }

    return current;
  }

  private lookupRef(ref: string, root: any): any {
    const parts = ref.replace(/^#\//, '').split('/');
    let current = root;
    for (const part of parts) {
      const unescaped = part.replace(/~1/g, '/').replace(/~0/g, '~');
      if (current && typeof current === 'object' && unescaped in current) {
        current = current[unescaped];
      } else {
        return { type: 'object', description: `[Unresolved Ref: ${ref}]` };
      }
    }
    return current;
  }

  private normalizeSpec(doc: any): ParsedOpenApiSpec {
    const isSwagger2 = doc.swagger && doc.swagger.startsWith('2.');
    const version = doc.openapi || doc.swagger || '3.0.0';
    const title = doc.info?.title || 'API Specification';
    const description = doc.info?.description;

    const servers: Array<{ url: string; description?: string }> = [];

    if (doc.servers && Array.isArray(doc.servers)) {
      servers.push(...doc.servers);
    } else if (isSwagger2) {
      const scheme = doc.schemes?.[0] || 'http';
      const host = doc.host || 'localhost';
      const basePath = doc.basePath || '';
      servers.push({ url: `${scheme}://${host}${basePath}` });
    }

    if (servers.length === 0) {
      servers.push({ url: 'http://localhost:3000' });
    }

    const components = doc.components || {
      schemas: doc.definitions || {},
      securitySchemes: doc.securityDefinitions || {}
    };

    return {
      version,
      title,
      description,
      servers,
      paths: doc.paths || {},
      components,
      securityDefinitions: doc.securityDefinitions || doc.components?.securitySchemes,
      rawDoc: doc
    };
  }
}
