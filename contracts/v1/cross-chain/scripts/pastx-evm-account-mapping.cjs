// PASTX read-only Portaldot V3 account-mapping diagnostic.
// Run from contracts/cross-chain. Does not sign, transfer, deploy, or print secrets.
require("dotenv").config();
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { encodeAddress, cryptoWaitReady } = require("@polkadot/util-crypto");
const { ethers } = require("ethers");

const WS = process.env.PORTALDOT_WS || "wss://test-node-v3.portaldot.dev";
const RPC = process.env.PORTALDOT_V3_EVM_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev";
const CHAIN_ID = 420420777;
const PATH = "m/44'/60'/0'/0/0";

async function main() {
  await cryptoWaitReady();
  const pk = (process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY || "").trim();
  const phrase = (process.env.PORTALDOT_DEPLOYER_MNEMONIC || "").trim().split(/\s+/).filter(Boolean).join(" ");
  if (Boolean(pk) === Boolean(phrase)) throw new Error("Set exactly one existing PASTX signer source: PORTALDOT_DEPLOYER_PRIVATE_KEY or PORTALDOT_DEPLOYER_MNEMONIC.");
  const wallet = pk ? new ethers.Wallet(pk) : ethers.HDNodeWallet.fromPhrase(phrase, "", PATH);
  const evmAddress = wallet.address;
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(CHAIN_ID)) throw new Error(`Wrong EVM chain ID: ${network.chainId}`);
  const api = await ApiPromise.create({ provider: new WsProvider(WS), noInitWarn: true });
  try {
    const chain = (await api.rpc.system.chain()).toString();
    const genesisHash = api.genesisHash.toHex();
    const mappedRaw = await api.call.reviveApi.accountId(evmAddress);
    const mappedAddress = encodeAddress(mappedRaw.toU8a(), api.registry.chainSS58 ?? 42);
    const originalAddress = "5DG1kXxFVY4kjZtLmGCsixwvxLxx29ELQTke5mDcEXu42Ubv";
    const [evmBalance, mappedAccount, originalAccount] = await Promise.all([
      provider.getBalance(evmAddress),
      api.query.system.account(mappedAddress),
      api.query.system.account(originalAddress),
    ]);
    const decimals = Number(api.registry.chainDecimals[0] ?? 14);
    const symbol = api.registry.chainTokens[0] ?? "POT";
    const fmt = (v) => `${ethers.formatUnits(v.toString(), decimals)} ${symbol}`;
    console.log("\nPASTX READ-ONLY ACCOUNT MAPPING\n--------------------------------");
    console.log(`Network: ${chain}`);
    console.log(`Chain ID: ${network.chainId}`);
    console.log(`Genesis: ${genesisHash}`);
    console.log(`EVM signer: ${evmAddress}`);
    console.log(`Mapped native SS58 (send-to candidate): ${mappedAddress}`);
    console.log(`EVM balance: ${ethers.formatUnits(evmBalance, decimals)} ${symbol}`);
    console.log(`Mapped native free: ${fmt(mappedAccount.data.free)}`);
    console.log(`Mapped native reserved: ${fmt(mappedAccount.data.reserved)}`);
    console.log(`Mapped native frozen: ${fmt(mappedAccount.data.frozen ?? 0)}`);
    console.log(`Original faucet wallet: ${originalAddress}`);
    console.log(`Original wallet free: ${fmt(originalAccount.data.free)}`);
    console.log(`Original wallet reserved: ${fmt(originalAccount.data.reserved)}`);
    console.log(`Original wallet frozen: ${fmt(originalAccount.data.frozen ?? 0)}`);
    console.log(`Original wallet nonce: ${originalAccount.nonce.toString()}`);
    console.log("\nNo transaction signed or submitted. No funds moved.");
    console.log("IMPORTANT: mapping is diagnostic only. Do not transfer funds until the mapped address and account status are reviewed.");
  } finally { await api.disconnect(); await provider.destroy(); }
}
main().catch((err) => {
  const msg = String(err && (err.shortMessage || err.message) || err);
  console.error(`READ-ONLY PREFLIGHT FAILED: ${msg.replace(/https?:\/\/\S+/g, "[RPC URL REDACTED]")}`);
  process.exitCode = 1;
});

