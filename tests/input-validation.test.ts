import { describe, it, expect } from 'vitest';
import { validateToolInput } from '../src/core/validation/validator.js';
import { FridayyToolDefinition } from '../src/core/schema/types.js';

describe('Input Validation', () => {
  const tool: FridayyToolDefinition = {
    id: 'tool_create_order',
    name: 'create_order',
    description: 'Create order',
    inputSchema: {
      type: 'object',
      required: ['customerEmail', 'quantity', 'category'],
      properties: {
        customerEmail: { type: 'string' },
        quantity: { type: 'integer', minimum: 1, maximum: 50 },
        category: { type: 'string', enum: ['electronics', 'apparel', 'books'] },
        expressShipping: { type: 'boolean' }
      }
    },
    source: { type: 'rest' },
    permissions: { type: 'WRITE', read: false, write: true, destructive: false },
    risk: 'medium',
    status: 'APPROVED'
  };

  it('should accept valid inputs matching schema constraints', () => {
    const res = validateToolInput(tool, {
      customerEmail: 'alice@example.com',
      quantity: 5,
      category: 'electronics',
      expressShipping: true
    });

    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('should fail when missing required parameters', () => {
    const res = validateToolInput(tool, {
      quantity: 5
    });

    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.path === 'customerEmail')).toBe(true);
    expect(res.errors.some(e => e.path === 'category')).toBe(true);
  });

  it('should fail on invalid enum value', () => {
    const res = validateToolInput(tool, {
      customerEmail: 'alice@example.com',
      quantity: 5,
      category: 'invalid_category'
    });

    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.path === 'category' && e.message.includes('must be one of'))).toBe(true);
  });

  it('should fail on number out of range', () => {
    const res = validateToolInput(tool, {
      customerEmail: 'alice@example.com',
      quantity: 100, // exceeds max 50
      category: 'books'
    });

    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.path === 'quantity' && e.message.includes('greater than maximum'))).toBe(true);
  });
});
