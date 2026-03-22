require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const healthRoutes = require('./routes/health');
const weaveRoutes = require('./routes/weave');
const mechRoutes = require('./routes/mech');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure log.txt exists (Pearl requirement)
const logPath = path.join(process.cwd(), 'log.txt');
if (!fs.existsSync(logPath)) {
  fs.writeFileSync(logPath, `[${new Date().toISOString()}] Memora agent started\n`);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const entry = `[${new Date().toISOString()}] ${req.method} ${req.path}\n`;
  fs.appendFileSync(logPath, entry);
  next();
});

// Routes
app.use('/', healthRoutes);
app.use('/', weaveRoutes);
app.use('/', mechRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    agent: 'Memora',
    docs: 'GET /'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const startup = `[${new Date().toISOString()}] Memora v1.0.0 running on port ${PORT} — memora.codes\n`;
  fs.appendFileSync(logPath, startup);
  console.log(`🧠 Memora — One memory. All your agents. Forever on-chain.`);
  console.log(`🚀 Running on port ${PORT}`);
  console.log(`🔗 ERC-8004 | Pearl-native | Olas Mech Marketplace`);
});

module.exports = app;
