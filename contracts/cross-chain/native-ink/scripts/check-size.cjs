"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { retainContractEntrypoints } = require(path.join(
  __dirname,
  "..",
  "..",
  "native-polkadot",
  "scripts",
  "wasm-exports.cjs"
));

const ROOT = path.resolve(__dirname, "..");
const wasmPath = path.join(ROOT, "target", "ink", "pastx_budget_market.wasm");

// Observed from PortaldotV3 Test runtime at specVersion 3002 on 2026-10-22.
// depositPerByte = 6,000,000,000,000 raw units; token decimals = 14.
// Therefore the observed code deposit was 0.06 tPOT per uploaded WASM byte.
const OBSERVED_DEPOSIT_PER_BYTE = 0.06;
const TARGET_BUDGET_TPOT = 300;
const BALANCE_BUDGET_TPOT = 400;
const REQUIRED_RESERVE_TPOT = 75;

function fail(message) {
  console.error("SIZE_CHECK_ERROR: " + message);
  process.exit(1);
}

if (!fs.existsSync(wasmPath)) fail("Missing size-optimized WASM: " + wasmPath);

const initialWasm = fs.readFileSync(wasmPath);
const beforeExports = WebAssembly.Module.exports(
  new WebAssembly.Module(initialWasm)
).map((entry) => entry.name);

let normalized;
try {
  normalized = retainContractEntrypoints(initialWasm);
} catch (error) {
  fail("Compiled ink! WASM is not compatible with the Substrate Contracts entrypoint convention: " + error.message);
}

const wasm = normalized.wasm;
fs.writeFileSync(wasmPath, wasm);
const wasmModule = new WebAssembly.Module(wasm);
const exports = WebAssembly.Module.exports(wasmModule);
const exportNames = exports.map((entry) => entry.name).sort();

const deposit = wasm.length * OBSERVED_DEPOSIT_PER_BYTE;
const maxBytesAtTarget = Math.floor(TARGET_BUDGET_TPOT / OBSERVED_DEPOSIT_PER_BYTE);
const maxBytesAtBalance = Math.floor(BALANCE_BUDGET_TPOT / OBSERVED_DEPOSIT_PER_BYTE);
const maxBytesAfterReserve = Math.floor(
  (BALANCE_BUDGET_TPOT - REQUIRED_RESERVE_TPOT) / OBSERVED_DEPOSIT_PER_BYTE
);

console.log(JSON.stringify({
  contract: "PastxBudgetMarket",
  wasmBytesBeforeExportNormalization: initialWasm.length,
  wasmBytes: wasm.length,
  exportsBeforeNormalization: beforeExports,
  exportsAfterNormalization: exports.map((entry) => ({ name: entry.name, kind: entry.kind })),
  removedExports: normalized.removed,
  observedDepositPerByteTpot: OBSERVED_DEPOSIT_PER_BYTE,
  estimatedCodeDepositTpot: Number(deposit.toFixed(4)),
  budget300TpotMaxBytesBeforeOtherCosts: maxBytesAtTarget,
  budget400TpotMaxBytesBeforeOtherCosts: maxBytesAtBalance,
  budget400TpotWith75TpotReserveMaxBytesBeforeStorageDataAndFees: maxBytesAfterReserve,
  target300TpotMet: deposit <= TARGET_BUDGET_TPOT,
  budget400TpotWith75TpotReserveMet: deposit <= BALANCE_BUDGET_TPOT - REQUIRED_RESERVE_TPOT,
  artifactRole: "Size-feasibility experiment only; not a deployable .contract bundle and not deployment authorization.",
  note: "Estimate uses the observed PortaldotV3 Test deposit constant. It excludes contract storage entries, fees, and runtime changes."
}, null, 2));

if (
  exportNames.length !== 2 ||
  exportNames[0] !== "call" ||
  exportNames[1] !== "deploy" ||
  exports.some((entry) => entry.kind !== "function")
) {
  fail("WASM must export exactly function entry points deploy and call.");
}
