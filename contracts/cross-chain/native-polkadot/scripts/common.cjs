"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { CodePromise, ContractPromise } = require("@polkadot/api-contract");
const { Keyring } = require("@polkadot/keyring");
const { cryptoWaitReady } = require("@polkadot/util-crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CROSS_CHAIN_ROOT = path.resolve(PACKAGE_ROOT, "..");
const ARTIFACT_ROOT = path.join(CROSS_CHAIN_ROOT, "artifacts", "native-polkadot");
const DEPLOYMENT_ROOT = path.join(CROSS_CHAIN_ROOT, "deployments", "native-polkadot");
const RPC_URL = (process.env.PORTALDOT_NATIVE_WS_RPC_URL || "wss://test-node-v3.portaldot.dev").trim();
const EXPECTED_CHAIN = (process.env.PORTALDOT_NATIVE_EXPECTED_CHAIN || "PortaldotV3 Test").trim();
const EXPECTED_ADDRESS = (process.env.PORTALDOT_NATIVE_EXPECTED_ADDRESS || "").trim();
const EXPECTED_GENESIS_HASH = (process.env.PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH || "").trim().toLowerCase();
const RESERVE_TOKENS = (process.env.PORTALDOT_NATIVE_KEEP_RESERVE || "1").trim();

const CONTRACT_NAMES = ["PastxDemoToken", "PastxMarket", "PastxFaucet", "PastxStockToken"];

function fail(message) {
  throw new Error(message);
}

function redact(message) {
  let output = String(message instanceof Error ? message.message : message);
  const secrets = [
    process.env.PORTALDOT_NATIVE_DEPLOYER_MNEMONIC,
    process.env.PORTALDOT_DEPLOYER_MNEMONIC,
    process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY
  ];
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join("[REDACTED]");
  }
  return output.replace(/wss?:\/\/\S+/g, "[RPC endpoint redacted]");
}

function parseUnits(value, decimals) {
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) fail("Invalid positive token amount: " + text);
  const parts = text.split(".");
  if ((parts[1] || "").length > decimals) fail("Too many decimal places in amount: " + text);
  const fraction = (parts[1] || "").padEnd(decimals, "0");
  return BigInt(parts[0]) * (10n ** BigInt(decimals)) + BigInt(fraction || "0");
}

function formatUnits(rawValue, decimals, maxFraction = 4) {
  const value = BigInt(rawValue);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  let fraction = (value % base).toString().padStart(decimals, "0");
  fraction = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return whole.toString() + (fraction ? "." + fraction : "");
}

function bigint(value) {
  if (value === undefined || value === null) return 0n;
  if (typeof value.toBigInt === "function") return value.toBigInt();
  return BigInt(value.toString());
}

function getStorageCharge(storageDeposit) {
  if (!storageDeposit) return 0n;
  if (storageDeposit.isCharge === true && storageDeposit.asCharge !== undefined) {
    return bigint(storageDeposit.asCharge);
  }
  const json = typeof storageDeposit.toJSON === "function"
    ? storageDeposit.toJSON()
    : storageDeposit;
  if (json && typeof json === "object") {
    const key = Object.keys(json).find(name => name.toLowerCase() === "charge");
    if (key !== undefined) return bigint(json[key]);
  }
  return 0n;
}

function weightParts(value) {
  if (!value || value.refTime === undefined || value.proofSize === undefined) {
    fail("This runtime did not return a WeightV2 value (refTime/proofSize).");
  }
  return { refTime: bigint(value.refTime), proofSize: bigint(value.proofSize) };
}

function maxBlockWeight(api) {
  const maximum = api.consts.system?.blockWeights?.maxBlock;
  if (!maximum) fail("Runtime does not expose system.blockWeights.maxBlock; refusing to guess gas limits.");
  const parts = weightParts(maximum);
  return api.registry.createType("WeightV2", {
    refTime: (parts.refTime * 90n) / 100n,
    proofSize: (parts.proofSize * 90n) / 100n
  });
}

function bufferedWeight(api, required, percent) {
  const parts = weightParts(required);
  const maximum = weightParts(api.consts.system.blockWeights.maxBlock);
  const refTime = (parts.refTime * percent + 99n) / 100n;
  const proofSize = (parts.proofSize * percent + 99n) / 100n;
  if (refTime > maximum.refTime || proofSize > maximum.proofSize) {
    fail("Dry-run gas plus the safety margin exceeds the block weight limit; no transaction was submitted.");
  }
  return api.registry.createType("WeightV2", { refTime, proofSize });
}

