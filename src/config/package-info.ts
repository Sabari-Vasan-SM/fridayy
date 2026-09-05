/**
 * Fridayy - Package Metadata Reader
 * Reads the CLI's own version from package.json at runtime, so the version
 * displayed by `--version` and the banner can never drift out of sync with a
 * hardcoded string left behind after a release bump.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedVersion: string | undefined;

export function getPackageVersion(): string {
  if (cachedVersion) return cachedVersion;

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  // This file lives at src/config/ (or dist/config/ once built), two levels
  // below the repository/package root in both cases.
  const pkgPath = path.resolve(moduleDir, '../../package.json');

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    cachedVersion = (pkg.version as string) || '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }

  return cachedVersion;
}
