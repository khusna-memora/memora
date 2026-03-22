const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const https = require('https');
const http = require('http');

// Ensure hire_requests table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS hire_requests (
    id TEXT PRIMARY KEY,
    mech_address TEXT,
    tool TEXT NOT NULL,
    prompt TEXT NOT NULL,
    result TEXT,
    status TEXT DEFAULT 'pending',
    chain TEXT DEFAULT 'base',
    tx_hash TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS mech_registry (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    mech_address TEXT,
    offchain_url TEXT,
    tool TEXT NOT NULL,
    chain TEXT DEFAULT 'base',
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
  );
`);

// Seed known Olas mechs (Base chain)
const knownMechs = [
  {
    name: 'Prediction Mech',
    tool: 'prediction-online',
    mech_address: '0x77af31De935740567cf4fF1986D04B2c964A786a',
    offchain_url: 'https://mech.olas.network',
    description: 'Predicts outcomes based on structured prompts',
    chain: 'base'
  },
  {
    name: 'Summarizer Mech',
    tool: 'text-summarizer',
    mech_address: null,
    offchain_url: null,
    description: 'Summarizes long-form content for memory compression',
    chain: 'base'
  },
  {
    name: 'Vectorizer Mech',
    tool: 'text-vectorizer',
    mech_address: null,
    offchain_url: null,
    description: 'Converts memories to semantic vectors for similarity search',
    chain: 'base'
  }
];

// Seed mech registry if empty
const mechCount = db.prepare('SELECT COUNT(*) as count FROM mech_registry').get();
if (mechCount.count === 0) {
  const insertMech = db.prepare(`
    INSERT INTO mech_registry (id, name, description, mech_address, offchain_url, tool, chain, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  knownMechs.forEach(m => insertMech.run(uuidv4(), m.name, m.description, m.mech_address, m.offchain_url, m.tool, m.chain, Date.now()));
}

/**
 * Helper: call an offchain mech endpoint
 */
function callOffchainMech(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({ result: body }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Mech request timed out')); });
    req.write(data);
    req.end();
  });
}

/**
 * POST /hire
 * Hire an Olas Marketplace mech to enhance memory quality
 * Body: { tool, prompt, agent_id?, chain? }
 *
 * Supported tools:
 * - text-summarizer: summarize content before storing as memory
 * - prediction-online: predict/enhance memory with forecasting
 * - text-vectorizer: vectorize memory for semantic search
 */
router.post('/hire', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const { tool, prompt, agent_id, chain = 'base', mech_address } = req.body;

    if (!tool || !prompt) {
      return res.status(400).json({
        error: 'tool and prompt are required',
        available_tools: ['text-summarizer', 'prediction-online', 'text-vectorizer'],
        hint: 'Hire a mech to enhance your memory weaving quality'
      });
    }

    global.agentLog?.('INFO', `HIRE id=${requestId} tool=${tool} chain=${chain}`);

    // Find mech in registry
    const mech = db.prepare('SELECT * FROM mech_registry WHERE tool = ? AND chain = ? AND is_active = 1').get(tool, chain)
      || db.prepare('SELECT * FROM mech_registry WHERE tool = ? AND is_active = 1').get(tool);

    // Save request
    db.prepare(`
      INSERT INTO hire_requests (id, mech_address, tool, prompt, status, chain, created_at)
      VALUES (?, ?, ?, ?, 'processing', ?, ?)
    `).run(requestId, mech?.mech_address || mech_address || null, tool, prompt, chain, startTime);

    let result;
    let status = 'completed';
    let txHash = null;

    // Try offchain mech if URL available
    if (mech?.offchain_url) {
      try {
        const offchainResult = await callOffchainMech(`${mech.offchain_url}/request`, {
          tool,
          prompt,
          requestId
        });
        result = offchainResult;
        global.agentLog?.('INFO', `HIRE offchain success tool=${tool}`);
      } catch (offchainErr) {
        global.agentLog?.('INFO', `HIRE offchain unavailable, using simulation: ${offchainErr.message}`);
        result = simulateMech(tool, prompt);
      }
    } else {
      // Simulate mech locally for demo (replace with on-chain call in production)
      result = simulateMech(tool, prompt);
    }

    const elapsed = Date.now() - startTime;

    // Update hire record
    db.prepare(`
      UPDATE hire_requests SET status = ?, result = ?, tx_hash = ?, completed_at = ? WHERE id = ?
    `).run(status, JSON.stringify(result), txHash, Date.now(), requestId);

    global.agentLog?.('INFO', `HIRE completed id=${requestId} tool=${tool} elapsed=${elapsed}ms`);

    res.json({
      requestId,
      tool,
      mech: mech ? {
        name: mech.name,
        address: mech.mech_address,
        chain: mech.chain
      } : null,
      result,
      elapsed_ms: elapsed,
      proof: {
        chain,
        tx_hash: txHash,
        weaver: 'Memora — memora.codes — ERC-8004 verified'
      }
    });

  } catch (err) {
    db.prepare(`UPDATE hire_requests SET status = 'failed', result = ?, completed_at = ? WHERE id = ?`)
      .run(JSON.stringify({ error: err.message }), Date.now(), requestId);

    global.agentLog?.('ERROR', `HIRE failed id=${requestId}: ${err.message}`);
    res.status(500).json({ requestId, error: err.message });
  }
});

