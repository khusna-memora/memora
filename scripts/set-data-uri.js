/**
 * set-data-uri.js
 * Converts agent-metadata.json → base64 data URI and sets as agentURI on Gnosis
 * This eliminates WA040 warning (HTTP URI not content-addressed)
 * Data URIs are IMMUTABLE — metadata is encoded directly in the blockchain
 */
require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const GNOSIS_AGENT_ID = 3259n;
const GNOSIS_RPC = 'https://rpc.gnosischain.com';

const gnosis = {
  id: 100, name: 'Gnosis',
  nativeCurrency: { name: 'xDAI', symbol: 'XDAI', decimals: 18 },
  rpcUrls: { default: { http: [GNOSIS_RPC] } },
  blockExplorers: { default: { name: 'GnosisScan', url: 'https://gnosisscan.io' } }
};

const ABI = parseAbi([
  'function setAgentURI(uint256 agentId, string calldata newURI) external',
  'function tokenURI(uint256 tokenId) external view returns (string)'
]);

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) { console.error('❌ PRIVATE_KEY not set'); process.exit(1); }
  const pk = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(pk);
  console.log('✅ Wallet:', account.address);

  // Read and validate metadata
  const metaPath = path.join(__dirname, '../agent-metadata.json');
  const metaContent = fs.readFileSync(metaPath, 'utf8');
  JSON.parse(metaContent); // validate JSON
  console.log(`📋 Metadata: ${metaContent.length} bytes`);

  // Encode as base64 data URI
  const encoded = Buffer.from(metaContent).toString('base64');
  const dataURI = `data:application/json;base64,${encoded}`;
  console.log(`📦 Data URI: ${dataURI.length} chars (immutable, no WA040)`);

  // Estimate gas cost
  const gasBytes = dataURI.length;
  const estimatedGas = gasBytes * 68; // ~68 gas per calldata byte
  const gasCostXdai = (estimatedGas * 2e-9); // at 2 gwei
  console.log(`⛽ Est. gas: ~${estimatedGas.toLocaleString()} gas (~${gasCostXdai.toFixed(6)} XDAI)`);

  const publicClient = createPublicClient({ chain: gnosis, transport: http(GNOSIS_RPC) });
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${(Number(balance) / 1e18).toFixed(6)} XDAI`);

  const walletClient = createWalletClient({ account, chain: gnosis, transport: http(GNOSIS_RPC) });

  console.log('\n📝 Setting data URI as agentURI on Gnosis...');
  const txHash = await walletClient.writeContract({
    address: REGISTRY, abi: ABI,
    functionName: 'setAgentURI',
    args: [GNOSIS_AGENT_ID, dataURI]
  });

  console.log('⏳ TX:', txHash);
  console.log('   https://gnosisscan.io/tx/' + txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Confirmed! Block: ${receipt.blockNumber}`);
  console.log('\n🎉 agentURI is now a data URI — WA040 warning eliminated!');
  console.log('   8004scan will now see: content-addressed (immutable)');
  console.log('   Refresh: https://www.8004scan.io/agent/3259');

  // Save result
  fs.writeFileSync(
    path.join(__dirname, '../data/gnosis-data-uri-update.json'),
    JSON.stringify({ txHash, agentId: 3259, dataURILength: dataURI.length, timestamp: new Date().toISOString() }, null, 2)
  );
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
