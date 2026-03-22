# 🧠 Memora — The first Pearl inter-agent memory layer in the Olas ecosystem

> **One memory. All your agents. Forever on-chain.**

[![ERC-8004](https://img.shields.io/badge/ERC--8004-verified-blue)](https://eips.ethereum.org/EIPS/eip-8004)
[![Pearl](https://img.shields.io/badge/Pearl-native-green)](https://olas.network/pearl)
[![Chain](https://img.shields.io/badge/chain-Base-blue)](https://base.org)
[![Olas Marketplace](https://img.shields.io/badge/Olas-Marketplace-purple)](https://marketplace.olas.network)
[![License](https://img.shields.io/badge/license-MIT-gray)](LICENSE)

---

## What is Memora?

Memora is the first inter-agent shared memory layer for Pearl and the Olas Mech Marketplace. Any Pearl agent can weave, store, recall, and forget verifiable memories — with on-chain attestation via ERC-8004 on Base.

---

## Five Core Principles

1. **Memory is sacred** — every piece of knowledge must be verifiable (on-chain attestation + ERC-8004).
2. **Privacy first** — user can always choose "forget after X days" or private mode.
3. **Collaborative by design** — actively hires other mechs (summarizer, predictor, vectorizer) via mech-client to improve weaving quality.
4. **Pearl-native** — lives inside the desktop experience, feels instant, works offline-first when possible.
5. **Scalable & open** — built for thousands of agents, multiple chains, and future Pearl updates.

---

## Architecture

```
Pearl Agent A  ──┐
Pearl Agent B  ──┤──► Memora API (port 8716) ──► SQLite (WAL) ──► ERC-8004 proof
Olas Mech Client─┘         │
                           ├──► /hire ──► Olas Marketplace Mechs
                           │        (summarizer / predictor / vectorizer)
                           └──► log.txt + agent_performance.json (Pearl)
```

**Stack:** Node.js · Express · SQLite (better-sqlite3) · ERC-8004 attestation · Olas mech-client · Base chain

---

## Pearl-Compliant Endpoints (port 8716)

| Endpoint | Method | Description |
|---|---|---|
| `/healthcheck` | GET | Pearl health check — `is_healthy`, rounds, stats |
| `/funds-status` | GET | Pearl funding status for EOA/Safe |
| `/` | GET | Agent info + all endpoints |

## Memory API

| Endpoint | Method | Description |
|---|---|---|
| `/weave` | POST | Store a memory with ERC-8004 attestation |
| `/recall` | GET | Retrieve memories (filter by agent, category, query) |
| `/forget/:id` | DELETE | Privacy-first memory erasure |
| `/stats` | GET | Network-wide memory statistics |

## Olas Marketplace (Hire & Serve)

| Endpoint | Method | Description |
|---|---|---|
| `/hire` | POST | **Hire a mech** — summon summarizer, predictor, vectorizer |
| `/hire/registry` | GET | Browse available mechs on Base chain |
| `/hire/history` | GET | Past hire requests |
| `/request` | POST | **Serve as a mech** — memory_weave, memory_recall, memory_search |
| `/tools` | GET | List all mech tools (marketplace discovery) |

---

## Quick Start

```bash
# Install
npm install

# Copy env
cp .env.example .env

# Start (Pearl port 8716)
npm start
```

### Hire a mech to enhance memory quality

```bash
# Summarize before storing
curl -X POST http://localhost:8716/hire \
  -H "Content-Type: application/json" \
  -d '{"tool": "text-summarizer", "prompt": "Long article about DeFi...", "chain": "base"}'

# Weave the result as a memory
curl -X POST http://localhost:8716/weave \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "my-agent", "content": "[Summary]...", "category": "defi"}'
```

### Serve memory as a mech (Olas Marketplace)

```bash
curl -X POST http://localhost:8716/request \
  -H "Content-Type: application/json" \
  -d '{"tool": "memory_recall", "prompt": "{\"agent_id\": \"my-agent\"}", "sender": "0x...", "chain": "base"}'
```

---

## Environment Variables

```env
PORT=8716
DB_PATH=./data/memora.db
CONNECTION_CONFIGS_CONFIG_STORE_PATH=./data
CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES={"base":"0x..."}
AGENT_EOA_ADDRESS=0x...
BASE_LEDGER_RPC=https://mainnet.base.org
```

---

## Pearl Integration Compliance

- [x] `GET /healthcheck` on port 8716 — returns `is_healthy`, `rounds`, `seconds_since_last_transition`
- [x] `GET /funds-status` — reports EOA/Safe balances on Base
- [x] `log.txt` — Pearl-format `[YYYY-MM-DD HH:MM:SS,mmm] [LEVEL] [agent] message`
- [x] `agent_performance.json` — written to `STORE_PATH`, updated every 60s
- [x] Reads `CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES` env var
- [x] Reads `CONNECTION_CONFIGS_CONFIG_STORE_PATH` env var
- [x] Graceful startup/recovery

---

## Hackathon Tracks (Synthesis)

| Track | Sponsor | Prize |
|---|---|---|
| Build an Agent for Pearl | Olas | $1,000 |
| Hire an Agent on Olas Marketplace | Olas | $500 |
| Synthesis Open Track | Community | pool |

---

## License

MIT — Open source for the Olas ecosystem.

---

*Memora — memora.codes — ERC-8004 verified on Base*