/**
 * Simulate mech result locally for demo / offline-first mode
 */
function simulateMech(tool, prompt) {
  switch (tool) {
    case 'text-summarizer':
      return {
        tool: 'text-summarizer',
        summary: `[Memora Summary] ${prompt.substring(0, 120)}${prompt.length > 120 ? '...' : ''}`,
        compression_ratio: Math.min(0.9, 120 / Math.max(prompt.length, 1)).toFixed(2),
        mode: 'local-simulation'
      };
    case 'prediction-online':
      return {
        tool: 'prediction-online',
        prediction: `Based on memory context: "${prompt.substring(0, 80)}..." — pattern suggests continuation.`,
        confidence: (0.6 + Math.random() * 0.3).toFixed(2),
        mode: 'local-simulation'
      };
    case 'text-vectorizer':
      // Simple simulated vector (in production, use embedding model)
      const vector = Array.from({ length: 8 }, () => parseFloat((Math.random() * 2 - 1).toFixed(4)));
      return {
        tool: 'text-vectorizer',
        vector,
        dimensions: 8,
        mode: 'local-simulation'
      };
    default:
      return { tool, result: `Processed: ${prompt.substring(0, 100)}`, mode: 'local-simulation' };
  }
}

/**
 * GET /hire/registry
 * List available mechs on Olas Marketplace (Base chain)
 */
router.get('/hire/registry', (req, res) => {
  const mechs = db.prepare('SELECT * FROM mech_registry ORDER BY created_at ASC').all();
  res.json({
    chain: 'base',
    mechs: mechs.map(m => ({
      name: m.name,
      tool: m.tool,
      description: m.description,
      mech_address: m.mech_address,
      offchain_url: m.offchain_url,
      is_active: !!m.is_active
    })),
    marketplace: 'https://marketplace.olas.network',
    hire_endpoint: 'POST /hire'
  });
});

/**
 * GET /hire/history
 * List past hire requests
 */
router.get('/hire/history', (req, res) => {
  const { limit = 20 } = req.query;
  const requests = db.prepare(`
    SELECT * FROM hire_requests ORDER BY created_at DESC LIMIT ?
  `).all(parseInt(limit));

  res.json({
    total: requests.length,
    requests: requests.map(r => ({
      id: r.id,
      tool: r.tool,
      status: r.status,
      chain: r.chain,
      mech_address: r.mech_address,
      created_at: new Date(r.created_at).toISOString(),
      completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : null
    }))
  });
});

module.exports = router;
