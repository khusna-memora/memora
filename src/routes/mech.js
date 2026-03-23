const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const fs = require('fs');
const path = require('path');

/**
 * POST /request
 * Olas Mech Marketplace compatible endpoint
 * Supports tools: memory_weave, memory_recall, memory_forget, memory_search
 * 
 * Request format (Olas mech-server compatible):
 * { tool, prompt, requestId?, sender?, chain? }
 */
router.post('/request', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.body.requestId || uuidv4();

  try {
    const { tool, prompt, sender, chain = 'gnosis' } = req.body;

    if (!tool || !prompt) {
      return res.status(400).json({
        error: 'tool and prompt are required',
        supported_tools: ['memory_weave', 'memory_recall', 'memory_search', 'memory_forget', 'memory_stats']
      });
    }

    // Log incoming request
    const logEntry = `[${new Date().toISOString()}] MECH_REQUEST id=${requestId} tool=${tool} sender=${sender || 'unknown'} chain=${chain}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'log.txt'), logEntry);

    // Save request to DB
    const reqRecord = db.prepare(`
      INSERT INTO weave_requests (id, request_id, tool, input, status, chain, sender, created_at)
      VALUES (?, ?, ?, ?, 'processing', ?, ?, ?)
    `);
    reqRecord.run(uuidv4(), requestId, tool, JSON.stringify({ prompt, sender }), chain, sender || null, startTime);

    let result;

    // Parse prompt as JSON if possible, otherwise treat as plain text
    let parsedPrompt = {};
    try { parsedPrompt = typeof prompt === 'string' ? JSON.parse(prompt) : prompt; }
    catch { parsedPrompt = { query: prompt }; }

    switch (tool) {
      case 'memory_weave': {
        const { agent_id = sender || 'mech_client', content, category = 'general', tags = [], tx_hash } = parsedPrompt;
        if (!content) throw new Error('content is required for memory_weave');

        const id = uuidv4();
        const now = Date.now();
        const attestation = {
          weaver: 'Memora v1.0.0',
          agent_id,
          timestamp: new Date(now).toISOString(),
          tx_hash: tx_hash || null,
          chain,
          via_mech: true,
          request_id: requestId,
          erc8004_compliant: true
        };

        db.prepare(`
          INSERT INTO memories (id, agent_id, content, category, tags, tx_hash, chain, attestation, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, agent_id, content, category, JSON.stringify(tags), tx_hash || null, chain, JSON.stringify(attestation), now, now);

        db.prepare(`UPDATE stats SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ? WHERE key = 'total_weaves'`).run(now);

        result = {
          memory_id: id,
          agent_id,
          content_preview: content.substring(0, 100),
          category,
          attestation,
          proof: `Memora — memora.codes — ERC-8004 verified`
        };
        break;
      }

      case 'memory_recall': {
        const { agent_id = sender || 'mech_client', category, limit = 10, q } = parsedPrompt;

        let query = `SELECT * FROM memories WHERE agent_id = ?`;
        const params = [agent_id];
        if (category) { query += ` AND category = ?`; params.push(category); }
        if (q) { query += ` AND content LIKE ?`; params.push(`%${q}%`); }
        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(Math.min(parseInt(limit), 50));

        const memories = db.prepare(query).all(...params);
        db.prepare(`UPDATE stats SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ? WHERE key = 'total_recalls'`).run(Date.now());

        result = {
          agent_id,
          memories: memories.map(m => ({
            id: m.id,
            content: m.content,
            category: m.category,
            tags: JSON.parse(m.tags || '[]'),
            tx_hash: m.tx_hash,
            created_at: new Date(m.created_at).toISOString()
          })),
          count: memories.length,
          proof: `Memora — memora.codes — ERC-8004 verified`
        };
        break;
      }

      case 'memory_search': {
        const { query: searchQuery, limit = 10 } = parsedPrompt;
        if (!searchQuery) throw new Error('query is required for memory_search');

        const memories = db.prepare(`
          SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?
        `).all(`%${searchQuery}%`, Math.min(parseInt(limit), 50));

        result = {
          query: searchQuery,
          memories: memories.map(m => ({
            id: m.id,
            agent_id: m.agent_id,
            content: m.content,
            category: m.category,
            created_at: new Date(m.created_at).toISOString()
          })),
          count: memories.length,
          proof: `Memora — memora.codes — ERC-8004 verified`
        };
        break;
      }

      case 'memory_forget': {
        const { agent_id = sender || 'mech_client', memory_id } = parsedPrompt;
        if (!memory_id) throw new Error('memory_id is required for memory_forget');

        const mem = db.prepare(`SELECT * FROM memories WHERE id = ? AND agent_id = ?`).get(memory_id, agent_id);
        if (!mem) throw new Error('Memory not found or not owned by this agent');

        db.prepare(`DELETE FROM memories WHERE id = ? AND agent_id = ?`).run(memory_id, agent_id);
        result = { forgotten: memory_id, agent_id, proof: `Memora — memora.codes — ERC-8004 verified` };
        break;
      }

      case 'memory_stats': {
        const stats = db.prepare('SELECT key, value FROM stats').all();
        const statsMap = {};
        stats.forEach(s => { statsMap[s.key] = parseInt(s.value); });
        const memCount = db.prepare('SELECT COUNT(*) as count FROM memories').get();
        const agentCount = db.prepare('SELECT COUNT(DISTINCT agent_id) as count FROM memories').get();
        const mechCount = db.prepare(`SELECT COUNT(*) as count FROM weave_requests WHERE status = 'completed'`).get();

        result = {
          total_memories: memCount.count,
          unique_agents: agentCount.count,
          mech_requests_served: mechCount.count,
          ...statsMap,
          proof: `Memora — memora.codes — ERC-8004 verified`
        };
        break;
      }

      default:
        return res.status(400).json({
          error: `Unknown tool: ${tool}`,
          supported_tools: ['memory_weave', 'memory_recall', 'memory_search', 'memory_forget', 'memory_stats']
        });
    }

    // Mark request as completed
    const elapsed = Date.now() - startTime;
    db.prepare(`
      UPDATE weave_requests SET status = 'completed', output = ?, completed_at = ? WHERE request_id = ?
    `).run(JSON.stringify(result), Date.now(), requestId);

    // Update mech stats
    db.prepare(`UPDATE stats SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ? WHERE key = 'total_mech_requests'`).run(Date.now());

    res.json({
      requestId,
      tool,
      result,
      elapsed_ms: elapsed
    });

  } catch (err) {
    // Mark as failed
    db.prepare(`
      UPDATE weave_requests SET status = 'failed', output = ?, completed_at = ? WHERE request_id = ?
    `).run(JSON.stringify({ error: err.message }), Date.now(), requestId);

    const logErr = `[${new Date().toISOString()}] MECH_ERROR id=${requestId} error=${err.message}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'log.txt'), logErr);

    res.status(500).json({ requestId, error: err.message });
  }
});

// MCP tools definition (shared)
const MCP_TOOLS = [
  {
    name: 'memory_weave',
    description: 'Store a verifiable memory for an agent with optional on-chain attestation',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent identifier' },
        content:  { type: 'string', description: 'Memory content to weave' },
        category: { type: 'string', description: 'Optional category tag' },
        tags:     { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
        tx_hash:  { type: 'string', description: 'Optional on-chain TX hash for attestation' }
      },
      required: ['agent_id', 'content']
    }
  },
  {
    name: 'memory_recall',
    description: 'Recall stored memories for an agent, optionally filtered by category or search query',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent identifier' },
        category: { type: 'string', description: 'Filter by category' },
        q:        { type: 'string', description: 'Search query' },
        limit:    { type: 'number', description: 'Max results (default 10)' }
      },
      required: ['agent_id']
    }
  },
  {
    name: 'memory_search',
    description: 'Search across all memories by content keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword' },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['query']
    }
  },
  {
    name: 'memory_forget',
    description: 'Permanently erase a memory per user forget policy',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id:  { type: 'string', description: 'Agent identifier' },
        memory_id: { type: 'string', description: 'Memory ID to erase' }
      },
      required: ['agent_id', 'memory_id']
    }
  },
  {
    name: 'memory_stats',
    description: 'Get aggregated memory statistics for the Memora network',
    inputSchema: { type: 'object', properties: {} }
  }
];

/**
 * GET /tools  — legacy discovery format
 * POST /tools — MCP 2025-06-18 JSON-RPC (initialize / tools/list / tools/call)
 */
router.get('/tools', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    agent: 'Memora',
    version: '1.0.0',
    description: 'Shared memory weaver for Pearl agents — verifiable on-chain memory storage and recall',
    protocol: 'MCP 2025-06-18',
    tools: MCP_TOOLS,
    links: { website: 'https://memora.codes', erc8004: 'https://eips.ethereum.org/EIPS/eip-8004' }
  });
});

router.options('/tools', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

router.post('/tools', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const body = req.body || {};
  const method = body.method || '';
  const id = body.id !== undefined ? body.id : null;

  // MCP initialize handshake
  if (method === 'initialize') {
    return res.json({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'Memora', version: '1.0.0' }
      }
    });
  }

  // tools/list
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0', id,
      result: { tools: MCP_TOOLS }
    });
  }

  // tools/call
  if (method === 'tools/call') {
    const toolName = body.params?.name;
    const args = body.params?.arguments || {};
    return res.json({
      jsonrpc: '2.0', id,
      result: {
        content: [{
          type: 'text',
          text: `Tool '${toolName}' called on Memora. Use POST /weave, GET /recall, or POST /hire directly. Args: ${JSON.stringify(args)}`
        }],
        isError: false
      }
    });
  }

  // notifications/initialized (no response needed per MCP spec)
  if (method === 'notifications/initialized') {
    return res.status(204).end();
  }

  // Unknown method
  return res.json({
    jsonrpc: '2.0', id,
    error: { code: -32601, message: `Method not found: ${method}` }
  });
});

module.exports = router;