function contractFiles(name) {
  const metadataPath = path.join(ARTIFACT_ROOT, name + ".contract");
  const wasmPath = path.join(ARTIFACT_ROOT, name + ".wasm");
  if (!fs.existsSync(metadataPath) || !fs.existsSync(wasmPath)) {
    fail("Missing native artifacts for " + name + ". Run npm run compile:native:portal first.");
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const wasm = fs.readFileSync(wasmPath);
  if (!metadata.contract || !metadata.spec || wasm.length < 8 ||
      wasm[0] !== 0 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6d) {
    fail("Invalid native WASM or metadata for " + name + ".");
  }
  return { metadataPath, wasmPath, metadata, wasm };
}

function loadAllArtifacts() {
  return Object.fromEntries(CONTRACT_NAMES.map(name => [name, contractFiles(name)]));
}

async function connectNative(options = {}) {
  const mnemonic = (
    process.env.PORTALDOT_NATIVE_DEPLOYER_MNEMONIC ||
    process.env.PORTALDOT_DEPLOYER_MNEMONIC ||
    ""
  ).trim().split(/\s+/).filter(Boolean).join(" ");
  if (!mnemonic) {
    fail("Set PORTALDOT_NATIVE_DEPLOYER_MNEMONIC or PORTALDOT_DEPLOYER_MNEMONIC in the local contracts/cross-chain/.env file.");
  }

  await cryptoWaitReady();
  const api = await ApiPromise.create({ provider: new WsProvider(RPC_URL) });
  try {
    await api.isReady;
    const chain = (await api.rpc.system.chain()).toString();
    if (chain !== EXPECTED_CHAIN) {
      fail("Unexpected native chain name. Expected '" + EXPECTED_CHAIN + "' but received '" + chain + "'.");
    }
    if (!api.tx.contracts?.instantiateWithCode || !api.tx.contracts?.call) {
      fail("The connected runtime does not expose the required contracts pallet calls.");
    }

    const keyring = new Keyring({
      type: "sr25519",
      ss58Format: api.registry.chainSS58 ?? 42
    });
    const signer = keyring.addFromUri(mnemonic);
    if (EXPECTED_ADDRESS && signer.address !== EXPECTED_ADDRESS) {
      fail("The native mnemonic does not derive PORTALDOT_NATIVE_EXPECTED_ADDRESS. No transactions were submitted.");
    }

    const [genesisHash, header, runtimeVersion, account] = await Promise.all([
      api.rpc.chain.getBlockHash(0),
      api.rpc.chain.getHeader(),
      api.rpc.state.getRuntimeVersion(),
      api.query.system.account(signer.address)
    ]);

    const genesisHashHex = genesisHash.toHex().toLowerCase();
    if (EXPECTED_GENESIS_HASH && genesisHashHex !== EXPECTED_GENESIS_HASH) {
      fail("Native genesis hash does not match PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH. No transactions were submitted.");
    }
    if (options.requireGenesisPin && !EXPECTED_GENESIS_HASH) {
      fail("Before deployment, run the native preflight, verify its genesis hash against the official Portaldot V3 testnet details, then set PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH in local .env. No transactions were submitted.");
    }

    const decimals = Number(api.registry.chainDecimals?.[0] ?? 14);
    const symbol = String(api.registry.chainTokens?.[0] ?? "tPOT");
    const free = bigint(account.data.free);
    const reserved = bigint(account.data.reserved);
    const frozen = [
      account.data.frozen,
      account.data.feeFrozen,
      account.data.miscFrozen
    ].filter(Boolean).map(bigint).reduce((a, b) => a > b ? a : b, 0n);
    const spendable = free > frozen ? free - frozen : 0n;
    const nonce = bigint(account.nonce);
    const context = {
      api,
      signer,
      chain,
      genesisHash: genesisHash.toHex(),
      genesisPinned: Boolean(EXPECTED_GENESIS_HASH),
      blockNumber: bigint(header.number).toString(),
      specVersion: bigint(runtimeVersion.specVersion).toString(),
      decimals,
      symbol,
      free,
      reserved,
      frozen,
      spendable,
      nonce,
      endpoint: RPC_URL
    };
    return context;
  } catch (error) {
    await api.disconnect().catch(() => {});
    throw error;
  }
}

async function dryRunConstructor(context, artifacts, args, salt) {
  const code = new CodePromise(context.api, artifacts.metadata, artifacts.wasm);
  if (typeof code.tx?.new !== "function") {
    fail("Solang metadata does not expose the expected 'new' constructor for " + artifacts.metadata.contract.name + ".");
  }

  // CodePromise exposes constructor extrinsics under tx, not query. Build a
  // draft extrinsic to ABI-encode constructor args, then use the Contracts
  // runtime API to perform a read-only instantiation dry-run.
  const saltBytes = Uint8Array.from(Buffer.from(salt, "utf8"));
  const draftTx = code.tx.new(
    {
      value: 0,
      gasLimit: maxBlockWeight(context.api),
      storageDepositLimit: null,
      salt: saltBytes
    },
    ...args
  );
  const callArgs = draftTx.method?.args;
  if (!callArgs || callArgs.length < 6) {
    fail("Could not read the encoded instantiate_with_code arguments from Polkadot.js for " + artifacts.metadata.contract.name + ".");
  }

  const instantiate = context.api.call?.contractsApi?.instantiate;
  if (typeof instantiate !== "function") {
    fail("The endpoint does not expose api.call.contractsApi.instantiate; cannot safely dry-run a native constructor.");
  }

  let uploadCode;
  try {
    uploadCode = context.api.registry.createType(
      "PalletContractsPrimitivesCode",
      { upload: "0x" + artifacts.wasm.toString("hex") }
    );
  } catch (error) {
    fail("Unable to encode native upload code for constructor dry-run: " + error.message);
  }

  // instantiate_with_code arguments are [value, gas_limit, storage_limit,
  // code, data, salt]. Use ABI-encoded data from CodePromise, but invoke the
  // non-state-changing Contracts runtime API for the quote.
  const query = await instantiate(
    context.signer.address,
    0,
    maxBlockWeight(context.api),
    null,
    uploadCode,
    callArgs[4],
    callArgs[5]
  );

  if (!query?.result?.isOk) {
    const result = query?.result;
    let detail = result?.asErr?.toString?.() || result?.toString?.() || "unknown contract execution error";
    if (query?.debugMessage && query.debugMessage.toString()) {
      detail += "; debug: " + query.debugMessage.toString();
    }
    fail("Constructor dry-run failed for " + artifacts.metadata.contract.name + ": " + detail);
  }

  const gasLimit = bufferedWeight(context.api, query.gasRequired, 125n);
  const storageCharge = getStorageCharge(query.storageDeposit);
  const storageDepositLimit = storageCharge === 0n ? 0n : (storageCharge * 125n + 99n) / 100n;
  const tx = code.tx.new(
    { value: 0, gasLimit, storageDepositLimit, salt: saltBytes },
    ...args
  );
  const payment = await tx.paymentInfo(context.signer);
  return {
    code,
    query,
    tx,
    gasLimit,
    storageCharge,
    storageDepositLimit,
    fee: bigint(payment.partialFee),
    gasRequired: weightParts(query.gasRequired)
  };
}

async function dryRunMessage(context, contract, methodName, args) {
  const queryMethod = contract.query[methodName];
  const txMethod = contract.tx[methodName];
  if (typeof queryMethod !== "function" || typeof txMethod !== "function") {
    fail("Contract metadata does not expose message '" + methodName + "'.");
  }
  const query = await queryMethod(
    context.signer.address,
    {
      value: 0,
      gasLimit: maxBlockWeight(context.api),
      storageDepositLimit: null
    },
    ...args
  );
  if (!query.result?.isOk) {
    fail("Message dry-run failed for " + methodName + ": " +
      (query.result?.asErr?.toString?.() || query.result?.toString?.() || "unknown contract execution error"));
  }
  const gasLimit = bufferedWeight(context.api, query.gasRequired, 125n);
  const storageCharge = getStorageCharge(query.storageDeposit);
  const storageDepositLimit = storageCharge === 0n ? 0n : (storageCharge * 125n + 99n) / 100n;
  const tx = txMethod(
    { value: 0, gasLimit, storageDepositLimit },
    ...args
  );
  const payment = await tx.paymentInfo(context.signer);
  return {
    query,
    tx,
    gasLimit,
    storageCharge,
    storageDepositLimit,
    fee: bigint(payment.partialFee),
    gasRequired: weightParts(query.gasRequired)
  };
}

function reserveAmount(decimals) {
  return parseUnits(RESERVE_TOKENS, decimals);
}

function checkBudget(context, quote, step) {
  const reserve = reserveAmount(context.decimals);
  const storageBudget = quote.storageDepositLimit ?? quote.storageCharge;
  const needed = quote.fee + storageBudget + reserve;
  if (context.spendable < needed) {
    fail(
      step + " is not safely funded. Spendable balance: " +
      formatUnits(context.spendable, context.decimals, 6) + " " + context.symbol +
      "; estimated fee: " + formatUnits(quote.fee, context.decimals, 6) +
      "; estimated storage deposit: " + formatUnits(quote.storageCharge, context.decimals, 6) +
      "; protected reserve: " + formatUnits(reserve, context.decimals, 6) +
      ". No transaction was submitted for this step."
    );
  }
  return { reserve, needed };
}

async function getAccountState(context) {
  const account = await context.api.query.system.account(context.signer.address);
  const free = bigint(account.data.free);
  const reserved = bigint(account.data.reserved);
  const frozen = [
    account.data.frozen,
    account.data.feeFrozen,
    account.data.miscFrozen
  ].filter(Boolean).map(bigint).reduce((a, b) => a > b ? a : b, 0n);
  return {
    free,
    reserved,
    frozen,
    spendable: free > frozen ? free - frozen : 0n,
    nonce: bigint(account.nonce)
  };
}

function deploymentId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function manifestPath(runId) {
  return path.join(DEPLOYMENT_ROOT, runId, "deployment.json");
}

function saveJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function outputError(error) {
  console.error(redact(error));
}

module.exports = {
  ARTIFACT_ROOT,
  CONTRACT_NAMES,
  DEPLOYMENT_ROOT,
  EXPECTED_ADDRESS,
  EXPECTED_CHAIN,
  EXPECTED_GENESIS_HASH,
  RPC_URL,
  checkBudget,
  connectNative,
  contractFiles,
  deploymentId,
  dryRunConstructor,
  dryRunMessage,
  fail,
  formatUnits,
  getAccountState,
  getStorageCharge,
  loadAllArtifacts,
  manifestPath,
  maxBlockWeight,
  outputError,
  parseUnits,
  reserveAmount,
  saveJson,
  redact
};
