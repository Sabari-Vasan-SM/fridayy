import { describe, it, expect } from 'vitest';
import { AuthenticationManager } from '../src/core/authentication/manager.js';
import { SecretResolver } from '../src/core/authentication/secret-resolver.js';
import { sanitizeData, sanitizeHeaders } from '../src/security/sanitizer.js';

describe('Authentication & Secret Isolation', () => {
  it('should inject Bearer token into Authorization header', () => {
    const resolver = new SecretResolver({ FRIDAYY_BEARER_TOKEN: 'test-jwt-token-12345' });
    const authManager = new AuthenticationManager(undefined, resolver);

    const ctx = authManager.applyAuth(
      { required: true, type: 'bearer' },
      { headers: {}, queryParams: {} }
    );

    expect(ctx.headers['Authorization']).toBe('Bearer test-jwt-token-12345');
  });

  it('should inject API key via custom header or query param', () => {
    const resolver = new SecretResolver({ FRIDAYY_API_KEY: 'my-api-key-999' });
    const authManager = new AuthenticationManager(undefined, resolver);

    // Header injection
    const headerCtx = authManager.applyAuth(
      { required: true, type: 'apiKey', headerName: 'x-api-key' },
      { headers: {}, queryParams: {} }
    );
    expect(headerCtx.headers['x-api-key']).toBe('my-api-key-999');

    // Query param injection
    const queryCtx = authManager.applyAuth(
      { required: true, type: 'apiKey', queryParam: 'api_key' },
      { headers: {}, queryParams: {} }
    );
    expect(queryCtx.queryParams['api_key']).toBe('my-api-key-999');
  });

  it('should inject Basic auth with base64 encoding', () => {
    const resolver = new SecretResolver({ FRIDAYY_BASIC_KEY: 'admin:secretpass' });
    const authManager = new AuthenticationManager(undefined, resolver);

    const ctx = authManager.applyAuth(
      { required: true, type: 'basic', schemeName: 'BASIC' },
      { headers: {}, queryParams: {} }
    );

    const expectedB64 = Buffer.from('admin:secretpass').toString('base64');
    expect(ctx.headers['Authorization']).toBe(`Basic ${expectedB64}`);
  });

  it('should sanitize secret tokens in logs and headers', () => {
    const headers = {
      'Authorization': 'Bearer test-jwt-secret-xyz',
      'x-api-key': 'super-secret-key-123',
      'Content-Type': 'application/json'
    };

    const sanitized = sanitizeHeaders(headers);
    expect(sanitized['Authorization']).toBe('[REDACTED]');
    expect(sanitized['x-api-key']).toBe('[REDACTED]');
    expect(sanitized['Content-Type']).toBe('application/json');

    const payload = {
      username: 'user1',
      password: 'password123',
      apiKey: 'secret-key',
      profile: {
        token: 'auth-token'
      }
    };

    const cleanPayload = sanitizeData(payload);
    expect(cleanPayload.username).toBe('user1');
    expect(cleanPayload.password).toBe('[REDACTED]');
    expect(cleanPayload.apiKey).toBe('[REDACTED]');
    expect(cleanPayload.profile.token).toBe('[REDACTED]');
  });
});
