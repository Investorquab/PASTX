"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ApiPromise, WsProvider } = require(path.resolve(__dirname, "../../native-polkadot/node_modules/@polkadot/api"));
const { CodePromise } = require(path.resolve(__dirname, "../../native-polkadot/node_modules/@polkadot/api-contract"));
const { Keyring } = require(path.resolve(__dirname, "../../native-polkadot/node_modules/@polkadot/keyring"));
const { cryptoWaitReady } = require(path.resolve(__dirname, "../../native-polkadot/node_modules/@polkadot/util-crypto"));
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const ROOT = path.resolve(__dirname, "..");
const CROSS_CHAIN_ROOT = path.resolve(ROOT, "..");
const ARTIFACT_DIR = path.join(ROOT, "target", "ink");
const WASM_PATH = path.join(ARTIFACT_DIR, "pastx_budget_market.wasm");
const BUNDLE_PATH = path.join(ARTIFACT_DIR, "pastx_budget_market.contract");

function fail(message) {
  throw new Error(message);
}

function bigint(value) {
  if (value === undefined || value === null) return 0n;
  if (typeof value.toBigInt === "function") return value.toBigInt();
  return BigInt(value.toString());
}

function parseUnits(value, decimals) {
  const source = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(source)) fail("Invalid token amount: " + source);
  const parts = source.split(".");
  if ((parts[1] || "").length > decimals) fail("Too many decimal places in token amount.");
  return BigInt(parts[0]) * (10n ** BigInt(decimals)) +
    BigInt((parts[1] || "").padEnd(decimals, "0") || "0");
}

function formatUnits(raw, decimals, maxFraction = 6) {
  const value = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  return whole.toString() + (fraction ? "." + fraction : "");
}

function weightParts(value) {
  if (!value || value.refTime === undefined || value.proofSize === undefined) {
    fail("Portaldot did not return WeightV2 (refTime/proofSize); refusing to guess gas.");
  }
  return { refTime: bigint(value.refTime), proofSize: bigint(value.proofSize) };
}

function maxBlockWeight(api) {
  const maximum = api.consts.system?.blockWeights?.maxBlock;
  if (!maximum) fail("Runtime does not expose system.blockWeights.maxBlock.");
  const parts = weightParts(maximum);
  return api.registry.createType("WeightV2", {
    refTime: parts.refTime * 90n / 100n,
    proofSize: parts.proofSize * 90n / 100n
  });
}

function bufferedWeight(api, required) {
  const req = weightParts(required);
  const max = weightParts(api.consts.system.blockWeights.maxBlock);
  const refTime = (req.refTime * 125n + 99n) / 100n;
  const proofSize = (req.proofSize * 125n + 99n) / 100n;
  if (refTime > max.refTime || proofSize > max.proofSize) {
    fail("Constructor gas plus 25% buffer exceeds the block limit.");
  }
  return api.registry.createType("WeightV2", { refTime, proofSize });
}

function storageCharge(storageDeposit) {
  if (!storageDeposit) return 0n;
  if (storageDeposit.isCharge === true && storageDeposit.asCharge !== undefined) {
    return bigint(storageDeposit.asCharge);
  }
  const json = typeof storageDeposit.toJSON === "function"
    ? storageDeposit.toJSON()
    : storageDeposit;
  if (json && typeof json === "object") {
    const key = Object.keys(json).find((name) => name.toLowerCase() === "charge");
    if (key !== undefined) return bigint(json[key]);
  }
  return 0n;
}

function readArtifacts() {
  if (!fs.existsSync(WASM_PATH) || !fs.existsSync(BUNDLE_PATH)) {
    fail(
      "Missing cargo-contract artifacts. Extract pastx_budget_market.wasm and " +
      "pastx_budget_market.contract from the successful GitHub Actions artifact into " +
      "contracts/cross-chain/native-ink/target/ink/. This script never builds or deploys."
    );
  }
  const wasm = fs.readFileSync(WASM_PATH);
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8"));
  if (!bundle.source || typeof bundle.source.wasm !== "string" || !bundle.source.hash) {
    fail("The .contract bundle is missing source.wasm or source.hash.");
  }
  const hex = bundle.source.wasm.replace(/^0x/i, "");
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex) || !Buffer.from(hex, "hex").equals(wasm)) {
    fail("The .contract bundle WASM does not exactly match the standalone .wasm file.");
  }
  const exports = WebAssembly.Module.exports(new WebAssembly.Module(wasm));
  const names = exports.map((entry) => entry.name).sort();
  if (
    names.length !== 2 ||
    names[0] !== "call" ||
    names[1] !== "deploy" ||
    exports.some((entry) => entry.kind !== "function")
  ) {
    fail("WASM must expose exactly the deploy and call function exports.");
  }
  return { wasm, bundle };
}

