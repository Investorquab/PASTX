#!/usr/bin/env node
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

/**
 * Read-only Portaldot V3 TESTNET Substrate runtime and head-progression probe.
 * Usage: node scripts/check-portaldot-v3-testnet-substrate.mjs [ws-url] [samples] [interval-ms]
 * The endpoint is pinned to the official V3 testnet hostname announced by Portaldot.
 * This evidence must not be used to infer mainnet configuration or trading safety.
 */
const [
  ,
  ,
  rawUrl = "wss://test-node-v3.portaldot.dev",
  rawSamples = "5",
  rawInterval = "5000"
] = process.argv;
const EXPECTED_HOST = "test-node-v3.portaldot.dev";

function fail(message) {
  console.error("Portaldot V3 TESTNET Substrate check failed: " + message);
  process.exitCode = 1;
}

let endpoint;
try {
  endpoint = new URL(rawUrl);
} catch {
  fail("Endpoint must be a valid absolute WebSocket URL.");
}
if (!endpoint || endpoint.protocol !== "wss:" || endpoint.hostname !== EXPECTED_HOST ||
    endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    /[\u0000-\u0020\u007f]/.test(rawUrl)) {
  fail("Use the official WSS testnet endpoint with no credentials, query string, fragment, whitespace, or control characters.");
}
if (!/^\d+$/.test(rawSamples) || Number(rawSamples) < 2 || Number(rawSamples) > 10) {
  fail("Samples must be an integer between 2 and 10.");
}
if (!/^\d+$/.test(rawInterval) || Number(rawInterval) < 1000 || Number(rawInterval) > 60000) {
  fail("Interval must be between 1000 and 60000 milliseconds.");
}
if (process.exitCode) process.exit(1);

const samplesCount = Number(rawSamples);
const intervalMs = Number(rawInterval);
const pending = new Map();
let requestId = 0;
let socket;

function rpc(method, params = []) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(method + " timed out"));
    }, 8000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timeout); resolve(value); },
      reject: (error) => { clearTimeout(timeout); reject(error); }
    });
    try {
      socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    } catch (error) {
      clearTimeout(timeout);
      pending.delete(id);
      reject(error instanceof Error ? error : new Error("WebSocket send failed"));
    }
  });
}

function headerNumber(header, label) {
  if (!header || typeof header.number !== "string" || !/^0x[0-9a-f]+$/i.test(header.number)) {
    throw new Error("Invalid " + label + " block header.");
  }
  return BigInt(header.number);
}

