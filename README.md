# 🧠 Memora — Memory Weaver for Pearl

> **One memory. All your agents. Forever on-chain.**

Memora is the first inter-agent shared memory layer for Pearl and the Olas Mech Marketplace. It enables AI agents to weave, store, and recall verifiable memories with on-chain attestation via ERC-8004.

[![ERC-8004](https://img.shields.io/badge/ERC--8004-verified-blue)](https://eips.ethereum.org/EIPS/eip-8004)
[![Pearl](https://img.shields.io/badge/Pearl-native-green)](https://olas.network/pearl)
[![Olas Marketplace](https://img.shields.io/badge/Olas-Marketplace-purple)](https://olas.network/mech-marketplace)

---

## 🎯 What Problem Does Memora Solve?

Today, every AI agent in Pearl starts from zero — no shared context, no persistent memory, no verifiable history. When Agent A learns something important, Agent B has no way to access it. When a session ends, memories vanish.

**Memora fixes this.**

It provides a universal memory layer that any Pearl agent can:
- **Weave** — store a memory with on-chain attestation
- **Recall** — retrieve memories with cryptographic proof
- **Forget** — delete memories (privacy-first policy)
- **Search** — find relevant memories across agents

Every memory is stored with ERC-8004-compliant attestation metadata, ensuring verifiability and trust.

---

## 🏗️ Architecture

```
Pearl Agent A  ──┐
Pearl Agent B  ──┤──► Memora API ──► SQLite (local) ──► ERC-8004 proof
Olas Mech Client─┘         │
                           └──► log.txt (Pearl requirement)
```

**Stack:**
- Node.js + Express
- SQLite (via better-sqlite3)
- ERC-8004 attestation metadata
- Olas mech-server compatible HTTP endpoint
- Railway deployment

---

## 🚀 API Endpoints

### `GET /healthcheck`
Pearl-required health check. Returns agent status, memory stats, and version.

### `POST /weave`
Store a memory with optional on-chain attestation.

```json
{
  "agent_id": "my-agent-001",
  "content": "User prefers dark mode and speaks English",
  "category": "preferences",
  "tags": ["ui", "language"],
  "tx_hash": "0x..." 
}
```

### `GET /recall`
Retrieve memories for an agent.

```
GET /recall?agent_id=my-agent-001&category=preferences&limit=10
```

### `DELETE /forget/:id`
Permanently erase a memory (privacy policy).

### `POST /request`
**Olas Mech Marketplace compatible endpoint.** Supports:
- `memory_weave` — store a memory
- `memory_recall` — retrieve memories
- `memory_search` — search across all agents
- `memory_forget` — erase a memory
- `memory_stats` — get network statistics

```json
{
  "tool": "memory_recall",
  "prompt": "{\"agent_id\": \"my-agent\", \"category\": \"preferences\"}",
  "sender": "0xAgentAddress",
  "chain": "gnosis"
}
```

### `GET /tools`
Lists all available mech tools (Olas marketplace discovery).

### `GET /stats`
Public statistics for the Memora network.

---

## 🔗 Tracks

Built for [The Synthesis Hackathon](https://synthesis.devfolio.co):
- 🥇 **Build an Agent for Pearl** (Olas) — $1,000
- 💰 **Monetize Your Agent on Olas Marketplace** (Olas) — $500
- 🌐 **Synthesis Open Track** — Community pool

---

## 🛠️ Local Setup

```bash
# Install dependencies
npm install

# Copy env
cp .env.example .env

# Start
npm start
```

---

## 🚢 Deploy on Railway

```bash
railway login
railway init
railway up
```

---

## 🔐 ERC-8004 Compliance

Every memory stored through Memora includes attestation metadata:
```json
{
  "weaver": "Memora v1.0.0",
  "agent_id": "...",
  "timestamp": "...",
  "tx_hash": "...",
  "chain": "base",
  "erc8004_compliant": true
}
```

---

## 📜 License

MIT — Open source for the Olas ecosystem.

---

*Memora — memora.codes — ERC-8004 verified*
