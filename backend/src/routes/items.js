const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

const DATA_PATH = path.join(__dirname, '../../../data/items.json');

async function readData() {
  const raw = await fs.readFile(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function writeData(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function validateItem(item) {
  const errors = [];

  if (!item || typeof item !== 'object') {
    errors.push('Invalid payload: must be an object');
    return errors;
  }

  if (typeof item.name !== 'string' || !item.name.trim()) {
    errors.push('Missing or invalid "name" (string required)');
  }

  if (typeof item.category !== 'string' || !item.category.trim()) {
    errors.push('Missing or invalid "category" (string required)');
  }

  if (typeof item.price !== 'number' || isNaN(item.price) || item.price < 0) {
    errors.push('Missing or invalid "price" (positive number required)');
  }

  return errors;
}


/**
 * GET /api/items
 * Supports:
 *  - q:   case-insensitive substring over name (and category if present)
 *  - page (1-based)
 *  - limit (1..200)
 * Responds with: { items, total, page, limit }
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await readData();

    const q = String(req.query.q || '').trim().toLowerCase();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);

    // Filter by query (name and category if present)
    let filtered = data;
    if (q) {
      filtered = data.filter((item) => {
        const name = String(item.name || '').toLowerCase();
        const cat = String(item.category || '').toLowerCase();
        return name.includes(q) || cat.includes(q);
      });
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/items/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const data = await readData();
    const id = Number.parseInt(req.params.id, 10);
    const item = data.find((i) => Number(i.id) === id);

    if (!item) {
      const err = new Error('Item not found');
      err.status = 404;
      throw err;
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/items
 */
router.post('/', async (req, res, next) => {
  try {
    const payload = req.body || {};

    // Doing validation before reading data
    const errors = validateItem(payload);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Now we actually read data once we validated the new item
    const data = await readData();

    const newItem = {
      name: payload.name.trim(),
      category: payload.category.trim(),
      price: payload.price,
      id: Date.now(),
    };

    data.push(newItem);
    await writeData(data);

    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
