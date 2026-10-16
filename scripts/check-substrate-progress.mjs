#!/usr/bin/env node
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
/**
 * Read-only Substrate WebSocket health and block-progression probe.
 * Usage: node scripts/check-substrate-progress.mjs [ws-url] [samples] [interval-ms]
 * Defaults: official Portaldot Mainnet WebSocket, 6 samples, 5000 ms between samples.
 */
const [, , rawUrl = "wss://mainnet.portaldot.io", rawSamples = "6", rawInterval = "5000"] = process.argv;

function fail(message) {
  console.error("Portaldot Substrate check failed: " + message);
  process.exitCode = 1;
}

let endpoint;
try {
  endpoint = new URL(rawUrl);
} catch {
  fail("Endpoint must be a valid absolute WebSocket URL.");
}
if (endpoint && (!["wss:", "ws:"].includes(endpoint.protocol) ||
    !endpoint.hostname || endpoint.username || endpoint.password ||
    /[\u0000-\u0020\u007f]/.test(rawUrl))) {
  fail("Endpoint must use WS(S), contain no credentials, and contain no whitespace or control characters.");
}
if (endpoint && endpoint.protocol !== "wss:" &&
    !["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname)) {
  fail("Use WSS for remote endpoints; WS is allowed only for loopback testing.");
}
if (!/^\d+$/.test(rawSamples) || Number(rawSamples) < 2 || Number(rawSamples) > 20) {
  fail("Samples must be an integer between 2 and 20.");
}
if (!/^\d+$/.test(rawInterval) || Number(rawInterval) < 1000 || Number(rawInterval) > 300000) {
  fail("Interval must be between 1000 and 300000 milliseconds.");
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
    socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
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
    if (message.error) item.reject(new Error(JSON.stringify(message.error)));
    else if (!Object.prototype.hasOwnProperty.call(message, "result")) item.reject(new Error("Malformed JSON-RPC response"));
    else item.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const item of pending.values()) item.reject(new Error("WebSocket closed while an RPC request was pending"));
    pending.clear();
  });

  const chain = await rpc("system_chain");
  if (chain !== "Portaldot Mainnet") {
    throw new Error("Expected Portaldot Mainnet, received " + JSON.stringify(chain));
  }

  // Record the actual Substrate runtime identity and metadata fingerprint.
  // This is diagnostic evidence only; it does not prove EVM compatibility or
  // asset-pallet semantics.
  const [runtimeVersion, metadata] = await Promise.all([
    rpc("state_getRuntimeVersion"),
    rpc("state_getMetadata")
  ]);
  if (
    !runtimeVersion ||
    typeof runtimeVersion.specName !== "string" ||
    runtimeVersion.specName.length === 0 ||
    !Number.isSafeInteger(runtimeVersion.specVersion) ||
    runtimeVersion.specVersion < 0 ||
    !Number.isSafeInteger(runtimeVersion.transactionVersion) ||
    runtimeVersion.transactionVersion < 0
  ) {
    throw new Error("Malformed state_getRuntimeVersion response.");
  }
  if (typeof metadata !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(metadata)) {
    throw new Error("Malformed state_getMetadata response.");
  }
  const metadataBytes = Buffer.from(metadata.slice(2), "hex");
  // Optional evidence capture: preserve the exact metadata bytes as hex so a
  // later decoder can inspect pallet names and runtime interfaces. Never log
  // metadata wholesale or treat capture as proof of asset/EVM compatibility.
  const metadataOutputPath = process.env.PASTX_METADATA_OUTPUT;
  if (metadataOutputPath) {
    if (!metadataOutputPath.trim() || metadataOutputPath.includes("\0")) {
      throw new Error("PASTX_METADATA_OUTPUT must be a valid non-empty file path.");
    }
    await writeFile(metadataOutputPath, metadata + "\n", { flag: "wx", mode: 0o600 });
    console.log("METADATA_CAPTURE " + JSON.stringify({
      file: metadataOutputPath,
      encoding: "0x-prefixed-hex",
      byteLength: metadataBytes.byteLength,
      sha256: createHash("sha256").update(metadataBytes).digest("hex")
    }));
  }
  const runtimeFingerprint = {
    specName: runtimeVersion.specName,
    specVersion: runtimeVersion.specVersion,
    transactionVersion: runtimeVersion.transactionVersion,
    metadataByteLength: metadataBytes.byteLength,
    metadataSha256: createHash("sha256").update(metadataBytes).digest("hex"),
    note: "Substrate runtime fingerprint only; does not prove EVM RPC support, asset enumeration semantics, wallet mapping, or settlement compatibility."
  };
  console.log("RUNTIME_FINGERPRINT " + JSON.stringify(runtimeFingerprint, null, 2));

  const observations = [];
  for (let i = 0; i < samplesCount; i++) {
    const [health, syncState, bestHash, finalizedHash] = await Promise.all([
      rpc("system_health"),
      rpc("system_syncState"),
      rpc("chain_getHead"),
      rpc("chain_getFinalizedHead")
    ]);
    if (!health || !Number.isInteger(health.peers) || typeof health.isSyncing !== "boolean") {
      throw new Error("Malformed system_health response.");
    }
    if (typeof bestHash !== "string" || typeof finalizedHash !== "string") {
      throw new Error("Malformed chain head hash response.");
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
      syncState,
      bestBlock: bestBlock.toString(),
      finalizedBlock: finalizedBlock.toString(),
      bestHash,
      finalizedHash,
      observedAt: new Date().toISOString()
    };
    observations.push(observation);
    console.log(JSON.stringify(observation, null, 2));
    if (i < samplesCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  const first = observations[0];
  const last = observations[observations.length - 1];
  const bestAdvanced = BigInt(last.bestBlock) > BigInt(first.bestBlock);
  const finalizedAdvanced = BigInt(last.finalizedBlock) > BigInt(first.finalizedBlock);
  const summary = {
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
    status: bestAdvanced && finalizedAdvanced ? "passed" :
      bestAdvanced || finalizedAdvanced ? "partial_progress_observed" : "no_progress_observed",
    note: "Read-only Substrate RPC checks. One endpoint's progress does not prove validator health, canonicality, runtime compatibility, EVM support, wallet mapping, asset interoperability, or settlement safety."
  };
  console.log("SUMMARY " + JSON.stringify(summary, null, 2));
  if (!bestAdvanced || !finalizedAdvanced) process.exitCode = 1;
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "unexpected error"))
  .finally(() => {
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  });
