// PASTX trusted testnet relayer.
// Watches the Portaldot escrow for DepositInitiated events and calls
// completeDeposit on the BNB gateway to mint the matching wtPOT.
// This is an explicitly TRUSTED single-relayer model, not a trustless bridge.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  createPublicClient, createWalletClient, defineChain, http, parseAbi, getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.PASTX_ENV_FILE || path.resolve(here, "../../.env") });

const first = (...v) => v.find((x) => typeof x === "string" && x.trim());
const PORTAL_RPC = first(process.env.PORTALDOT_EVM_RPC_URL, process.env.PASTX_PORTALDOT_EVM_RPC_URL, process.env.VITE_PASTX_PORTALDOT_EVM_RPC_URL, process.env.PORTALDOT_V3_EVM_RPC_URL) || "https://test-evm-rpc-v3.portaldot.dev";
const BNB_RPC = first(process.env.BNB_TESTNET_RPC_URL, process.env.BSC_TESTNET_RPC_URL, process.env.VITE_PASTX_BSC_TESTNET_RPC_URL) || "https://bsc-testnet-rpc.publicnode.com";
const ESCROW = getAddress(first(process.env.PASTX_PORTALDOT_ESCROW_ADDRESS, "0x024b77EBbF04f48a0d921094f7000b18063bdD69"));
const GATEWAY = getAddress(first(process.env.PASTX_BNB_GATEWAY_ADDRESS, "0xd81133c76289Df27105E8aF15579631fE305F9E1"));
const KEY = first(process.env.PASTX_BNB_RELAYER_PRIVATE_KEY, process.env.BNB_TESTNET_DEPLOYER_PRIVATE_KEY, process.env.PASTX_DEPLOYER_PRIVATE_KEY, process.env.DEPLOYER_PRIVATE_KEY);
if (!KEY) { console.error("No relayer key. Set PASTX_BNB_RELAYER_PRIVATE_KEY (or BNB_TESTNET_DEPLOYER_PRIVATE_KEY) in .env"); process.exit(1); }
const account = privateKeyToAccount(KEY.startsWith("0x") ? KEY : `0x${KEY}`);

const portal = defineChain({ id: 420420777, name: "Portaldot V3", nativeCurrency: { name: "tPOT", symbol: "tPOT", decimals: 18 }, rpcUrls: { default: { http: [PORTAL_RPC] } } });
const bnb = defineChain({ id: 97, name: "BNB Testnet", nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 }, rpcUrls: { default: { http: [BNB_RPC] } } });
const portalClient = createPublicClient({ chain: portal, transport: http(PORTAL_RPC) });
const bnbClient = createPublicClient({ chain: bnb, transport: http(BNB_RPC) });
const relayer = createWalletClient({ account, chain: bnb, transport: http(BNB_RPC) });

const escrowAbi = parseAbi([
  "event DepositInitiated(bytes32 indexed depositId,address indexed sender,address indexed recipient,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 nonce)",
]);
const gatewayAbi = parseAbi([
  "function relayer() view returns (address)",
  "function processedDepositIds(bytes32) view returns (bool)",
  "function completeDeposit(bytes32 depositId,address sourceSender,address recipient,uint256 sourceAmount,uint256 sourceChain,address escrow,uint256 destinationChain,uint256 nonce,bytes32 sourceTxHash,uint256 sourceLogIndex)",
]);

const POLL_MS = Number(process.env.PASTX_RELAY_POLL_MS || 4000);

async function main() {
  const onChainRelayer = await bnbClient.readContract({ address: GATEWAY, abi: gatewayAbi, functionName: "relayer" });
  if (getAddress(onChainRelayer) !== account.address) {
    console.error(`Relayer key (${account.address}) is NOT the gateway relayer (${onChainRelayer}). completeDeposit would revert.`);
    process.exit(1);
  }
  const bal = await bnbClient.getBalance({ address: account.address });
  console.log(`PASTX relayer online`);
  console.log(`  relayer   : ${account.address} (${(Number(bal) / 1e18).toFixed(5)} tBNB)`);
  console.log(`  escrow    : ${ESCROW} @ Portaldot`);
  console.log(`  gateway   : ${GATEWAY} @ BNB`);

  let fromBlock = await portalClient.getBlockNumber();
  console.log(`  watching DepositInitiated from Portaldot block ${fromBlock}…`);

  for (;;) {
    try {
      const latest = await portalClient.getBlockNumber();
      if (latest >= fromBlock) {
        const logs = await portalClient.getLogs({ address: ESCROW, event: escrowAbi[0], fromBlock, toBlock: latest });
        for (const log of logs) await relay(log);
        fromBlock = latest + 1n;
      }
    } catch (e) { console.error("poll error:", e.shortMessage || e.message); }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function relay(log) {
  const a = log.args;
  const tag = `${a.depositId.slice(0, 10)}…`;
  try {
    if (await bnbClient.readContract({ address: GATEWAY, abi: gatewayAbi, functionName: "processedDepositIds", args: [a.depositId] })) {
      return; // already minted
    }
    console.log(`→ deposit ${tag}: ${(Number(a.amount) / 1e18).toFixed(4)} tPOT → ${a.recipient}`);
    const hash = await relayer.writeContract({
      address: GATEWAY, abi: gatewayAbi, functionName: "completeDeposit",
      args: [a.depositId, a.sender, a.recipient, a.amount, a.sourceChainId, ESCROW, 97n, a.nonce, log.transactionHash, BigInt(log.logIndex)],
    });
    const rc = await bnbClient.waitForTransactionReceipt({ hash });
    console.log(`  ${rc.status === "success" ? "✓ minted" : "✕ failed"} wtPOT — BNB tx ${hash}`);
  } catch (e) {
    console.error(`  ✕ relay ${tag} failed:`, e.shortMessage || e.message);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
