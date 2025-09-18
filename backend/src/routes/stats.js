const express = require('express');
const fsp = require('fs').promises;
const path = require('path');
const { mean } = require('../utils/stats');

const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

// simple in-memory cache
let cache = {
  stats: null,
  lastModified: 0
};

async function getStats() {
  // check file metadata
  const { mtimeMs } = await fsp.stat(DATA_PATH);

  // recompute only if file changed
  if (!cache.stats || mtimeMs > cache.lastModified) {
    const raw = await fsp.readFile(DATA_PATH, 'utf8');
    const items = JSON.parse(raw);

    cache.stats = {
      total: items.length,
      averagePrice: mean(items.map((item) => item.price))
    };

    cache.lastModified = mtimeMs;
  }

  return cache.stats;
}

// GET /api/stats
router.get('/', async (req, res, next) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
