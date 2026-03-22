const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

const STORE_PATH = process.env.CONNECTION_CONFIGS_CONFIG_STORE_PATH || path.join(process.cwd(), 'data');

// Pearl-required: GET /healthcheck at port 8716
router.get('/healthcheck', (req, res) => {
  try {
    const memCount = db.prepare('SELECT COUNT(*) as count FROM memories').get();
    const mechCount = db.prepare("SELECT COUNT(*) as count FROM weave_requests WHERE status = 'completed'").get();

    // Check hire_requests table exists
    let hireCount = { count: 0 };
    try {
      hireCount = db.prepare("SELECT COUNT(*) as count FROM hire_requests WHERE status = 'completed'").get();
    } catch {}

    const isHealthy = true;

    global.agentLog?.('INFO', `Healthcheck OK — memories: ${memCount.count}, mech_served: ${mechCount.count}`);

    // Pearl-required healthcheck response format
    res.json({
      is_healthy: isHealthy,
      version: '1.0.0',
      agent: 'Memora',
      description: 'The first Pearl inter-agent memory layer in the Olas ecosystem.',
      website: 'https://memora.codes',
      chain: 'base',
      rounds: {
        current: 'MemoryWeavingRound',
        previous: 'MechHireRound'
      },
      seconds_since_last_transition: Math.floor(process.uptime()),
      is_transitioning_fast: false,
      stats: {
        total_memories: memCount.count,
        mech_requests_served: mechCount.count,
        mech_hired: hireCount.count
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ is_healthy: false, error: err.message });
  }
});

// Pearl-required: GET /funds-status
router.get('/funds-status', (req, res) => {
  // Return {} when no funds are needed (Memora is stateless re: funds)
  // If BASE_AGENT_EOA and BASE_AGENT_SAFE are set, report minimal requirements
  const eoa = process.env.AGENT_EOA_ADDRESS;
  const safe = process.env.CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES;

  if (!eoa) return res.json({});

  // Minimal ETH requirement for Base chain transactions
  res.json({
    base: {
      ...(eoa && {
        [eoa]: {
          '0x0000000000000000000000000000000000000000': {
            balance: '0',
            deficit: '0',
            decimals: '18'
          }
        }
      })
    }
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Memora',
    tagline: 'One memory. All your agents. Forever on-chain.',
    description: 'The first Pearl inter-agent memory layer in the Olas ecosystem.',
    version: '1.0.0',
    chain: 'base',
    endpoints: {
      healthcheck: 'GET /healthcheck',
      funds_status: 'GET /funds-status',
      weave: 'POST /weave',
      recall: 'GET /recall',
      forget: 'DELETE /forget/:id',
      hire: 'POST /hire',
      request: 'POST /request (Olas mech-server)',
      tools: 'GET /tools',
      stats: 'GET /stats'
    },
    links: {
      website: 'https://memora.codes',
      github: 'https://github.com/khusna-memora/memora',
      erc8004: 'https://eips.ethereum.org/EIPS/eip-8004',
      olas_marketplace: 'https://marketplace.olas.network'
    }
  });
});

module.exports = router;
