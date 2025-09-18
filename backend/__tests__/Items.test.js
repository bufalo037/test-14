// __tests__/items.test.js
const express = require('express');
const request = require('supertest');

// ---- Mock fs.promises so we never hit the real filesystem
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

const { promises: fsp } = require('fs');

// Use a fixed timestamp for deterministic IDs
const REAL_NOW = Date.now;
beforeAll(() => {
  Date.now = jest.fn(() => 1700000000000);
});
afterAll(() => {
  Date.now = REAL_NOW;
});

const itemsRouter = require('../src/routes/items');
/**
 * Small helper that mounts the items router at /api/items
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/items', itemsRouter);
  // basic error handler to surface status codes in tests
  // (Express default uses err.status if provided, else 500)
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  });
  return app;
}

describe('Items routes', () => {
  const sampleItems = [
    { id: 1, name: 'Apple', category: 'Fruit', price: 1.99 },
    { id: 2, name: 'Banana', category: 'Fruit', price: 0.99 },
    { id: 3, name: 'Carrot', category: 'Vegetable', price: 2.5 },
    { id: 4, name: 'Desk', category: 'Furniture', price: 120.0 },
  ];
  const sampleJson = JSON.stringify(sampleItems, null, 2);

  beforeEach(() => {
    jest.clearAllMocks();
    fsp.readFile.mockResolvedValue(sampleJson);
    fsp.writeFile.mockResolvedValue();
  });

  describe('GET /api/items', () => {
    test('returns paginated items (happy path)', async () => {
      const app = makeApp();

      const res = await request(app).get('/api/items?page=2&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual(sampleItems.slice(2, 4));
      expect(res.body.total).toBe(sampleItems.length);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(2);
      expect(fsp.readFile).toHaveBeenCalledTimes(1);
    });

    test('applies case-insensitive q filter across name + category', async () => {
      const app = makeApp();

      // query that matches both "Banana" (name) and "Furniture" (category)
      const res = await request(app).get('/api/items?q=FURN');

      expect(res.status).toBe(200);
      const names = res.body.items.map((i) => i.name);
      expect(names).toEqual(['Desk']); // only category match
    });

    test('clamps limit to [1..200] and page >= 1', async () => {
      const app = makeApp();

      // limit below range -> becomes 1, negative page -> becomes 1
      const res = await request(app).get('/api/items?limit=0&page=-5');

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0]).toEqual(sampleItems[0]);
    });

    test('propagates read error as 500', async () => {
      const app = makeApp();
      fsp.readFile.mockRejectedValue(new Error('Disk exploded'));

      const res = await request(app).get('/api/items');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/disk exploded/i);
    });
  });

  describe('GET /api/items/:id', () => {
    test('returns a single item by id (happy path)', async () => {
      const app = makeApp();

      const res = await request(app).get('/api/items/2');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(sampleItems[1]);
    });

    test('returns 404 when item not found', async () => {
      const app = makeApp();

      const res = await request(app).get('/api/items/9999');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    test('500 when read fails', async () => {
      const app = makeApp();
      fsp.readFile.mockRejectedValue(new Error('read fail'));

      const res = await request(app).get('/api/items/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/read fail/i);
    });
  });

  // MOCK POST
  describe('POST /api/items', () => {
    test('creates a new item when payload is valid (happy path)', async () => {
      const app = makeApp();

      const payload = { name: 'Earbuds', category: 'Electronics', price: 49.99 };
      const res = await request(app).post('/api/items').send(payload);

      expect(res.status).toBe(201);
      // response payload
      expect(res.body).toMatchObject({
        name: 'Earbuds',
        category: 'Electronics',
        price: 49.99,
        id: 1700000000000, // mocked Date.now()
      });

      // writeFile called with appended item
      expect(fsp.writeFile).toHaveBeenCalledTimes(1);
      const [filePath, content] = fsp.writeFile.mock.calls[0];
      expect(typeof filePath).toBe('string');
      const written = JSON.parse(content);
      expect(written).toHaveLength(sampleItems.length + 1);
      expect(written.find((i) => i.id === 1700000000000)).toBeTruthy();
    });

    test('400 with validation errors: missing/invalid fields', async () => {
      const app = makeApp();

      const invalids = [
        [{}, /name/i], // missing name
        [{ name: '   ', category: 'X', price: 1 }, /name/i],
        [{ name: 'Ok', category: '', price: 1 }, /category/i],
        [{ name: 'Ok', category: 'C', price: -1 }, /price/i],
        [{ name: 'Ok', category: 'C', price: 'free' }, /price/i],
        [null, /payload/i],
      ];

      for (const [body, regex] of invalids) {
        jest.clearAllMocks(); // reset counts
        const res = await request(app).post('/api/items').send(body);

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(expect.any(Array));

        // IMPORTANT: should not read or write if validation fails
        expect(fsp.readFile).not.toHaveBeenCalled();
        expect(fsp.writeFile).not.toHaveBeenCalled();
      }
    });
  });
});
