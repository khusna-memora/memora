/**
 * register-gnosis.js
 * Registers Memora on ERC-8004 Identity Registry on Gnosis chain (chainId 100)
 * Registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/register-gnosis.js
 *   OR set PRIVATE_KEY in .env
 *
 * Requirements: npm install viem (already in package.json)
 */

require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const GNOSIS_RPC = 'https://rpc.gnosischain.com';
const AGENT_URI = 'https://memora-production-bfc4.up.railway.app/agent-metadata.json';

const gnosis = {
  id: 100,
  name: 'Gnosis',
  nativeCurrency: { name: 'xDAI', symbol: 'XDAI', decimals: 18 },
  rpcUrls: { default: { http: [GNOSIS_RPC] } },
  blockExplorers: { default: { name: 'GnosisScan', url: 'https://gnosisscan.io' } }
};

const ABI = parseAbi([
  'function register(string agentURI) external returns (uint256 agentId)',
  'function register() external returns (uint256 agentId)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)'
]);

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error('❌ PRIVATE_KEY not set. Add to .env or pass as env var.');
    process.exit(1);
  }

  const pk = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(pk);
  console.log(`✅ Wallet: ${account.address}`);

  const publicClient = createPublicClient({ chain: gnosis, transport: http(GNOSIS_RPC) });

  // Check XDAI balance
  const balance = await publicClient.getBalance({ address: account.address });
  const xdai = Number(balance) / 1e18;
  console.log(`💰 Balance: ${xdai.toFixed(8)} XDAI`);
  if (xdai < 0.0001) {
    console.warn('⚠️  Very low XDAI balance. Get from: https://gnosisfaucet.com');
    if (xdai === 0) {
      console.error('❌ Zero balance — fund wallet first');
      process.exit(1);
    }
  }

  const walletClient = createWalletClient({ account, chain: gnosis, transport: http(GNOSIS_RPC) });

  console.log(`\n📝 Registering Memora on Gnosis ERC-8004 registry...`);
  console.log(`   Registry: ${REGISTRY}`);
  console.log(`   Agent URI: ${AGENT_URI}`);

  try {
    const txHash = await walletClient.writeContract({
      address: REGISTRY,
      abi: ABI,
      functionName: 'register',
      args: [AGENT_URI]
    });

    console.log(`\n⏳ TX sent: ${txHash}`);
    console.log(`   GnosisScan: https://gnosisscan.io/tx/${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`✅ Confirmed! Block: ${receipt.blockNumber}`);

    // Parse Registered event to get agentId
    const registeredLog = receipt.logs.find(log => {
      try {
        return log.topics[0] === '0x' + Buffer.from('Registered(uint256,string,address)').toString('hex').slice(0, 8);
      } catch { return false; }
    });

    // Decode agentId from topics[1]
    let agentId = null;
    if (receipt.logs.length > 0) {
      // Try to find the Transfer event (ERC-721 mint) to get tokenId
      for (const log of receipt.logs) {
        if (log.topics.length >= 4 && log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
          agentId = parseInt(log.topics[3], 16);
          break;
        }
      }
      // Fallback: try topic[1] of first log
      if (!agentId && receipt.logs[0]?.topics[1]) {
        agentId = parseInt(receipt.logs[0].topics[1], 16);
      }
    }

    if (!agentId) {
      console.log('ℹ️  Could not auto-parse agentId from logs. Check GnosisScan.');
      console.log('   TX:', txHash);
    } else {
      console.log(`\n🎉 Gnosis Agent ID: ${agentId}`);
      console.log(`   8004scan: https://www.8004scan.io/agent/${agentId}`);
      console.log(`   GnosisScan token: https://gnosisscan.io/token/${REGISTRY}?a=${agentId}`);

      // Update agent-metadata.json
      const metaPath = path.join(__dirname, '../agent-metadata.json');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

      // Remove placeholder if exists
      meta.registrations = meta.registrations.filter(r => !r.agentRegistry.includes(':100:'));
      meta.registrations.push({
        agentId: agentId,
        agentRegistry: `eip155:100:${REGISTRY}`
      });
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      console.log(`✅ Updated agent-metadata.json with Gnosis agentId: ${agentId}`);

      // Update well-known agent-registration.json
      const wellKnownPath = path.join(__dirname, '../src/ui/.well-known/agent-registration.json');
      const wellKnown = JSON.parse(fs.readFileSync(wellKnownPath, 'utf8'));
      wellKnown.registrations = wellKnown.registrations.filter(r => !r.agentRegistry.includes(':100:'));
      wellKnown.registrations.push({
        agentId: agentId,
        agentRegistry: `eip155:100:${REGISTRY}`
      });
      // Update description to mention Gnosis
      wellKnown.description = wellKnown.description.replace('on Base.', 'on Base and Gnosis.');
      fs.writeFileSync(wellKnownPath, JSON.stringify(wellKnown, null, 2));
      console.log(`✅ Updated .well-known/agent-registration.json`);

      console.log('\n📤 Now commit and push to deploy:');
      console.log('   git add agent-metadata.json src/ui/.well-known/agent-registration.json');
      console.log(`   git commit -m "feat: ERC-8004 Gnosis registration agentId:${agentId}"`);
      console.log('   git push');
    }

    // Save TX info
    const txInfoPath = path.join(__dirname, '../data/gnosis-registration.json');
    fs.mkdirSync(path.dirname(txInfoPath), { recursive: true });
    fs.writeFileSync(txInfoPath, JSON.stringify({
      txHash,
      agentId,
      chain: 'gnosis',
      chainId: 100,
      registry: REGISTRY,
      agentURI: AGENT_URI,
      blockNumber: receipt.blockNumber.toString(),
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log(`\n💾 TX info saved to data/gnosis-registration.json`);

  } catch (err) {
    console.error('❌ Registration failed:', err.message);
    if (err.message.includes('insufficient funds')) {
      console.error('   Fund wallet with XDAI: https://gnosisfaucet.com');
    }
    process.exit(1);
  }
}

main();
