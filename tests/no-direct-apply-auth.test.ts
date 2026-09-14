import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guardrail: every adapter must apply authentication via
 * `applyAuthToRequest()` (src/adapters/openapi/request-builder.ts), never by
 * calling `authManager.applyAuth(...)` directly.
 *
 * `applyAuth()` returns an AuthContext whose `queryParams` have to be merged
 * back onto the request URL — the URL string was already finalized by
 * buildHttpRequest() before applyAuth() runs, so headers can be mutated in
 * place but query params can't. Every one of the five original adapters
 * (openapi, nodejs, rest x2, manual) called `applyAuth(auth, { headers,
 * queryParams: {} })` and discarded the return value, so a `{type: apiKey,
 * in: query}` scheme resolved its secret correctly but never actually sent
 * it — the target API just 401s with nothing in the output explaining why.
 * `applyAuthToRequest()` fixes this in one place.
 *
 * Patching the five call sites individually would not have stopped a sixth
 * adapter from reintroducing the same bug by copying one of them (exactly
 * what happened when the Laravel adapter was added). This test is a static
 * guardrail so that mistake fails immediately, with a message pointing at
 * the fix, rather than shipping silently to whoever writes adapter #7.
 */
describe('No adapter calls AuthenticationManager.applyAuth() directly', () => {
  const adaptersDir = path.resolve(__dirname, '../src/adapters');

  function collectTsFiles(dir: string, collected: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectTsFiles(full, collected);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        collected.push(full);
      }
    }
    return collected;
  }

  // The one file allowed to reference `.applyAuth(` — it's the sanctioned
  // wrapper every adapter must go through instead.
  const allowedFile = path.resolve(adaptersDir, 'openapi/request-builder.ts');

  it('contains no direct `.applyAuth(` calls outside request-builder.ts', () => {
    const offenders: string[] = [];

    for (const file of collectTsFiles(adaptersDir)) {
      if (path.resolve(file) === allowedFile) continue;

      const content = fs.readFileSync(file, 'utf-8');
      if (/\.applyAuth\s*\(/.test(content)) {
        offenders.push(path.relative(adaptersDir, file));
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `Found direct authManager.applyAuth(...) call(s) in: ${offenders.join(', ')}. ` +
          `Use applyAuthToRequest(authManager, tool.authentication, preparedReq) from ` +
          `src/adapters/openapi/request-builder.ts instead — calling .applyAuth() directly ` +
          `and discarding its return value silently drops query-parameter-based auth ` +
          `(e.g. {type: 'apiKey', in: 'query'}).`
      );
    }

    expect(offenders).toEqual([]);
  });
});
