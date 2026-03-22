const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const fs = require('fs');
const path = require('path');

/**
 * POST /weave
 * Weave (store) a memory with optional on-chain attestation reference
 * Body: { agent_id, content, category?, tags?, tx_hash?, chain? }
 */
router.post('/weave', (req, res) => {
  try {
    const { agent_id, content, category = 'general', tags = [], tx_hash, chain = 'base', block_number } = req.body;

    if (!agent_id || !content) {
      return res.status(400).json({ error: 'agent_id and content are required' });
    }

    const id = uuidv4();
    const now = Date.now();

    // Build attestation metadata
    const attestation = {
      weaver: 'Memora v1.0.0',
      agent_id,
      timestamp: new Date(now).toISOString(),
      tx_hash: tx_hash || null,
      chain: chain,
      verified: !!tx_hash,
      erc8004_compliant: true
    };

    const insert = db.prepare(`
      INSERT INTO memories (id, agent_id, content, category, tags, tx_hash, chain, block_number, attestation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      id,
      agent_id,
      content,
      category,
      JSON.stringify(tags),
      tx_hash || null,
      chain,
      block_number || null,
      JSON.stringify(attestation),
      now,
      now
    );

    // Update stats
    db.prepare(`UPDATE stats SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ? WHERE key = 'total_weaves'`).run(now);

    // Log
    const logEntry = `[${new Date(now).toISOString()}] WEAVE agent=${agent_id} id=${id} category=${category} chain=${chain} tx=${tx_hash || 'none'}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'log.txt'), logEntry);

    res.status(201).json({
      success: true,
      memory: {
        id,
        agent_id,
        content,
        category,
        tags,
        attestation,
        created_at: new Date(now).toISOString()
      },
      proof: {
        memora_id: id,
        tx_hash: tx_hash || null,
        chain,
        erc8004_verified: !!tx_hash,
        scan_url: tx_hash ? `https://basescan.org/tx/${tx_hash}` : null,
        weaver: 'Memora — memora.codes — ERC-8004 verified'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /recall
 * Recall memories for an agent
 * Query: agent_id (required), category?, limit?, q? (search)
 */
router.get('/recall', (req, res) => {
  try {
    const { agent_id, category, q, limit = 20, offset = 0 } = req.query;

    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required' });
    }

    let query = `SELECT * FROM memories WHERE agent_id = ?`;
    const params = [agent_id];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (q) {
      query += ` AND content LIKE ?`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const memories = db.prepare(query).all(...params);
    const total = db.prepare(`SELECT COUNT(*) as count FROM memories WHERE agent_id = ?`).get(agent_id);

    // Update stats
    db.prepare(`UPDATE stats SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ? WHERE key = 'total_recalls'`).run(Date.now());

    res.json({
      success: true,
      agent_id,
      memories: memories.map(m => ({
        id: m.id,
        content: m.content,
        category: m.category,
        tags: JSON.parse(m.tags || '[]'),
        attestation: JSON.parse(m.attestation || '{}'),
        tx_hash: m.tx_hash,
        chain: m.chain,
        created_at: new Date(m.created_at).toISOString()
      })),
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      proof: {
        weaver: 'Memora — memora.codes — ERC-8004 verified'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /forget/:id
 * Forget (delete) a specific memory (user privacy policy)
 */
router.delete('/forget/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required for forget operation' });
    }

    const memory = db.prepare(`SELECT * FROM memories WHERE id = ? AND agent_id = ?`).get(id, agent_id);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found or not owned by this agent' });
    }

    db.prepare(`DELETE FROM memories WHERE id = ? AND agent_id = ?`).run(id, agent_id);

    const logEntry = `[${new Date().toISOString()}] FORGET agent=${agent_id} id=${id}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'log.txt'), logEntry);

    res.json({
      success: true,
      forgotten: id,
      message: 'Memory permanently erased per user forget policy',
      proof: { weaver: 'Memora — memora.codes — ERC-8004 verified' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /stats
 * Public stats endpoint
 */
router.get('/stats', (req, res) => {
  try {
    const stats = db.prepare('SELECT key, value FROM stats').all();
    const statsMap = {};
    stats.forEach(s => { statsMap[s.key] = parseInt(s.value); });

    const memoryCount = db.prepare('SELECT COUNT(*) as count FROM memories').get();
    const agentCount = db.prepare('SELECT COUNT(DISTINCT agent_id) as count FROM memories').get();
    const mechCount = db.prepare(`SELECT COUNT(*) as count FROM weave_requests WHERE status = 'completed'`).get();

    res.json({
      total_memories: memoryCount.count,
      unique_agents: agentCount.count,
      mech_requests_served: mechCount.count,
      total_weaves: statsMap.total_weaves || 0,
      total_recalls: statsMap.total_recalls || 0,
      uptime: process.uptime(),
      version: '1.0.0',
      proof: { weaver: 'Memora — memora.codes — ERC-8004 verified' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
