#!/bin/bash
# Memora Mech Server Setup
# Registers Memora's memory tools on the Olas Mech Marketplace (Base chain)
# Run once: ./mech_server/setup_mech.sh
# Requires: Python >=3.10, pip install mech-server, funded EOA on Base

set -e

CHAIN="${1:-base}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEMORA_TOOLS_DIR="$SCRIPT_DIR/tools"
MECH_WORKSPACE="$HOME/.operate-mech"

echo "🧠 Memora Mech Server Setup"
echo "Chain: $CHAIN"
echo ""

# Check mech-server installed
if ! command -v mech &> /dev/null; then
  echo "Installing mech-server..."
  pip3 install mech-server --break-system-packages
fi

# Step 1: Setup mech workspace (deploys mech contract on-chain)
echo "=== Step 1: Setup mech workspace ==="
echo "This will deploy your Memora mech on $CHAIN chain."
echo "You need: a funded EOA + Base RPC URL"
echo ""
mech setup -c "$CHAIN"

# Step 2: Copy Memora tools into mech workspace
echo ""
echo "=== Step 2: Installing Memora tools ==="
AUTHOR="khusna_memora"
MECH_TOOLS="$MECH_WORKSPACE/packages/$AUTHOR/customs"
mkdir -p "$MECH_TOOLS"

for tool in memory_weave memory_recall memory_search; do
  echo "  → Installing $tool..."
  cp -r "$MEMORA_TOOLS_DIR/$tool" "$MECH_TOOLS/$tool"
done

# Set Memora API URL in mech env
MECH_ENV="$MECH_WORKSPACE/.env.$CHAIN"
if [ -f "$MECH_ENV" ]; then
  if ! grep -q "MEMORA_API_URL" "$MECH_ENV"; then
    echo "" >> "$MECH_ENV"
    echo "# Memora API (set to your deployed URL or local Pearl port)" >> "$MECH_ENV"
    echo "MEMORA_API_URL=http://localhost:8716" >> "$MECH_ENV"
  fi
fi

# Step 3: Publish metadata to IPFS
echo ""
echo "=== Step 3: Publish metadata ==="
DEPLOYED_URL="${MEMORA_DEPLOYED_URL:-}"
if [ -n "$DEPLOYED_URL" ]; then
  echo "Setting offchain URL: $DEPLOYED_URL"
  mech prepare-metadata -c "$CHAIN" --offchain-url "$DEPLOYED_URL"
else
  mech prepare-metadata -c "$CHAIN"
fi

# Update on-chain metadata
mech update-metadata -c "$CHAIN"

# Step 4: Start the mech
echo ""
echo "=== Step 4: Start Memora Mech ==="
echo "Starting mech on $CHAIN..."
echo "Run 'mech run -c $CHAIN' to start serving requests."
echo ""
echo "✅ Memora Mech setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Start Memora: npm start (in repo root)"
echo "  2. Start Mech:   mech run -c $CHAIN"
echo "  3. Check mech address in: $MECH_ENV"
echo "  4. Add address to submission as deployedURL"
echo "  5. Serve 50+ requests to qualify for Monetize track"
echo ""
echo "  To send a test request:"
echo "    ADDR=\$(grep MECH_TO_CONFIG $MECH_ENV | cut -d= -f2 | python3 -c \"import sys,json; print(list(json.loads(sys.stdin.read()).keys())[0])\" 2>/dev/null)"
echo "    mechx request --prompts '{\"agent_id\":\"test\",\"content\":\"hello from mech\"}' \\"
echo "      --priority-mech \$ADDR --tools memory_weave --chain-config $CHAIN"
