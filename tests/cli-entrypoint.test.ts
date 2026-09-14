import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Regression test for a bug where every command ran twice when invoked
 * through the exact shape of entry point `npm install -g` actually creates:
 * a symlink named `fridayy` (no file extension) pointing at bin/fridayy.js.
 *
 * bin/fridayy.js imports dist/cli/index.js and calls run(). That module also
 * had a "run myself if directly executed" guard at its bottom, which used to
 * fall back to `process.argv[1].endsWith('fridayy')` when a strict path match
 * failed. Since argv[1] for a real installed invocation *is* a path ending in
 * "fridayy" (the symlink), the guard matched, so dist/cli/index.js invoked
 * run() during its own import — and then bin/fridayy.js invoked run() again
 * itself. Every command, and every write to a target API, executed twice.
 *
 * `node bin/fridayy.js` and `node dist/cli/index.js` (what the existing test
 * suite and every developer's local testing use) never hit this, because
 * neither of those paths ends in exactly "fridayy" with no extension — only
 * the installed shim's symlink name does. Hence this test spawns the CLI
 * through a real symlink shaped exactly like npm's, rather than importing
 * source or dist modules directly.
 */
describe('CLI entrypoint (installed global-bin shape)', () => {
  const binTarget = path.resolve(__dirname, '../bin/fridayy.js');
  let binDir: string;
  let symlinkPath: string;

  beforeAll(() => {
    if (!fs.existsSync(path.resolve(__dirname, '../dist/cli/index.js'))) {
      throw new Error('dist/ is not built — run `npm run build` before running this test.');
    }
    binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridayy-bin-'));
    symlinkPath = path.join(binDir, 'fridayy'); // no extension, matching npm's real bin shim
    fs.symlinkSync(binTarget, symlinkPath);
  });

  afterAll(() => {
    fs.rmSync(binDir, { recursive: true, force: true });
  });

  it('runs a command exactly once when invoked via a symlink named "fridayy"', () => {
    const output = execFileSync(symlinkPath, ['use'], { encoding: 'utf-8' });
    const occurrences = (output.match(/THE FRIDAYY MOTTO/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('prints --version exactly once via the same symlink', () => {
    const output = execFileSync(symlinkPath, ['--version'], { encoding: 'utf-8' }).trim();
    expect(output.split('\n').length).toBe(1);
  });
});