async function main() {
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out")), 8000);
    socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("WebSocket connection failed")); }, { once: true });
  });

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.jsonrpc !== "2.0") item.reject(new Error("Invalid JSON-RPC protocol version"));
    else if (message.error) item.reject(new Error(JSON.stringify(message.error)));
    else if (!Object.prototype.hasOwnProperty.call(message, "result")) item.reject(new Error("Malformed JSON-RPC response"));
    else item.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const item of pending.values()) item.reject(new Error("WebSocket closed while an RPC request was pending"));
    pending.clear();
  });

  const chain = await rpc("system_chain");
  if (typeof chain !== "string" || chain.length === 0) {
    throw new Error("Malformed system_chain response.");
  }
  if (/mainnet/i.test(chain)) {
    throw new Error("The endpoint reports a mainnet chain label; refusing to emit testnet evidence.");
  }

  // Anchor runtime-version and metadata reads to the same finalized block so the
  // reported fingerprint can be compared with other API representations safely.
  const snapshotFinalizedHash = await rpc("chain_getFinalizedHead");
  if (typeof snapshotFinalizedHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(snapshotFinalizedHash)) {
    throw new Error("Malformed finalized block hash response.");
  }
  const [nodeVersion, runtimeVersion, metadata] = await Promise.all([
    rpc("system_version"),
    rpc("state_getRuntimeVersion", [snapshotFinalizedHash]),
    rpc("state_getMetadata", [snapshotFinalizedHash])
  ]);
  if (typeof nodeVersion !== "string" || nodeVersion.length === 0) {
    throw new Error("Malformed system_version response.");
  }
  if (!runtimeVersion || typeof runtimeVersion.specName !== "string" ||
      runtimeVersion.specName.length === 0 ||
      !Number.isSafeInteger(runtimeVersion.specVersion) || runtimeVersion.specVersion < 0 ||
      !Number.isSafeInteger(runtimeVersion.transactionVersion) || runtimeVersion.transactionVersion < 0) {
    throw new Error("Malformed state_getRuntimeVersion response.");
  }
  if (typeof metadata !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(metadata)) {
    throw new Error("Malformed state_getMetadata response.");
  }
  const metadataBytes = Buffer.from(metadata.slice(2), "hex");
  const metadataSha256 = createHash("sha256").update(metadataBytes).digest("hex");
  const metadataOutputPath = process.env.PASTX_METADATA_OUTPUT;
  if (metadataOutputPath !== undefined) {
    if (!metadataOutputPath.trim() || metadataOutputPath.includes("\0")) {
      throw new Error("PASTX_METADATA_OUTPUT must be a valid non-empty file path.");
    }
    await writeFile(metadataOutputPath, metadata + "\n", { flag: "wx", mode: 0o600 });
    console.log("METADATA_CAPTURE " + JSON.stringify({
      file: metadataOutputPath,
      encoding: "0x-prefixed-hex",
      byteLength: metadataBytes.byteLength,
      sha256: metadataSha256
    }));
  }

  const runtimeFingerprint = {
    chain,
    nodeVersion,
    metadataAtFinalizedHash: snapshotFinalizedHash,
    metadataHexPrefix: metadata.slice(0, 18),
    specName: runtimeVersion.specName,
    specVersion: runtimeVersion.specVersion,
    transactionVersion: runtimeVersion.transactionVersion,
    metadataByteLength: metadataBytes.byteLength,
    metadataSha256,
    note: "Testnet runtime fingerprint only; metadata must be decoded and reviewed before inferring pallet support or asset semantics."
  };
  console.log("RUNTIME_FINGERPRINT " + JSON.stringify(runtimeFingerprint, null, 2));

  const observations = [];
  for (let i = 0; i < samplesCount; i++) {
    const [health, bestHash, finalizedHash] = await Promise.all([
      rpc("system_health"),
      rpc("chain_getHead"),
      rpc("chain_getFinalizedHead")
    ]);
    if (!health || !Number.isInteger(health.peers) || health.peers < 0 || typeof health.isSyncing !== "boolean") {
      throw new Error("Malformed system_health response.");
    }
    if (typeof bestHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(bestHash) ||
        typeof finalizedHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(finalizedHash)) {
      throw new Error("Malformed best or finalized block hash response.");
    }
    const [bestHeader, finalizedHeader] = await Promise.all([
      rpc("chain_getHeader", [bestHash]),
      rpc("chain_getHeader", [finalizedHash])
    ]);
    const bestBlock = headerNumber(bestHeader, "best");
    const finalizedBlock = headerNumber(finalizedHeader, "finalized");
    if (finalizedBlock > bestBlock) throw new Error("Finalized block exceeds best block.");

    const observation = {
      sample: i + 1,
      peers: health.peers,
      isSyncing: health.isSyncing,
      bestBlock: bestBlock.toString(),
      finalizedBlock: finalizedBlock.toString(),
      bestHash,
      finalizedHash,
      observedAt: new Date().toISOString()
    };
    observations.push(observation);
    console.log("OBSERVATION " + JSON.stringify(observation));
    if (i < samplesCount - 1) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  const first = observations[0];
  const last = observations[observations.length - 1];
  const bestAdvanced = BigInt(last.bestBlock) > BigInt(first.bestBlock);
  const finalizedAdvanced = BigInt(last.finalizedBlock) > BigInt(first.finalizedBlock);
  const summary = {
    status: bestAdvanced && finalizedAdvanced ? "passed" : "insufficient_progress",
    networkScope: "Portaldot V3 TESTNET endpoint announced by the Portaldot team",
    endpoint: endpoint.origin,
    chain,
    runtimeFingerprint,
    samples: samplesCount,
    intervalMs,
    bestHeadAdvanced: bestAdvanced,
    bestBlocksAdvanced: (BigInt(last.bestBlock) - BigInt(first.bestBlock)).toString(),
    finalizedHeadAdvanced: finalizedAdvanced,
    finalizedBlocksAdvanced: (BigInt(last.finalizedBlock) - BigInt(first.finalizedBlock)).toString(),
    peersLastSample: last.peers,
    syncingLastSample: last.isSyncing,
    note: "Read-only Substrate RPC evidence only. It does not establish EVM support, canonicality, asset semantics, wallet mapping, trading, or settlement safety."
  };
  console.log("SUMMARY " + JSON.stringify(summary, null, 2));
  if (!bestAdvanced || !finalizedAdvanced) {
    throw new Error("Best and finalized block heights must both advance during the observation window.");
  }
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "unexpected error"))
  .finally(() => {
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  });
