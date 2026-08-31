import { describe, it, expect } from 'vitest';
import { classifyOperation } from '../src/core/permissions/classifier.js';

describe('Permissions & Risk Classification', () => {
  it('should classify GET requests as safe READ operations with low risk', () => {
    const res = classifyOperation({
      method: 'GET',
      path: '/api/v1/users',
      summary: 'Get all users'
    });

    expect(res.permissions.type).toBe('READ');
    expect(res.permissions.read).toBe(true);
    expect(res.permissions.write).toBe(false);
    expect(res.permissions.destructive).toBe(false);
    expect(res.risk).toBe('low');
    expect(res.status).toBe('APPROVED');
  });

  it('should classify POST and PUT as WRITE operations with medium risk and PENDING status', () => {
    const postRes = classifyOperation({
      method: 'POST',
      path: '/api/v1/orders',
      summary: 'Create order'
    });

    expect(postRes.permissions.type).toBe('WRITE');
    expect(postRes.permissions.write).toBe(true);
    expect(postRes.risk).toBe('medium');
    expect(postRes.status).toBe('PENDING');

    const putRes = classifyOperation({
      method: 'PUT',
      path: '/api/v1/profile',
      summary: 'Update profile'
    });

    expect(putRes.permissions.type).toBe('WRITE');
    expect(putRes.status).toBe('PENDING');
  });

  it('should classify DELETE HTTP methods as DESTRUCTIVE with high risk and BLOCKED status', () => {
    const res = classifyOperation({
      method: 'DELETE',
      path: '/api/v1/accounts/123'
    });

    expect(res.permissions.type).toBe('DESTRUCTIVE');
    expect(res.permissions.destructive).toBe(true);
    expect(res.risk).toBe('high');
    expect(res.status).toBe('BLOCKED');
  });

  it('should detect destructive keywords even on non-DELETE methods', () => {
    const res = classifyOperation({
      method: 'POST',
      path: '/api/v1/cache/purge',
      summary: 'Purge all cached keys'
    });

    expect(res.permissions.type).toBe('DESTRUCTIVE');
    expect(res.risk).toBe('high');
    expect(res.status).toBe('BLOCKED');

    const cancelRes = classifyOperation({
      method: 'POST',
      path: '/api/v1/subscription/cancel',
      operationId: 'cancel_subscription'
    });
    expect(cancelRes.permissions.type).toBe('DESTRUCTIVE');
    expect(cancelRes.status).toBe('BLOCKED');
  });
});
