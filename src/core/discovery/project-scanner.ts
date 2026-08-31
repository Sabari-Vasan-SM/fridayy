/**
 * Fridayy - Project Scanner & Capability Discovery
 * Analyzes projects, repositories, and APIs to detect capabilities, specs, and auth mechanisms.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ScanResult, FridayyConfig } from '../schema/types.js';
import { AdapterRegistry, defaultAdapterRegistry } from '../../adapters/registry.js';
import { OpenApiParser } from '../../adapters/openapi/parser.js';
import { NodeJsScanner } from '../../adapters/nodejs/ast-scanner.js';

export class ProjectScanner {
  private adapterRegistry: AdapterRegistry;
  private openApiParser = new OpenApiParser();
  private nodeJsScanner = new NodeJsScanner();

  constructor(adapterRegistry: AdapterRegistry = defaultAdapterRegistry) {
    this.adapterRegistry = adapterRegistry;
  }

  /**
   * Scans a root directory and returns comprehensive capability detection results.
   */
  public async scan(rootDir: string = process.cwd()): Promise<ScanResult> {
    const absRoot = path.resolve(rootDir);

    // 1. Scan for OpenAPI files
    const openApiFiles = this.findOpenApiFiles(absRoot);
    const hasOpenApi = openApiFiles.length > 0;
    const openApiSpecsDetails: Array<{ path: string; version: string; title: string; endpointsCount: number }> = [];
    const authSchemesDetected: Set<string> = new Set();
    let totalEndpoints = 0;

    for (const relFile of openApiFiles) {
      try {
        const parsed = await this.openApiParser.parse(relFile, absRoot);
        const opCount = this.countEndpoints(parsed.paths);
        totalEndpoints += opCount;

        openApiSpecsDetails.push({
          path: relFile,
          version: parsed.version,
          title: parsed.title,
          endpointsCount: opCount
        });

        // Collect security schemes
        if (parsed.securityDefinitions) {
          for (const [schemeName, schemeDef] of Object.entries(parsed.securityDefinitions)) {
            authSchemesDetected.add(schemeName);
          }
        }
      } catch {
        // Skip unparseable specs
      }
    }

    // 2. Scan for Node.js routes & frameworks
    const pkgJsonPath = path.join(absRoot, 'package.json');
    let hasNodeJs = false;
    let nodeJsFramework: 'express' | 'fastify' | 'koa' | 'nestjs' | 'custom' | 'none' = 'none';

    if (fs.existsSync(pkgJsonPath)) {
      hasNodeJs = true;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps.express) nodeJsFramework = 'express';
        else if (allDeps.fastify) nodeJsFramework = 'fastify';
        else if (allDeps.koa) nodeJsFramework = 'koa';
        else if (allDeps['@nestjs/core']) nodeJsFramework = 'nestjs';
        else nodeJsFramework = 'custom';
      } catch {
        nodeJsFramework = 'custom';
      }
    }

    const discoveredRoutes = await this.nodeJsScanner.scanDirectory(absRoot, 100);
    if (discoveredRoutes.length > 0 && !hasOpenApi) {
      totalEndpoints += discoveredRoutes.length;
    }

    // 3. Formulate recommended configuration
    const projectName = path.basename(absRoot);
    const recommendedConfig: Partial<FridayyConfig> = {
      name: projectName,
      version: '1.0.0',
      source: hasOpenApi
        ? {
            type: 'openapi',
            path: openApiFiles[0]
          }
        : hasNodeJs && discoveredRoutes.length > 0
        ? {
            type: 'nodejs',
            rootDir: './'
          }
        : {
            type: 'openapi',
            path: './openapi.yaml'
          },
      server: {
        name: `${projectName}-mcp`,
        version: '1.0.0',
        transport: 'stdio'
      },
      security: {
        requireApprovalForDestructive: true,
        autoApproveRead: true,
        autoApproveWrite: false
      }
    };

    return {
      hasOpenApi,
      openApiFiles,
      hasNodeJs,
      nodeJsFramework,
      discoveredEndpointsCount: totalEndpoints,
      authSchemesDetected: Array.from(authSchemesDetected),
      recommendedConfig,
      details: {
        openApiSpecs: openApiSpecsDetails,
        routes: discoveredRoutes
      }
    };
  }

  private findOpenApiFiles(rootDir: string): string[] {
    const candidates = [
      'openapi.yaml',
      'openapi.yml',
      'openapi.json',
      'swagger.yaml',
      'swagger.yml',
      'swagger.json',
      'api/openapi.yaml',
      'api/openapi.json',
      'docs/openapi.yaml',
      'docs/openapi.json'
    ];

    const found: string[] = [];
    for (const rel of candidates) {
      if (fs.existsSync(path.join(rootDir, rel))) {
        found.push(rel);
      }
    }

    // Also search root for any *.openapi.json or *.swagger.yaml
    try {
      const files = fs.readdirSync(rootDir);
      for (const file of files) {
        if ((file.includes('openapi') || file.includes('swagger')) && !found.includes(file)) {
          const ext = path.extname(file).toLowerCase();
          if (['.json', '.yaml', '.yml'].includes(ext)) {
            found.push(file);
          }
        }
      }
    } catch {
      // ignore
    }

    return found;
  }

  private countEndpoints(paths: Record<string, any>): number {
    let count = 0;
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const pathItem of Object.values(paths)) {
      if (pathItem && typeof pathItem === 'object') {
        for (const m of methods) {
          if ((pathItem as any)[m]) {
            count++;
          }
        }
      }
    }
    return count;
  }
}

export const defaultProjectScanner = new ProjectScanner();
