import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CredentialsStore } from '../src/config/credentials-store.js';
import { SecretResolver } from '../src/core/authentication/secret-resolver.js';

describe('CredentialsStore', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-creds-'));
  const filePath = path.join(tmpDir, 'credentials.json');

  afterEach(() => {
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
  });

  it('returns an empty map when no file exists yet', () => {
    const store = new CredentialsStore(filePath);
    expect(store.list()).toEqual([]);
    expect(store.get('FOO')).toBeUndefined();
  });

  it('persists and retrieves a secret across instances', () => {
    new CredentialsStore(filePath).set('FRIDAYY_API_KEY', 'super-secret');
    const reloaded = new CredentialsStore(filePath);
    expect(reloaded.get('FRIDAYY_API_KEY')).toBe('super-secret');
    expect(reloaded.list()).toContain('FRIDAYY_API_KEY');
  });

  it('creates the file with owner-only permissions on POSIX platforms', () => {
    if (process.platform === 'win32') return;
    new CredentialsStore(filePath).set('FRIDAYY_API_KEY', 'x');
    const mode = fs.statSync(filePath).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('removes a stored secret', () => {
    const store = new CredentialsStore(filePath);
    store.set('FRIDAYY_API_KEY', 'x');
    expect(store.remove('FRIDAYY_API_KEY')).toBe(true);
    expect(store.get('FRIDAYY_API_KEY')).toBeUndefined();
    expect(store.remove('FRIDAYY_API_KEY')).toBe(false);
  });
});

describe('SecretResolver global credentials fallback', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-resolver-'));
  const filePath = path.join(tmpDir, 'credentials.json');
  const store = new CredentialsStore(filePath);

  afterEach(() => {
    delete process.env.FRIDAYY_TEST_KEY;
  });

  it('falls back to the global credentials store when env vars are unset', () => {
    store.set('FRIDAYY_TEST_KEY', 'from-global-store');
    const resolver = new SecretResolver({}, store);
    expect(resolver.resolveSecret('test', { envKey: 'FRIDAYY_TEST_KEY' })).toBe('from-global-store');
  });

  it('prefers an environment variable over the global credentials store', () => {
    store.set('FRIDAYY_TEST_KEY', 'from-global-store');
    process.env.FRIDAYY_TEST_KEY = 'from-env';
    const resolver = new SecretResolver({}, store);
    expect(resolver.resolveSecret('test', { envKey: 'FRIDAYY_TEST_KEY' })).toBe('from-env');
  });
});
