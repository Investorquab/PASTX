#!/usr/bin/env node
/**
 * Read-only Portaldot V3 TESTNET EVM endpoint check.
 * Usage: node scripts/check-portaldot-v3-testnet.mjs [rpc-url] [samples] [interval-ms]
 * Defaults to the officially announced V3 testnet endpoint and chain ID.
 * This script must not be used as evidence for mainnet configuration.
 */
const [, , rpcUrl = "https://test-evm-rpc-v3.portaldot.dev", rawSamples = "3", rawInterval = "5000"] = process.argv;
const EXPECTED_CHAIN_ID = 420420777;

function fail(message) {
  console.error(`Portaldot V3 TESTNET check failed: ${message}`);
  process.exit(1);
}

let endpoint;
try { endpoint = new URL(rpcUrl); } catch { fail("RPC URL must be a valid absolute URL."); }
if (endpoint.protocol !== "https:" || !endpoint.hostname || endpoint.username || endpoint.password ||
    /[\u0000-\u0020\u007f]/.test(rpcUrl)) {
  fail("Testnet RPC URL must use HTTPS and contain no credentials, whitespace, or control characters.");
}
if (!/^\\d+$/.test(rawSamples) || Number(rawSamples) < 2 || Number(rawSamples) > 10) {
  fail("Samples must be an integer between 2 and 10.");
}
if (!/^\\d+$/.test(rawInterval) || Number(rawInterval) < 1000 || Number(rawInterval) > 60000) {
  fail("Interval must be between 1000 and 60000 milliseconds.");
}
const samples = Number(rawSamples);
const intervalMs = Number(rawInterval);
let requestId = 0;

async function rpc(method) {
  const id = ++requestId;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params: [], id }),
    signal: AbortSignal.timeout(8000),
    redirect: "error"
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || payload.jsonrpc !== "2.0" || payload.id !== id ||
      payload.error || typeof payload.result !== "string") {
    throw new Error(`${method}: malformed or unsuccessful JSON-RPC response`);
  }
  return payload.result;
}

const observations = [];
try {
  for (let i = 0; i < samples; i++) {
    const [chainHex, blockHex] = await Promise.all([rpc("eth_chainId"), rpc("eth_blockNumber")]);
    if (!/^0x[0-9a-f]+$/i.test(chainHex) || !/^0x[0-9a-f]+$/i.test(blockHex)) {
      throw new Error("RPC returned a malformed chain ID or block number.");
    }
    const chainIdBig = BigInt(chainHex);
    const blockNumber = BigInt(blockHex);
    if (chainIdBig !== BigInt(EXPECTED_CHAIN_ID)) {
      throw new Error(`Wrong network: expected TESTNET chain ID ${EXPECTED_CHAIN_ID}, received ${chainIdBig.toString()}.`);
    }
    observations.push({ sample: i + 1, chainId: Number(chainIdBig), blockNumber: blockNumber.toString(), observedAt: new Date().toISOString() });
    if (i < samples - 1) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
} catch (error) {
  fail(error instanceof Error ? error.message : "unexpected RPC error");
}

const first = BigInt(observations[0].blockNumber);
const last = BigInt(observations[observations.length - 1].blockNumber);
if (last <= first) {
  console.error(JSON.stringify({ status: "no_progress_observed", network: "Portaldot V3 TESTNET", expectedChainId: EXPECTED_CHAIN_ID, observations }, null, 2));
  fail("Block height did not increase during the observation window.");
}
console.log(JSON.stringify({
  status: "passed",
  network: "Portaldot V3 TESTNET",
  endpoint: endpoint.origin,
  expectedChainId: EXPECTED_CHAIN_ID,
  samples,
  intervalMs,
  firstBlock: first.toString(),
  lastBlock: last.toString(),
  blocksAdvanced: (last - first).toString(),
  observations,
  note: "Read-only JSON-RPC only. This is testnet evidence; it does not establish mainnet configuration, canonicality, wallet mapping, asset semantics, or settlement safety."
}, null, 2));
