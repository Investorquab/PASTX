#!/usr/bin/env node
/**
 * Read-only direct JSON-RPC check for chain identity and block progression.
 * Usage: node scripts/check-chain-progress.mjs <rpc-url> [expected-chain-id] [samples] [interval-ms]
 * Defaults: expected chain ID 420420777, 5 samples, 15000 ms between samples.
 */
const [, , rpcUrl, rawChainId = "420420777", rawSamples = "5", rawInterval = "15000"] = process.argv;

function fail(message) {
  console.error(`Portaldot RPC check failed: ${message}`);
  process.exit(1);
}

if (!rpcUrl) {
  console.error("Usage: node scripts/check-chain-progress.mjs <rpc-url> [expected-chain-id] [samples] [interval-ms]");
  process.exit(2);
}

let endpoint;
try {
  endpoint = new URL(rpcUrl);
} catch {
  fail("RPC URL must be a valid absolute URL.");
}
if (!["https:", "http:"].includes(endpoint.protocol) || !endpoint.hostname ||
    endpoint.username || endpoint.password || /[\u0000-\u0020\u007f]/.test(rpcUrl)) {
  fail("RPC URL must use HTTP(S), contain no credentials, and contain no whitespace or control characters.");
}
if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname)) {
  fail("Use HTTPS for remote RPC endpoints; HTTP is allowed only for loopback testing.");
}

if (!/^\d+$/.test(rawChainId) || !Number.isSafeInteger(Number(rawChainId)) || Number(rawChainId) < 1) {
  fail("Expected chain ID must be a positive safe integer.");
}
if (!/^\d+$/.test(rawSamples) || Number(rawSamples) < 2 || Number(rawSamples) > 20) {
  fail("Samples must be an integer between 2 and 20.");
}
if (!/^\d+$/.test(rawInterval) || Number(rawInterval) < 1000 || Number(rawInterval) > 300000) {
  fail("Interval must be between 1000 and 300000 milliseconds.");
}

const expectedChainId = Number(rawChainId);
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
  if (payload.error || payload.id !== id || typeof payload.result !== "string") {
    throw new Error(`${method}: invalid JSON-RPC response`);
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
    const chainId = Number(BigInt(chainHex));
    const blockNumber = BigInt(blockHex);
    if (!Number.isSafeInteger(chainId) || chainId < 1) throw new Error("RPC returned an invalid chain ID.");
    if (chainId !== expectedChainId) {
      throw new Error(`Wrong network: expected chain ID ${expectedChainId}, received ${chainId}.`);
    }
    observations.push({ sample: i + 1, chainId, blockNumber: blockNumber.toString(), observedAt: new Date().toISOString() });
    if (i < samples - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
} catch (error) {
  fail(error instanceof Error ? error.message : "unexpected RPC error");
}

const first = BigInt(observations[0].blockNumber);
const last = BigInt(observations[observations.length - 1].blockNumber);
if (last <= first) {
  console.error(JSON.stringify({ status: "no_progress_observed", expectedChainId, observations }, null, 2));
  fail("Block height did not increase during the observation window. Extend the interval or investigate the endpoint.");
}

console.log(JSON.stringify({
  status: "passed",
  expectedChainId,
  samples,
  intervalMs,
  firstBlock: first.toString(),
  lastBlock: last.toString(),
  blocksAdvanced: (last - first).toString(),
  observations,
  note: "Read-only JSON-RPC checks only. Progress does not prove canonicality, validator health, wallet mapping, asset interoperability, or settlement safety."
}, null, 2));
