const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

// Pearl-required /healthcheck endpoint
router.get('/healthcheck', (req, res) => {
  try {
    // Verify DB is reachable
    const stats = db.prepare('SELECT key, value FROM stats').all();
    const statsMap = {};
    stats.forEach(s => { statsMap[s.key] = s.value; });

    const memoryCount = db.prepare('SELECT COUNT(*) as count FROM memories').get();
    const mechCount = db.prepare('SELECT COUNT(*) as count FROM weave_requests WHERE status = ?').get('completed');

    // Write to log.txt (Pearl requirement)
    const logEntry = `[${new Date().toISOString()}] HEALTHCHECK OK — memories: ${memoryCount.count}, mech_served: ${mechCount.count}\n`;
    const logPath = path.join(process.cwd(), 'log.txt');
    fs.appendFileSync(logPath, logEntry);

    res.json({
      status: 'ok',
      agent: 'Memora',
      version: '1.0.0',
      description: 'Shared memory weaver for Pearl agents',
      website: 'https://memora.codes',
      erc8004: true,
      chain: 'base',
      stats: {
        total_memories: memoryCount.count,
        mech_requests_served: mechCount.count,
        total_weaves: parseInt(statsMap.total_weaves || 0),
        total_recalls: parseInt(statsMap.total_recalls || 0),
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Memora',
    tagline: 'One memory. All your agents. Forever on-chain.',
    version: '1.0.0',
    endpoints: {
      healthcheck: 'GET /healthcheck',
      weave: 'POST /weave',
      recall: 'GET /recall',
      forget: 'DELETE /forget/:id',
      request: 'POST /request (Olas mech-server)',
      stats: 'GET /stats'
    },
    links: {
      website: 'https://memora.codes',
      docs: 'https://github.com/khusna-memora/memora',
      erc8004: 'https://eips.ethereum.org/EIPS/eip-8004'
    }
  });
});

module.exports = router;
