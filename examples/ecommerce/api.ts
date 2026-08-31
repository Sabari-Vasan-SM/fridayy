/**
 * Fridayy Example - E-Commerce REST API Server
 * A standalone Express REST server demonstrating products, orders, and user management.
 */

import express, { Request, Response, NextFunction } from 'express';

export function createEcommerceApp() {
  const app = express();
  app.use(express.json());

  // In-memory database
  const products = [
    { productId: 'prod_1', title: 'Noise-Canceling Wireless Headphones', price: 199.99, stock: 45, category: 'electronics' },
    { productId: 'prod_2', title: 'Ergonomic Mechanical Keyboard', price: 129.5, stock: 20, category: 'electronics' },
    { productId: 'prod_3', title: 'Organic Cotton Hoodie', price: 59.0, stock: 100, category: 'apparel' }
  ];

  const orders = [
    {
      orderId: 'ord_101',
      customerEmail: 'alice@example.com',
      items: [{ productId: 'prod_1', quantity: 1 }],
      total: 199.99,
      status: 'completed',
      createdAt: '2026-08-30T10:00:00Z'
    }
  ];

  const users = [
    { userId: 'usr_1', name: 'Alice Smith', email: 'alice@example.com', role: 'customer' },
    { userId: 'usr_2', name: 'Bob Jones', email: 'bob@example.com', role: 'admin' }
  ];

  // Auth Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    // Allow without key if test env or validate key
    if (process.env.REQUIRE_API_KEY === 'true') {
      if (!apiKey || (apiKey !== 'secret-ecommerce-key' && apiKey !== 'Bearer secret-ecommerce-key')) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Valid x-api-key header is required.' });
        return;
      }
    }
    next();
  });

  // Products Endpoints
  app.get('/products', (req: Request, res: Response) => {
    let result = [...products];
    if (req.query.category) {
      result = result.filter(p => p.category === req.query.category);
    }
    if (req.query.limit) {
      result = result.slice(0, Number(req.query.limit));
    }
    res.json(result);
  });

  app.get('/products/:productId', (req: Request, res: Response) => {
    const product = products.find(p => p.productId === req.params.productId);
    if (!product) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Product ${req.params.productId} not found` });
      return;
    }
    res.json(product);
  });

  app.post('/products', (req: Request, res: Response) => {
    const { title, price, stock, category } = req.body;
    if (!title || price === undefined || stock === undefined) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'title, price, and stock are required' });
      return;
    }
    const newProduct = {
      productId: `prod_${Date.now()}`,
      title,
      price: Number(price),
      stock: Number(stock),
      category: category || 'general'
    };
    products.push(newProduct);
    res.status(201).json(newProduct);
  });

  app.delete('/products/:productId', (req: Request, res: Response) => {
    const idx = products.findIndex(p => p.productId === req.params.productId);
    if (idx === -1) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Product ${req.params.productId} not found` });
      return;
    }
    const deleted = products.splice(idx, 1)[0];
    res.json({ message: 'Product deleted successfully', deleted });
  });

  // Orders Endpoints
  app.get('/orders', (req: Request, res: Response) => {
    let result = [...orders];
    if (req.query.status) {
      result = result.filter(o => o.status === req.query.status);
    }
    res.json(result);
  });

  app.get('/orders/:orderId', (req: Request, res: Response) => {
    const order = orders.find(o => o.orderId === req.params.orderId);
    if (!order) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Order ${req.params.orderId} not found` });
      return;
    }
    res.json(order);
  });

  app.post('/orders', (req: Request, res: Response) => {
    const { customerEmail, items } = req.body;
    if (!customerEmail || !items || !Array.isArray(items)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'customerEmail and items array are required' });
      return;
    }
    const newOrder = {
      orderId: `ord_${Date.now()}`,
      customerEmail,
      items,
      total: 150.0,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    orders.push(newOrder);
    res.status(201).json(newOrder);
  });

  // Users Endpoints
  app.get('/users', (req: Request, res: Response) => {
    res.json(users);
  });

  app.post('/users', (req: Request, res: Response) => {
    const { name, email, role } = req.body;
    const newUser = {
      userId: `usr_${Date.now()}`,
      name,
      email,
      role: role || 'customer'
    };
    users.push(newUser);
    res.status(201).json(newUser);
  });

  app.delete('/users/:userId', (req: Request, res: Response) => {
    const idx = users.findIndex(u => u.userId === req.params.userId);
    if (idx === -1) {
      res.status(404).json({ error: 'NOT_FOUND', message: `User ${req.params.userId} not found` });
      return;
    }
    const deleted = users.splice(idx, 1)[0];
    res.json({ message: 'User deleted successfully', deleted });
  });

  return app;
}

// If run directly as a script
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('api.ts')) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  const app = createEcommerceApp();
  app.listen(port, () => {
    console.log(`E-Commerce Store API listening at http://localhost:${port}`);
  });
}
