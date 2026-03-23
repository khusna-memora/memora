/**
 * update-agent-uri.js
 * Updates agentURI on both Base and Gnosis registries to memora.codes
 */
require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const NEW_AGENT_URI = 'https://memora.codes/agent-metadata.json';

const ABI = parseAbi([
  'function setAgentURI(uint256 agentId, string calldata newURI) external',
  'event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)'
]);

const chains = [
  {
    name: 'Base', id: 8453, agentId: 35755,
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org'
  },
  {
    name: 'Gnosis', id: 100, agentId: 3259,
    rpc: 'https://rpc.gnosischain.com',
    explorer: 'https://gnosisscan.io'
  }
];

async function updateChain(chain, account) {
  const viemChain = {
    id: chain.id, name: chain.name,
    nativeCurrency: { name: chain.name === 'Base' ? 'ETH' : 'xDAI', symbol: chain.name === 'Base' ? 'ETH' : 'XDAI', decimals: 18 },
    rpcUrls: { default: { http: [chain.rpc] } }
  };

  const walletClient = createWalletClient({ account, chain: viemChain, transport: http(chain.rpc) });

  console.log(`\n📡 ${chain.name} — agentId: ${chain.agentId}`);
  const txHash = await walletClient.writeContract({
    address: REGISTRY, abi: ABI,
    functionName: 'setAgentURI',
    args: [BigInt(chain.agentId), NEW_AGENT_URI]
  });

  const publicClient = createPublicClient({ chain: viemChain, transport: http(chain.rpc) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  console.log(`✅ ${chain.name} updated! TX: ${txHash}`);
  console.log(`   ${chain.explorer}/tx/${txHash}`);
  return txHash;
}

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) { console.error('❌ PRIVATE_KEY not set'); process.exit(1); }

  const pk = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(pk);
  console.log(`✅ Wallet: ${account.address}`);
  console.log(`📝 New agentURI: ${NEW_AGENT_URI}`);

  for (const chain of chains) {
    try {
      await updateChain(chain, account);
    } catch (err) {
      console.error(`❌ ${chain.name} failed: ${err.message}`);
    }
  }
  console.log('\n🎉 Done! agentURI updated on all chains → memora.codes');
}

main();
