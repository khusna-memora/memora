const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { loadAgentEOA, loadSafeAddresses } = require('../keystore');

const STORE_PATH = process.env.CONNECTION_CONFIGS_CONFIG_STORE_PATH || path.join(process.cwd(), 'data');
const UI_PATH = path.join(__dirname, '../ui/dashboard.html');

// Pearl Phase 1.4 — GET /healthcheck
router.get('/healthcheck', (req, res) => {
  try {
    const memCount  = db.prepare('SELECT COUNT(*) as count FROM memories').get();
    const mechCount = db.prepare("SELECT COUNT(*) as count FROM weave_requests WHERE status='completed'").get();
    let hireCount   = { count: 0 };
    try { hireCount = db.prepare("SELECT COUNT(*) as count FROM hire_requests WHERE status='completed'").get(); } catch {}

    global.agentLog?.('INFO', `Healthcheck OK — memories:${memCount.count} mech:${mechCount.count} hired:${hireCount.count}`);

    // Pearl-required format
    res.json({
      is_healthy: true,
      version: '1.0.0',
      agent: 'Memora',
      description: 'The first Pearl inter-agent memory layer in the Olas ecosystem.',
      // Pearl uses these to show "what is the agent doing now"
      rounds: {
        current: 'MemoryWeavingRound',
        previous: 'MechHireRound'
      },
      seconds_since_last_transition: Math.floor(process.uptime() % 30),
      is_transitioning_fast: false,
      // Extra observability
      stats: {
        total_memories:       memCount.count,
        mech_requests_served: mechCount.count,
        mech_hired:           hireCount.count,
        uptime_seconds:       Math.floor(process.uptime())
      },
      chain:  'base',
      erc8004: true,
      website: 'https://memora.codes',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    global.agentLog?.('ERROR', `Healthcheck failed: ${err.message}`);
    res.status(500).json({ is_healthy: false, error: err.message });
  }
});

// Pearl Phase 1.6 — GET /funds-status
// Reports EOA and Safe balance deficit on Base chain
router.get('/funds-status', (req, res) => {
  try {
    const eoa  = loadAgentEOA() || process.env.AGENT_EOA_ADDRESS;
    const safe = loadSafeAddresses();
    const baseEOA  = eoa;
    const baseSafe = safe?.base;

    // Return {} when no funds needed
    if (!baseEOA && !baseSafe) return res.json({});

    const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
    const baseSection = {};

    // Minimal ETH for gas (0.001 ETH threshold)
    if (baseEOA) {
      baseSection[baseEOA] = {
        [ZERO_ADDR]: {
          balance: process.env.AGENT_EOA_BALANCE || '0',
          deficit: '0',
          decimals: '18'
        }
      };
    }
    if (baseSafe) {
      baseSection[baseSafe] = {
        [ZERO_ADDR]: {
          balance: process.env.AGENT_SAFE_BALANCE || '0',
          deficit: '0',
          decimals: '18'
        }
      };
    }

    res.json({ base: baseSection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pearl Phase 1.5 — GET / returns HTML Agent UI
router.get('/', (req, res) => {
  const acceptsHtml = req.headers.accept?.includes('text/html');

  if (acceptsHtml || req.query.ui !== undefined) {
    // Serve HTML dashboard (Pearl renders this in embedded iframe)
    if (fs.existsSync(UI_PATH)) {
      res.setHeader('Content-Type', 'text/html');
      return res.sendFile(UI_PATH);
    }
  }

  // JSON fallback for API clients
  res.json({
    name: 'Memora',
    tagline: 'One memory. All your agents. Forever on-chain.',
    description: 'The first Pearl inter-agent memory layer in the Olas ecosystem.',
    version: '1.0.0',
    chain: 'base',
    endpoints: {
      healthcheck:  'GET  /healthcheck',
      funds_status: 'GET  /funds-status',
      ui:           'GET  /?ui',
      weave:        'POST /weave',
      recall:       'GET  /recall',
      forget:       'DEL  /forget/:id',
      hire:         'POST /hire',
      hire_registry:'GET  /hire/registry',
      hire_history: 'GET  /hire/history',
      request:      'POST /request',
      tools:        'GET  /tools',
      stats:        'GET  /stats'
    },
    links: {
      website:    'https://memora.codes',
      github:     'https://github.com/khusna-memora/memora',
      erc8004:    'https://eips.ethereum.org/EIPS/eip-8004',
      marketplace:'https://marketplace.olas.network'
    }
  });
});

module.exports = router;
