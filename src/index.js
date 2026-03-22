require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const healthRoutes = require('./routes/health');
const weaveRoutes = require('./routes/weave');
const mechRoutes = require('./routes/mech');
const hireRoutes = require('./routes/hire');

const app = express();

// Pearl uses port 8716; Railway/deploy uses PORT env
const PORT = process.env.PORT || 8716;
const LOG_PATH = path.join(process.cwd(), 'log.txt');
const STORE_PATH = process.env.CONNECTION_CONFIGS_CONFIG_STORE_PATH || path.join(process.cwd(), 'data');

// Ensure log.txt and data dir exist
if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, '');
if (!fs.existsSync(STORE_PATH)) fs.mkdirSync(STORE_PATH, { recursive: true });

// Pearl-compliant log helper
function agentLog(level, msg) {
  const now = new Date();
  const ts = now.toISOString().replace('T', ' ').replace('Z', '').replace(/(\.\d{3})\d*/, '$1').replace('.', ',');
  const line = `[${ts}] [${level}] [agent] ${msg}\n`;
  fs.appendFileSync(LOG_PATH, line);
  if (level === 'ERROR') console.error(line.trim());
  else console.log(line.trim());
}
global.agentLog = agentLog;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  agentLog('INFO', `${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/', healthRoutes);
app.use('/', weaveRoutes);
app.use('/', mechRoutes);
app.use('/', hireRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', agent: 'Memora', docs: 'GET /' });
});

// Error handler
app.use((err, req, res, next) => {
  agentLog('ERROR', err.message);
  res.status(500).json({ error: err.message });
});

// Write initial performance file (Pearl requirement)
function writePerformance() {
  const perfPath = path.join(STORE_PATH, 'agent_performance.json');
  const db = require('./db');
  
  const memCount = db.prepare('SELECT COUNT(*) as count FROM memories').get();
  const mechCount = db.prepare("SELECT COUNT(*) as count FROM weave_requests WHERE status = 'completed'").get();
  const agentCount = db.prepare('SELECT COUNT(DISTINCT agent_id) as count FROM memories').get();
  const hireCount = db.prepare("SELECT COUNT(*) as count FROM hire_requests WHERE status = 'completed'").get() || { count: 0 };

  const perf = {
    timestamp: Math.floor(Date.now() / 1000),
    metrics: [
      {
        name: 'Memories Woven',
        is_primary: true,
        description: 'Total verifiable memories stored across all agents with ERC-8004 attestation.',
        value: `${memCount.count}`
      },
      {
        name: 'Mechs Hired',
        is_primary: false,
        description: 'Total mech-client requests made to Olas Marketplace agents (summarizer, predictor, vectorizer).',
        value: `${hireCount.count}`
      }
    ],
    agent_behavior: `Weaving memories for ${agentCount.count} agents, served ${mechCount.count} mech requests.`,
    last_activity: new Date().toISOString(),
    last_chat_message: null
  };

  fs.writeFileSync(perfPath, JSON.stringify(perf, null, 2));
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  agentLog('INFO', `Memora v1.0.0 started on port ${PORT}`);
  agentLog('INFO', 'One memory. All your agents. Forever on-chain.');
  agentLog('INFO', `Chain: Base | ERC-8004 | Pearl-native | Olas Mech Marketplace`);
  
  writePerformance();
  // Update performance every 60s
  setInterval(writePerformance, 60000);
  
  console.log(`🧠 Memora — One memory. All your agents. Forever on-chain.`);
  console.log(`🚀 Running on port ${PORT}`);
});

module.exports = app;
