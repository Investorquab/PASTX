#!/usr/bin/env node
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Read-only Portaldot V3 TESTNET asset/precompile state inspection.
 *
 * This script is deliberately pinned to one observed runtime fingerprint.
 * It pages a small, fixed number of metadata/precompile-map entries at a
 * finalized block. It never signs, creates an extrinsic, submits a call, or
 * reads per-account balances.
 *
 * Runtime API module path is supplied by the workflow:
 * PASTX_POLKADOT_API_ENTRY=/tmp/.../node_modules/@polkadot/api/index.js
 */
const ENDPOINT = "wss://test-node-v3.portaldot.dev";
const EXPECTED_CHAIN = "PortaldotV3 Test";
const EXPECTED_SPEC_NAME = "portaldot-v3";
const EXPECTED_SPEC_VERSION = 3002;
const EXPECTED_TRANSACTION_VERSION = 2;
const EXPECTED_METADATA_SHA256 = "942ea1b81eaed81273d95ae263d0002595fcf95183df77ce5114248c35efcda3";
const PAGE_SIZE = 25;
const MAX_STRING_LENGTH = 512;
const MAX_OBJECT_FIELDS = 32;

function fail(message) {
  console.error("Portaldot V3 TESTNET asset-state check failed: " + message);
  process.exitCode = 1;
}

function firstLower(value) {
  return value.length ? value[0].toLowerCase() + value.slice(1) : value;
}

function bounded(value, depth = 0) {
  if (depth > 4) return "[depth-limited]";
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? value.slice(0, MAX_STRING_LENGTH) + "…[truncated]"
      : value;
  }
  if (Array.isArray(value)) {
    const result = value.slice(0, MAX_OBJECT_FIELDS).map(item => bounded(item, depth + 1));
    if (value.length > MAX_OBJECT_FIELDS) result.push("[items-truncated]");
    return result;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    const result = {};
    for (const [key, item] of entries.slice(0, MAX_OBJECT_FIELDS)) {
      result[String(key)] = bounded(item, depth + 1);
    }
    if (entries.length > MAX_OBJECT_FIELDS) result._truncated = true;
    return result;
  }
  return value;
}

function toHuman(value) {
  if (value && typeof value.toHuman === "function") {
    return bounded(value.toHuman());
  }
  return bounded(value);
}

async function fetchRawMetadataHex(endpoint, blockHash) {
  const socket = new WebSocket(endpoint);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Raw metadata WebSocket connection timed out")), 8000);
      socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Raw metadata WebSocket connection failed")); }, { once: true });
    });

    const payload = await new Promise((resolve, reject) => {
      const id = 1;
      const timeout = setTimeout(() => reject(new Error("Raw state_getMetadata request timed out")), 8000);
      const onMessage = event => {
        let message;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (message.id !== id) return;
        clearTimeout(timeout);
        socket.removeEventListener("message", onMessage);
        if (message.jsonrpc !== "2.0") reject(new Error("Raw metadata request returned an invalid JSON-RPC version"));
        else if (message.error) reject(new Error("Raw state_getMetadata failed: " + JSON.stringify(message.error)));
        else if (typeof message.result !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(message.result)) {
          reject(new Error("Raw state_getMetadata returned malformed hex metadata"));
        } else {
          resolve(message.result);
        }
      };
      socket.addEventListener("message", onMessage);
      socket.send(JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "state_getMetadata",
        params: [blockHash]
      }));
    });
    return payload;
  } finally {
    if (socket.readyState < WebSocket.CLOSING) socket.close();
  }
}

