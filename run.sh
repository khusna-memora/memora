#!/bin/bash
# Memora — Pearl ENTRYPOINT script
# Pearl calls this script to start the agent instance.
# Reads: --password arg, ethereum_private_key.txt, env vars

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse --password argument (Pearl passes this for EOA key decryption)
PASSWORD=""
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --password) PASSWORD="$2"; shift ;;
    *) ;;
  esac
  shift
done

# Export Pearl env vars with defaults
export PORT="${PORT:-8716}"
export NODE_ENV="${NODE_ENV:-production}"
export DB_PATH="${DB_PATH:-$SCRIPT_DIR/data/memora.db}"
export CONNECTION_CONFIGS_CONFIG_STORE_PATH="${CONNECTION_CONFIGS_CONFIG_STORE_PATH:-$SCRIPT_DIR/data}"

# Export password for keystore decryption (never log this)
if [ -n "$PASSWORD" ]; then
  export AGENT_KEY_PASSWORD="$PASSWORD"
fi

# Ensure data directory exists
mkdir -p "$CONNECTION_CONFIGS_CONFIG_STORE_PATH"

# Log startup
LOG_FILE="$SCRIPT_DIR/log.txt"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S,000')
echo "[$TIMESTAMP] [INFO] [agent] Memora ENTRYPOINT — starting agent instance" >> "$LOG_FILE"
echo "[$TIMESTAMP] [INFO] [agent] Port: $PORT | Chain: base | Pearl-native" >> "$LOG_FILE"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "[$TIMESTAMP] [ERROR] [agent] Node.js not found. Please install Node.js >= 18" >> "$LOG_FILE"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "[$TIMESTAMP] [INFO] [agent] Installing dependencies..." >> "$LOG_FILE"
  npm install --production 2>> "$LOG_FILE"
fi

# Handle SIGTERM gracefully (Pearl sends this to stop the agent)
trap 'echo "[$(date -u "+%Y-%m-%d %H:%M:%S,000")] [INFO] [agent] Received SIGTERM — shutting down gracefully" >> "$LOG_FILE"; exit 0' SIGTERM
trap 'echo "[$(date -u "+%Y-%m-%d %H:%M:%S,000")] [INFO] [agent] Received SIGKILL — stopping" >> "$LOG_FILE"; exit 1' SIGKILL

# Start the agent
exec node "$SCRIPT_DIR/src/index.js"
