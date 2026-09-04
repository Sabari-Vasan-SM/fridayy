/**
 * Fridayy - Global Credentials Store
 * Reads/writes a per-user credentials file (see global-dir.ts) so secrets can be
 * configured once per device and reused across every Fridayy project, instead of
 * being duplicated in plaintext inside per-project fridayy.config.json files.
 *
 * This is a plain JSON file, not an OS keychain — it is restricted to the
 * current user via filesystem permissions (chmod 600 on POSIX) but is not
 * encrypted at rest. Prefer real environment variables / a secrets manager for
 * production deployments.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getGlobalCredentialsPath } from './global-dir.js';

export type CredentialsMap = Record<string, string>;

export class CredentialsStore {
  constructor(private readonly filePath: string = getGlobalCredentialsPath()) {}

  public getPath(): string {
    return this.filePath;
  }

  public load(): CredentialsMap {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      // A corrupt or unreadable credentials file must never crash secret
      // resolution; treat it as empty and let env vars / config still work.
      return {};
    }
  }

  public get(key: string): string | undefined {
    return this.load()[key];
  }

  public set(key: string, value: string): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const store = this.load();
    store[key] = value;
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2), { encoding: 'utf-8', mode: 0o600 });

    // Ensure permissions are tightened even if the file already existed with
    // looser permissions (writeFileSync's `mode` only applies when creating).
    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch {
      // Best-effort on platforms (e.g. Windows) where POSIX chmod semantics
      // don't apply; the directory/file are still user-scoped by their location.
    }
  }

  public remove(key: string): boolean {
    const store = this.load();
    if (!(key in store)) {
      return false;
    }
    delete store[key];
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2), { encoding: 'utf-8', mode: 0o600 });
    return true;
  }

  public list(): string[] {
    return Object.keys(this.load());
  }
}

export const defaultCredentialsStore = new CredentialsStore();
