# Memora — Mech Server (Olas Marketplace)

This directory contains Memora's **mech-server** integration for the [Olas Mech Marketplace](https://marketplace.olas.network).

## Architecture

```
Olas Mech Marketplace (Base chain)
         │
         ▼ on-chain request event
  mech-server (Python)          ← pip install mech-server
         │
         ▼ HTTP call
  Memora API (Node.js :8716)    ← npm start
         │
         ▼
  SQLite + ERC-8004 attestation
```

## Tools

| Tool | Description |
|---|---|
| `memory_weave` | Store a verifiable memory for an agent |
| `memory_recall` | Retrieve memories by agent_id, category, or query |
| `memory_search` | Cross-agent memory search |

## Quick Setup (Base chain)

```bash
# Prerequisites
pip install mech-server

# One-time setup (deploys mech on-chain, requires funded EOA)
chmod +x mech_server/setup_mech.sh
MEMORA_DEPLOYED_URL=https://your-memora.up.railway.app \
  ./mech_server/setup_mech.sh base

# Run Memora + Mech together
npm start &                  # Memora API at :8716
mech run -c base             # Mech listener on Base
```

## Test a request

```bash
# Get your mech address
ADDR=$(grep MECH_TO_CONFIG ~/.operate-mech/.env.base | ...)

# Send memory_weave request
mechx request \
  --prompts '{"agent_id":"test-agent","content":"Test memory from Olas marketplace"}' \
  --priority-mech $ADDR \
  --tools memory_weave \
  --chain-config base
```

## Qualification (50+ requests)

To qualify for the **Monetize Your Agent on Olas Marketplace** track:
1. Deploy mech: `./mech_server/setup_mech.sh base`
2. Run: `mech run -c base`
3. Check on [marketplace.olas.network](https://marketplace.olas.network) — your server agent must appear
4. Serve 50+ requests on Base chain

## Environment

```env
MEMORA_API_URL=http://localhost:8716  # or deployed URL
```

Add to `~/.operate-mech/.env.base` automatically by setup script.
