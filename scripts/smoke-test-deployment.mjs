#!/usr/bin/env node
/**
 * Safe, read-only smoke test for a deployed PASTX API.
 * Usage: node scripts/smoke-test-deployment.mjs https://api.example.com
 */
const base = process.argv[2];
if (!base) {
  console.error("Usage: node scripts/smoke-test-deployment.mjs <api-base-url>");
  process.exit(2);
}

let origin;
try {
  origin = new URL(base);
} catch {
  console.error("API base URL must be a valid absolute URL.");
  process.exit(2);
}
if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash) {
  console.error("API base URL must use HTTP(S) and must not contain credentials, query parameters, or a fragment.");
  process.exit(2);
}
if (origin.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(origin.hostname)) {
  console.error("Use HTTPS for remote deployments. HTTP is allowed only for loopback testing.");
  process.exit(2);
}
const basePath = origin.pathname.replace(/\/$/, "");
const endpoint = (path) => new URL(`${basePath}${path}`, origin).toString();
const timeoutMs = 8000;

async function get(path, expectedStatuses = [200]) {
  const response = await fetch(endpoint(path), {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error"
  });
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${path}: expected HTTP ${expectedStatuses.join(" or ")}, received ${response.status}`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error(`${path}: response was not JSON`);
  return { status: response.status, body: await response.json() };
}

try {
  const health = await get("/api/health");
  if (health.body.status !== "ok" || health.body.service !== "pastx-api") {
    throw new Error("/api/health: unexpected service health payload");
  }
  if (health.body.tradingEnabled !== false) throw new Error("/api/health: trading must remain disabled");

  const capabilities = await get("/api/capabilities");
  const c = capabilities.body.capabilities;
  if (capabilities.body.safety?.tradingEnabled !== false ||
      c?.walletConnection?.enabled !== false ||
      c?.orderSubmission?.enabled !== false ||
      c?.atomicSettlement?.enabled !== false) {
    throw new Error("/api/capabilities: wallet, order submission, settlement, and trading must remain disabled");
  }

  const markets = await get("/api/markets");
  if (!Array.isArray(markets.body.items) || markets.body.items.length === 0) {
    throw new Error("/api/markets: expected a non-empty reference catalogue");
  }

  const chain = await get("/api/chain/status");
  const item = chain.body.item;
  if (!item || !["not_configured", "unreachable", "wrong_network", "verified"].includes(item.status) ||
      item.verificationScope !== "chain_id_and_latest_block_read") {
    throw new Error("/api/chain/status: invalid chain probe contract");
  }
  if (item.status === "verified" && (item.reachable !== true || item.networkMatches !== true ||
      !Number.isSafeInteger(item.chainId) || typeof item.blockNumber !== "string" || !/^\d+$/.test(item.blockNumber))) {
    throw new Error("/api/chain/status: verified status is missing consistent chain/block evidence");
  }
  if (item.status !== "verified" && item.status !== "wrong_network" && item.blockNumber !== null) {
    throw new Error("/api/chain/status: unexpected block number for an unverified endpoint");
  }

  const quote = await get("/api/markets/AAPL/quote", [200, 403, 503]);
  const candles = await get("/api/markets/AAPL/candles?interval=1day&outputsize=1", [200, 403, 503]);
  if (health.body.marketDataDisplayEnabled !== true &&
      (quote.status === 200 || candles.status === 200)) {
    throw new Error("Market data was returned while client-facing display is disabled");
  }

  console.log(JSON.stringify({
    status: "passed",
    baseUrl: origin.origin,
    checks: {
      health: "passed",
      tradingDisabled: "passed",
      referenceCatalogue: "passed",
      chainProbeContract: item.status,
      quoteEndpointStatus: quote.status,
      candleEndpointStatus: candles.status,
      marketDisplayGate: "passed"
    },
    note: "Read-only smoke test only; does not prove deployment security, chain canonicality, wallet compatibility, asset interoperability, or settlement safety."
  }, null, 2));
} catch (error) {
  console.error(`PASTX deployment smoke test failed: ${error instanceof Error ? error.message : "unexpected error"}`);
  process.exitCode = 1;
}
