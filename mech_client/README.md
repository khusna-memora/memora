# Memora — Mech Client (Olas Marketplace)

Memora integrates `mech-client` to hire AI agents on the [Olas Mech Marketplace](https://marketplace.olas.network).

## Architecture

```
Memora Node.js (:8716)
   POST /hire
      │
      ▼ subprocess
   Python mech_bridge.py
      │
      ▼ on-chain tx (Base)
   mechx request → Olas Mech Marketplace
      │
      ▼ response via IPFS
   Result → stored as enriched memory
```

## Setup (Base chain)

```bash
# 1. Install mech-client
pip install mech-client

# 2. Create EOA key file
echo "YOUR_PRIVATE_KEY" > ethereum_private_key.txt

# 3. Setup agent mode on Base
mechx setup --chain-config base

# 4. Fund your agent Safe with ETH on Base
#    (check address printed by setup)

# 5. List available mechs
mechx mech list --chain-config base
```

## Qualification: 10+ on-chain requests

```bash
# Run automated hiring script
python3 mech_client/hire_batch.py --chain base --count 10
```

## Manual test

```bash
mechx request \
  --prompts "Estimate the chance that AI agents will have shared memory by 2027" \
  --priority-mech 0x77af31De935740567cf4fF1986D04B2c964A786a \
  --tools prediction-online \
  --chain-config base
```
