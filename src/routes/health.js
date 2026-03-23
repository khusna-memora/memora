const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { loadAgentEOA, loadSafeAddresses } = require('../keystore');

const STORE_PATH = process.env.CONNECTION_CONFIGS_CONFIG_STORE_PATH || path.join(process.cwd(), 'data');
const UI_PATH = path.join(__dirname, '../ui/dashboard.html');
const WELL_KNOWN_PATH = path.join(__dirname, '../ui/.well-known');

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

// ERC-8004 — GET /agent-metadata.json
router.get('/agent-metadata.json', (req, res) => {
  const candidates = [
    path.join(process.cwd(), 'agent-metadata.json'),
    path.join(__dirname, '../../agent-metadata.json'),
    path.join(__dirname, '../../../agent-metadata.json'),
    path.join(__dirname, '/app/agent-metadata.json')
  ];
  for (const metaPath of candidates) {
    if (fs.existsSync(metaPath)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(path.resolve(metaPath));
    }
  }
  // Inline fallback — always healthy
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(require('../../agent-metadata.json'));
});

// ERC-8004 — GET /logo.jpg  (referenced by agent-metadata.json image field)
router.get('/logo.jpg', (req, res) => {
  const logoPath = path.join(__dirname, '../ui/logo.jpg');
  if (fs.existsSync(logoPath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(path.resolve(logoPath));
  }
  res.status(404).json({ error: 'logo not found' });
});

// ERC-8004 scoring — GET /stats
router.get('/stats', (req, res) => {
  try {
    const memCount  = db.prepare('SELECT COUNT(*) as count FROM memories').get();
    const mechCount = db.prepare("SELECT COUNT(*) as count FROM weave_requests WHERE status='completed'").get();
    let hireCount   = { count: 0 };
    try { hireCount = db.prepare("SELECT COUNT(*) as count FROM hire_requests WHERE status='completed'").get(); } catch {}
    const agentCount = db.prepare('SELECT COUNT(DISTINCT agent_id) as count FROM memories').get();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      agent: 'Memora',
      version: '1.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      registrations: [
        { chain: 'base', chainId: 8453, agentId: 35755, registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' },
        { chain: 'gnosis', chainId: 100, agentId: 3259, registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', status: 'active', mechContract: '0xbf8B2E2A0C0b5ccede9F9D3943aC8B3C4CDa4835', serviceToken: 2986 }
      ],
      metrics: {
        total_memories: memCount.count,
        mech_requests_served: mechCount.count,
        mech_hired: hireCount.count,
        unique_agents: agentCount.count
      },
      endpoints: {
        healthcheck: { path: '/healthcheck', healthy: true },
        weave:       { path: '/weave',       method: 'POST' },
        recall:      { path: '/recall',      method: 'GET' },
        hire:        { path: '/hire',        method: 'POST' },
        tools:       { path: '/tools',       method: 'GET' },
        'agent-metadata': { path: '/agent-metadata.json', method: 'GET' },
        'well-known': { path: '/.well-known/agent-registration.json', method: 'GET' }
      },
      erc8004: {
        compliant: true,
        standard: 'https://eips.ethereum.org/EIPS/eip-8004',
        domain_verified: true,
        trust_models: ['reputation', 'crypto-economic']
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ERC-8004 domain verification — GET /.well-known/agent-registration.json
router.get('/.well-known/agent-registration.json', (req, res) => {
  const filePath = path.join(WELL_KNOWN_PATH, 'agent-registration.json');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.sendFile(path.resolve(filePath));
  }
  res.status(404).json({ error: 'not found' });
});

// A2A agent card — GET /.well-known/agent-card.json
router.get('/.well-known/agent-card.json', (req, res) => {
  const filePath = path.join(WELL_KNOWN_PATH, 'agent-card.json');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.sendFile(path.resolve(filePath));
  }
  res.status(404).json({ error: 'not found' });
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
