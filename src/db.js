const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'memora.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    tags TEXT DEFAULT '[]',
    tx_hash TEXT,
    chain TEXT DEFAULT 'base',
    block_number INTEGER,
    attestation TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agent_id ON memories(agent_id);
  CREATE INDEX IF NOT EXISTS idx_category ON memories(category);
  CREATE INDEX IF NOT EXISTS idx_created_at ON memories(created_at);

  CREATE TABLE IF NOT EXISTS weave_requests (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    tool TEXT NOT NULL,
    input TEXT NOT NULL,
    output TEXT,
    status TEXT DEFAULT 'pending',
    chain TEXT,
    sender TEXT,
    fee TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

// Initialize stats
const initStat = db.prepare(`INSERT OR IGNORE INTO stats (key, value, updated_at) VALUES (?, ?, ?)`);
initStat.run('total_weaves', '0', Date.now());
initStat.run('total_recalls', '0', Date.now());
initStat.run('total_mech_requests', '0', Date.now());

module.exports = db;
