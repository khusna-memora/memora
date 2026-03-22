/**
 * Keystore & Safe address reader
 * Pearl requires agent to read:
 *  - ethereum_private_key.txt (Agent EOA private key, V3 Keystore format)
 *  - CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES (JSON object)
 *  - --password arg for decryption
 */
const fs = require('fs');
const path = require('path');

let _agentEOA = null;
let _safeAddresses = null;

/**
 * Load agent EOA from ethereum_private_key.txt
 * Returns the public address only — never logs the private key
 */
function loadAgentEOA() {
  if (_agentEOA) return _agentEOA;

  const keyPath = path.join(process.cwd(), 'ethereum_private_key.txt');
  if (!fs.existsSync(keyPath)) {
    global.agentLog?.('INFO', 'ethereum_private_key.txt not found — running without EOA (demo mode)');
    return null;
  }

  try {
    const raw = fs.readFileSync(keyPath, 'utf8').trim();
    // Detect if JSON (V3 Keystore) or raw hex key
    if (raw.startsWith('{')) {
      const keystore = JSON.parse(raw);
      _agentEOA = keystore.address ? `0x${keystore.address}` : null;
    } else {
      // Raw hex key — derive address using viem
      try {
        const { privateKeyToAddress } = require('viem/accounts');
        const hex = raw.startsWith('0x') ? raw : `0x${raw}`;
        _agentEOA = privateKeyToAddress(hex);
      } catch {
        _agentEOA = process.env.AGENT_EOA_ADDRESS || null;
      }
    }
    if (_agentEOA) {
      global.agentLog?.('INFO', `Agent EOA loaded: ${_agentEOA}`);
    }
    return _agentEOA;
  } catch (err) {
    global.agentLog?.('ERROR', `Failed to load ethereum_private_key.txt: ${err.message}`);
    return null;
  }
}

/**
 * Load Safe contract addresses from env var
 * CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES
 * Format: {"base":"0x...", "gnosis":"0x..."}
 */
function loadSafeAddresses() {
  if (_safeAddresses) return _safeAddresses;

  const raw = process.env.CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES;
  if (!raw) {
    global.agentLog?.('INFO', 'CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES not set — running without Safe');
    return {};
  }

  try {
    _safeAddresses = JSON.parse(raw);
    global.agentLog?.('INFO', `Safe addresses loaded for chains: ${Object.keys(_safeAddresses).join(', ')}`);
    return _safeAddresses;
  } catch (err) {
    global.agentLog?.('ERROR', `Failed to parse SAFE_CONTRACT_ADDRESSES: ${err.message}`);
    return {};
  }
}

/**
 * Get RPC URL for a given chain from Pearl env vars
 */
function getRPC(chain) {
  const envMap = {
    ethereum: 'CONNECTION_LEDGER_CONFIG_LEDGER_APIS_ETHEREUM_ADDRESS',
    gnosis:   'CONNECTION_LEDGER_CONFIG_LEDGER_APIS_GNOSIS_ADDRESS',
    base:     'CONNECTION_LEDGER_CONFIG_LEDGER_APIS_BASE_ADDRESS',
    mode:     'CONNECTION_LEDGER_CONFIG_LEDGER_APIS_MODE_ADDRESS',
    optimism: 'CONNECTION_LEDGER_CONFIG_LEDGER_APIS_OPTIMISM_ADDRESS',
    polygon:  'CONNECTION_LEDGER_CONFIG_LEDGER_APIS_POLYGON_ADDRESS'
  };
  return process.env[envMap[chain]] || process.env.BASE_LEDGER_RPC || 'https://mainnet.base.org';
}

module.exports = { loadAgentEOA, loadSafeAddresses, getRPC };