function dispatchError(api, result) {
  const error = result?.asErr;
  if (error?.isModule) {
    const meta = api.registry.findMetaError(error.asModule);
    return meta.section + "." + meta.name + (meta.docs?.length ? ": " + meta.docs.join(" ") : "");
  }
  return error?.toString?.() || result?.toString?.() || "unknown runtime error";
}

async function main() {
  const mnemonic = (
    process.env.PORTALDOT_NATIVE_DEPLOYER_MNEMONIC ||
    process.env.PORTALDOT_DEPLOYER_MNEMONIC ||
    ""
  ).trim().split(/\s+/).filter(Boolean).join(" ");
  if (!mnemonic) {
    fail("Set PORTALDOT_NATIVE_DEPLOYER_MNEMONIC or PORTALDOT_DEPLOYER_MNEMONIC in the local contracts/cross-chain/.env.");
  }

  const { wasm, bundle } = readArtifacts();
  await cryptoWaitReady();

  const rpcUrl = (process.env.PORTALDOT_NATIVE_WS_RPC_URL || "wss://test-node-v3.portaldot.dev").trim();
  const expectedChain = (process.env.PORTALDOT_NATIVE_EXPECTED_CHAIN || "PortaldotV3 Test").trim();
  const expectedAddress = (process.env.PORTALDOT_NATIVE_EXPECTED_ADDRESS || "").trim();
  const api = await ApiPromise.create({ provider: new WsProvider(rpcUrl) });

  try {
    await api.isReady;
    const chain = (await api.rpc.system.chain()).toString();
    if (chain !== expectedChain) {
      fail("Unexpected chain. Expected '" + expectedChain + "' but received '" + chain + "'.");
    }

    const keyring = new Keyring({
      type: "sr25519",
      ss58Format: api.registry.chainSS58 ?? 42
    });
    const signer = keyring.addFromUri(mnemonic);
    if (expectedAddress && signer.address !== expectedAddress) {
      fail("Derived native address differs from PORTALDOT_NATIVE_EXPECTED_ADDRESS. No transaction was submitted.");
    }

    const [genesisHash, account, runtimeVersion] = await Promise.all([
      api.rpc.chain.getBlockHash(0),
      api.query.system.account(signer.address),
      api.rpc.state.getRuntimeVersion()
    ]);

    const decimals = Number(api.registry.chainDecimals?.[0] ?? 14);
    const symbol = String(api.registry.chainTokens?.[0] ?? "tPOT");
    const free = bigint(account.data.free);
    const frozen = [
      account.data.frozen,
      account.data.feeFrozen,
      account.data.miscFrozen
    ].filter(Boolean).map(bigint).reduce((a, b) => a > b ? a : b, 0n);
    const spendable = free > frozen ? free - frozen : 0n;
    const keepReserve = parseUnits(process.env.PORTALDOT_NATIVE_KEEP_RESERVE || "1", decimals);

    const perByte = api.consts.contracts?.depositPerByte;
    const perItem = api.consts.contracts?.depositPerItem;
    if (!perByte || !perItem) fail("Runtime contract deposit constants are unavailable.");

    const estimatedCodeDeposit = bigint(perByte) * BigInt(wasm.length) + bigint(perItem);
    const report = {
      status: "read-only-preflight",
      transactionsSent: false,
      deploymentAttempted: false,
      chain,
      runtimeSpecVersion: runtimeVersion.specVersion.toString(),
      genesisHash: genesisHash.toHex(),
      nativeAddress: signer.address,
      nativeBalance: formatUnits(free, decimals) + " " + symbol,
      spendableBalance: formatUnits(spendable, decimals) + " " + symbol,
      contractName: bundle.contract?.name || "unknown",
      wasmBytes: wasm.length,
      sourceCodeHash: bundle.source.hash,
      runtimeDepositPerByte: formatUnits(bigint(perByte), decimals, decimals),
      runtimeDepositPerItem: formatUnits(bigint(perItem), decimals, decimals),
      estimatedCodeDeposit: formatUnits(estimatedCodeDeposit, decimals) + " " + symbol,
      configuredProtectedReserve: formatUnits(keepReserve, decimals) + " " + symbol
    };
    console.log(JSON.stringify(report, null, 2));

    if (spendable < estimatedCodeDeposit + keepReserve) {
      fail(
        "This signer cannot cover the estimated code deposit plus its protected reserve. " +
        "Fund the displayed native address or configure the intended funded account in local .env; " +
        "do not share mnemonic/private keys. No constructor dry-run or transaction was submitted."
      );
    }

    const code = new CodePromise(api, bundle, wasm);
    if (typeof code.tx?.new !== "function") fail("ABI bundle does not expose the default new() constructor.");

    const salt = Uint8Array.from(Buffer.from("PASTX-BUDGET-MARKET-PREFLIGHT", "utf8"));
    const draft = code.tx.new({
      value: 0,
      gasLimit: maxBlockWeight(api),
      storageDepositLimit: null,
      salt
    });
    const args = draft.method?.args;
    if (!args || args.length < 6) fail("Could not read constructor arguments from the generated extrinsic.");

    const instantiate = api.call?.contractsApi?.instantiate;
    if (typeof instantiate !== "function") {
      fail("Read-only contractsApi.instantiate is unavailable on this endpoint.");
    }

    const uploadCode = api.registry.createType(
      "PalletContractsPrimitivesCode",
      { upload: "0x" + wasm.toString("hex") }
    );

    const query = await instantiate(
      signer.address,
      0,
      maxBlockWeight(api),
      null,
      uploadCode,
      args[4],
      args[5]
    );

    if (!query?.result?.isOk) {
      fail("Constructor dry-run failed: " + dispatchError(api, query?.result));
    }

    const gasLimit = bufferedWeight(api, query.gasRequired);
    const charge = storageCharge(query.storageDeposit);
    // The runtime's storageDeposit may include the uploaded code deposit. Avoid double-counting it when it is already at least the code-size estimate; otherwise conservatively add the code estimate and the returned charge.
    const totalStorageDeposit = charge >= estimatedCodeDeposit
      ? charge
      : estimatedCodeDeposit + charge;
    const depositLimit = totalStorageDeposit === 0n ? 0n : (totalStorageDeposit * 125n + 99n) / 100n;
    const tx = code.tx.new({ value: 0, gasLimit, storageDepositLimit: depositLimit, salt });
    const payment = await tx.paymentInfo(signer);
    const fee = bigint(payment.partialFee);
    const totalBeforeReserve = totalStorageDeposit + fee;
    const finalReport = {
      status: "read-only-constructor-dry-run-passed",
      transactionsSent: false,
      deploymentAttempted: false,
      constructorGasRequired: {
        refTime: bigint(query.gasRequired.refTime).toString(),
        proofSize: bigint(query.gasRequired.proofSize).toString()
      },
      runtimeDryRunStorageDeposit: formatUnits(charge, decimals) + " " + symbol,
      estimatedCombinedStorageDeposit: formatUnits(totalStorageDeposit, decimals) + " " + symbol,
      storageDepositLimitWithBuffer: formatUnits(depositLimit, decimals) + " " + symbol,
      estimatedTransactionFee: formatUnits(fee, decimals) + " " + symbol,
      estimatedCodeDeposit: formatUnits(estimatedCodeDeposit, decimals) + " " + symbol,
      configuredProtectedReserve: formatUnits(keepReserve, decimals) + " " + symbol,
      estimatedTotalStorageAndFee: formatUnits(totalBeforeReserve, decimals) + " " + symbol,
      estimatedBalanceAfterCostsAndReserve: formatUnits(spendable - totalBeforeReserve - keepReserve, decimals) + " " + symbol,
      genesisHash: genesisHash.toHex(),
      note: "This is a read-only estimate. Deployment still requires a separate explicitly run and reviewed transaction workflow."
    };
    console.log(JSON.stringify(finalReport, null, 2));

    if (spendable < totalBeforeReserve + keepReserve) {
      fail("Dry-run estimates would breach the protected reserve. No transaction was submitted.");
    }
  } finally {
    await api.disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exitCode = 1;
});