async function main() {
  const moduleEntry = process.env.PASTX_POLKADOT_API_ENTRY;
  if (!moduleEntry || !path.isAbsolute(moduleEntry)) {
    throw new Error("PASTX_POLKADOT_API_ENTRY must point to the installed @polkadot/api entry file.");
  }

  // Dynamic import uses the temporary, workflow-installed tool dependency.
  // No @polkadot/api dependency is added to the PASTX product/runtime packages.
  const { ApiPromise, WsProvider } = await import(pathToFileURL(moduleEntry).href);
  if (typeof ApiPromise?.create !== "function" || typeof WsProvider !== "function") {
    throw new Error("The installed @polkadot/api entry did not expose ApiPromise and WsProvider.");
  }

  const provider = new WsProvider(ENDPOINT);
  let api;
  try {
    api = await ApiPromise.create({ provider, noInitWarn: true });

    const chain = (await api.rpc.system.chain()).toString();
    if (chain !== EXPECTED_CHAIN) {
      throw new Error("Unexpected chain label: expected " + EXPECTED_CHAIN + ", received " + JSON.stringify(chain));
    }

    const finalizedHash = await api.rpc.chain.getFinalizedHead();
    const finalizedHeader = await api.rpc.chain.getHeader(finalizedHash);
    const runtimeVersion = await api.rpc.state.getRuntimeVersion(finalizedHash);
    const metadata = await api.rpc.state.getMetadata(finalizedHash);
    const metadataHex = metadata.toHex();
    const metadataBytes = Buffer.from(metadataHex.slice(2), "hex");
    const metadataSha256 = createHash("sha256").update(metadataBytes).digest("hex");
    const specName = runtimeVersion.specName.toString();
    const specVersion = runtimeVersion.specVersion.toNumber();
    const transactionVersion = runtimeVersion.transactionVersion.toNumber();
    const meta = metadata.asLatest;
    const pallets = [...meta.pallets];
    const requested = [
      { pallet: "Assets", item: "Asset", kind: "asset-catalogue" },
      { pallet: "Assets", item: "Metadata", kind: "asset-metadata" },
      { pallet: "Assets", item: "NextAssetId", kind: "asset-next-id" },
      { pallet: "PoolAssets", item: "Asset", kind: "pool-asset-catalogue" },
      { pallet: "PoolAssets", item: "Metadata", kind: "pool-asset-metadata" },
      { pallet: "PoolAssets", item: "NextAssetId", kind: "pool-asset-next-id" },
      { pallet: "AssetConversion", item: "Pools", kind: "asset-conversion-pools" },
      { pallet: "AssetsPrecompiles", item: "AssetIndexToForeignAssetId", kind: "precompile-index-to-asset" },
      { pallet: "AssetsPrecompiles", item: "ForeignAssetIdToAssetIndex", kind: "precompile-asset-to-index" }
    ];

    const rawMetadataHex = await fetchRawMetadataHex(ENDPOINT, finalizedHash.toHex());
    const rawMetadataBytes = Buffer.from(rawMetadataHex.slice(2), "hex");
    const rawMetadataSha256 = createHash("sha256").update(rawMetadataBytes).digest("hex");
    const schemaSummary = requested.map(spec => {
      const pallet = pallets.find(entry => entry.name.toString() === spec.pallet);
      const storage = pallet?.storage && pallet.storage.isSome ? pallet.storage.unwrap() : null;
      const item = storage ? [...storage.items].find(entry => entry.name.toString() === spec.item) : null;
      return {
        pallet: spec.pallet,
        palletIndex: pallet ? Number(pallet.index.toString()) : null,
        item: spec.item,
        present: Boolean(item),
        type: item ? (item.type.isPlain ? "plain" : item.type.isMap ? "map" : item.type.toString()) : null,
        keyType: item?.type.isMap ? item.type.asMap.key.toString() : null,
        valueType: item?.type.isMap ? item.type.asMap.value.toString() :
          item?.type.isPlain ? item.type.asPlain.toString() : null
      };
    });

    const observedFingerprint = {
      chain,
      finalizedBlock: finalizedHeader.number.toString(),
      finalizedHash: finalizedHash.toHex(),
      nodeVersion: (await api.rpc.system.version()).toString(),
      specName,
      specVersion,
      transactionVersion,
      rawRpcMetadata: {
        byteLength: rawMetadataBytes.byteLength,
        sha256: rawMetadataSha256,
        prefix: rawMetadataHex.slice(0, 18)
      },
      apiDecodedMetadata: {
        byteLength: metadataBytes.byteLength,
        sha256: metadataSha256,
        prefix: metadataHex.slice(0, 18)
      },
      rawAndApiMetadataBytesMatch: rawMetadataHex.toLowerCase() === metadataHex.toLowerCase(),
      palletCount: pallets.length,
      portableTypeCount: meta.types.types.length,
      selectedStorageSchema: schemaSummary
    };
    console.log("OBSERVED_RUNTIME_METADATA " + JSON.stringify(observedFingerprint, null, 2));

    if (rawMetadataHex.toLowerCase() !== metadataHex.toLowerCase()) {
      throw new Error(
        "Raw state_getMetadata bytes differ from the API-decoded metadata bytes at the same finalized block; refusing storage queries."
      );
    }
    if (specName !== EXPECTED_SPEC_NAME || specVersion !== EXPECTED_SPEC_VERSION ||
        transactionVersion !== EXPECTED_TRANSACTION_VERSION || rawMetadataSha256 !== EXPECTED_METADATA_SHA256) {
      throw new Error(
        "Runtime fingerprint changed; refusing to decode state with stale assumptions. " +
        JSON.stringify({ chain, specName, specVersion, transactionVersion, metadataSha256: rawMetadataSha256 })
      );
    }

    const apiAt = await api.at(finalizedHash);
    const storageResults = [];


    function numericIndex(value) {
      return typeof value === "number" ? value : value.toNumber();
    }

    function findStorage(palletName, itemName) {
      const pallet = pallets.find(item => item.name.toString() === palletName);
      if (!pallet) return { found: false, reason: "pallet_missing_from_metadata" };
      if (!pallet.storage || pallet.storage.isNone) {
        return { found: false, reason: "pallet_has_no_storage_metadata", palletIndex: numericIndex(pallet.index) };
      }
      const storage = pallet.storage.unwrap();
      const item = [...storage.items].find(entry => entry.name.toString() === itemName);
      if (!item) {
        return { found: false, reason: "storage_item_missing_from_metadata", palletIndex: numericIndex(pallet.index) };
      }
      return { found: true, pallet, item, palletIndex: numericIndex(pallet.index) };
    }

    for (const spec of requested) {
      const definition = findStorage(spec.pallet, spec.item);
      if (!definition.found) {
        throw new Error(
          "Expected runtime storage item " + spec.pallet + "." + spec.item +
          " is not present in the pinned metadata (" + definition.reason + "); refusing to interpret state."
        );
      }

      const sectionName = firstLower(spec.pallet);
      const methodName = firstLower(spec.item);
      const section = apiAt.query[sectionName];
      const query = section?.[methodName];
      if (typeof query !== "function") {
        throw new Error(
          "Metadata contains " + spec.pallet + "." + spec.item +
          " but the API did not decorate a matching read-only query method."
        );
      }

      const base = {
        ...spec,
        palletIndex: definition.palletIndex,
        storageType: definition.item.type.isPlain ? "plain" :
          definition.item.type.isMap ? "map" : "other",
        keyTypeDescription: definition.item.type.isMap
          ? definition.item.type.asMap.key.toString()
          : null,
        valueTypeDescription: definition.item.type.isMap
          ? definition.item.type.asMap.value.toString()
          : definition.item.type.isPlain
            ? definition.item.type.asPlain.toString()
            : null
      };

      if (definition.item.type.isPlain) {
        const value = await query();
        storageResults.push({
          ...base,
          status: "read",
          value: toHuman(value)
        });
        continue;
      }

      if (!definition.item.type.isMap || typeof query.entriesPaged !== "function") {
        throw new Error(
          "Expected " + spec.pallet + "." + spec.item +
          " to be a readable storage map; refusing an unbounded or unsupported query."
        );
      }

      // Keep scans bounded. This captures at most one page and doesn't attempt
      // global enumeration of every asset or precompile mapping.
      const entries = await query.entriesPaged({ args: [], pageSize: PAGE_SIZE });
      storageResults.push({
        ...base,
        status: "read",
        entriesReturned: entries.length,
        pageSizeLimit: PAGE_SIZE,
        possibleAdditionalEntries: entries.length === PAGE_SIZE,
        entries: entries.map(([key, value]) => ({
          keyArgs: key.args.map(arg => toHuman(arg)),
          value: toHuman(value)
        }))
      });
    }

    const headerNumber = finalizedHeader.number.toString();
    const health = toHuman(await api.rpc.system.health());
    const summary = {
      status: "passed",
      scope: "Portaldot V3 TESTNET, read-only storage inspection",
      endpoint: ENDPOINT,
      snapshot: {
        chain,
        finalizedBlock: headerNumber,
        finalizedHash: finalizedHash.toHex(),
        nodeVersion: (await api.rpc.system.version()).toString(),
        runtime: {
          specName,
          specVersion,
          transactionVersion
        },
        metadata: {
          format: "FRAME metadata V14",
          byteLength: metadataBytes.byteLength,
          sha256: metadataSha256,
          palletCount: pallets.length,
          portableTypeCount: meta.types.types.length
        },
        health: {
          peers: health.peers,
          isSyncing: health.isSyncing
        }
      },
      inspectionLimits: {
        maxEntriesPerMap: PAGE_SIZE,
        maxStringLength: MAX_STRING_LENGTH,
        queriedPerAccountBalances: false,
        walletAccess: false,
        signing: false,
        transactionsOrExtrinsics: false,
        storageWrites: false
      },
      storage: storageResults,
      note: "Presence or contents of generic runtime asset/precompile storage do not prove listed-stock representation, correct EVM address derivation, legal ownership, wallet mapping, price validity, trading safety, or settlement compatibility."
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (api) {
      await api.disconnect();
    } else {
      await provider.disconnect();
    }
  }
}

main().catch(error => {
  fail(error instanceof Error ? error.message : "unexpected error");
});
