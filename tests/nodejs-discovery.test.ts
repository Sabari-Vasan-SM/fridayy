import { describe, it, expect } from 'vitest';
import { NodeJsScanner } from '../src/adapters/nodejs/ast-scanner.js';

describe('Node.js Route & Capability Discovery', () => {
  const scanner = new NodeJsScanner();

  it('should extract Express route patterns with comments and path parameters', () => {
    const sampleCode = `
      import express from 'express';
      const app = express();

      // List all active products
      app.get('/api/products', (req, res) => res.json([]));

      /**
       * @summary Retrieve customer order by ID
       */
      app.get('/api/orders/:orderId', (req, res) => res.json({}));

      // Create new customer account
      app.post('/api/users', (req, res) => res.status(201).json({}));

      app.delete('/api/users/:userId', (req, res) => res.json({ deleted: true }));
    `;

    const routes = scanner.scanFileContent(sampleCode, 'server.js');

    expect(routes.length).toBe(4);

    expect(routes[0].method).toBe('GET');
    expect(routes[0].path).toBe('/api/products');
    expect(routes[0].description).toBe('List all active products');

    expect(routes[1].method).toBe('GET');
    expect(routes[1].path).toBe('/api/orders/:orderId');
    expect(routes[1].pathParams).toEqual(['orderId']);
    expect(routes[1].description).toBe('Retrieve customer order by ID');

    expect(routes[2].method).toBe('POST');
    expect(routes[2].path).toBe('/api/users');

    expect(routes[3].method).toBe('DELETE');
    expect(routes[3].path).toBe('/api/users/:userId');
    expect(routes[3].pathParams).toEqual(['userId']);
  });
});
