import { describe, it, expect } from 'vitest';
import { sanitizeData, sanitizeHeaders, isSensitiveKey } from '../src/security/sanitizer.js';

describe('Sanitizer', () => {
  it('redacts values under sensitive key names regardless of shape', () => {
    const result = sanitizeData({ apiToken: 'abc', password: 'hunter2', note: 'hello' });
    expect(result.apiToken).toBe('[REDACTED]');
    expect(result.password).toBe('[REDACTED]');
    expect(result.note).toBe('hello');
  });

  it('redacts Bearer tokens embedded in strings', () => {
    expect(sanitizeData('Authorization: Bearer abc.def.ghi')).toContain('Bearer [REDACTED]');
  });

  it('redacts JWT-shaped strings even under an innocuous key name', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = sanitizeData({ value: jwt });
    expect(result.value).toBe('[REDACTED]');
  });

  it('redacts common vendor API key formats under an innocuous key name', () => {
    // Built from parts rather than a literal string so this fixture isn't itself
    // flagged as a leaked credential by secret-scanning tools.
    const fakeStripeKey = ['sk', 'live', '51Hxyz1234567890ABCDEFGHIJKL'].join('_');
    const result = sanitizeData({ x: fakeStripeKey });
    expect(result.x).toBe('[REDACTED]');
  });

  it('redacts long hex tokens (session ids, hashes)', () => {
    const result = sanitizeData('session=a3f9c1e7b2d4f8901234567890abcdef');
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('a3f9c1e7');
  });

  it('does not redact ordinary human-readable identifiers', () => {
    expect(sanitizeData('order-20250904-checkout-confirmation')).toBe(
      'order-20250904-checkout-confirmation'
    );
    expect(sanitizeData('The product SKU is ABCDEF1234567890 and ships tomorrow')).toBe(
      'The product SKU is ABCDEF1234567890 and ships tomorrow'
    );
  });

  it('recurses into nested objects and arrays', () => {
    const result = sanitizeData({ user: { profile: { secret: 'shh' } }, list: [{ token: 'x' }] });
    expect(result.user.profile.secret).toBe('[REDACTED]');
    expect(result.list[0].token).toBe('[REDACTED]');
  });

  it('sanitizeHeaders always redacts authorization, x-api-key, and cookie', () => {
    const result = sanitizeHeaders({
      Authorization: 'Bearer abc',
      'X-Api-Key': 'xyz',
      Cookie: 'session=1',
      'Content-Type': 'application/json'
    });
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result['X-Api-Key']).toBe('[REDACTED]');
    expect(result.Cookie).toBe('[REDACTED]');
    expect(result['Content-Type']).toBe('application/json');
  });

  it('isSensitiveKey matches common secret-shaped field names', () => {
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('productName')).toBe(false);
  });
});
