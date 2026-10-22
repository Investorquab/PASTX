"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const wasmPath = path.join(ROOT, "target", "ink", "pastx_budget_market.wasm");
const bundlePath = path.join(ROOT, "target", "ink", "pastx_budget_market.contract");

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

if (!fs.existsSync(wasmPath)) fail("Missing release WASM: " + wasmPath);
if (!fs.existsSync(bundlePath)) fail("Missing .contract bundle: " + bundlePath);

const wasm = fs.readFileSync(wasmPath);
const module = new WebAssembly.Module(wasm);
const exports = WebAssembly.Module.exports(module);
const exportNames = exports.map((entry) => entry.name).sort();

const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
if (!bundle.source || typeof bundle.source.wasm !== "string") {
  fail("Contract bundle does not contain source.wasm.");
}
const bundledWasm = Buffer.from(bundle.source.wasm.replace(/^0x/i, ""), "hex");
if (!bundledWasm.equals(wasm)) fail("The .contract bundle's WASM differs from the .wasm file.");

const deposit = wasm.length * OBSERVED_DEPOSIT_PER_BYTE;
const maxBytesAtTarget = Math.floor(TARGET_BUDGET_TPOT / OBSERVED_DEPOSIT_PER_BYTE);
const maxBytesAtBalance = Math.floor(BALANCE_BUDGET_TPOT / OBSERVED_DEPOSIT_PER_BYTE);
const maxBytesAfterReserve = Math.floor(
  (BALANCE_BUDGET_TPOT - REQUIRED_RESERVE_TPOT) / OBSERVED_DEPOSIT_PER_BYTE
);

console.log(JSON.stringify({
  contract: "PastxBudgetMarket",
  wasmBytes: wasm.length,
  exports: exports.map((entry) => ({ name: entry.name, kind: entry.kind })),
  codeHash: bundle.source.hash || null,
  bundleMatchesWasm: true,
  observedDepositPerByteTpot: OBSERVED_DEPOSIT_PER_BYTE,
  estimatedCodeDepositTpot: Number(deposit.toFixed(4)),
  budgetFor300TpotMaxBytesBeforeOtherCosts: maxBytesAtTarget,
  "budgetFor400TpotMaxBytesBeforeOtherCosts": maxBytesAtBalance,
  "budgetFor400TpotWith75TpotReserveMaxBytesBeforeStorageDataAndFees": maxBytesAfterReserve,
  target300TpotMet: deposit <= TARGET_BUDGET_TPOT,
  budget400TpotWith75TpotReserveMet: deposit <= BALANCE_BUDGET_TPOT - REQUIRED_RESERVE_TPOT,
  note: "Estimate uses the observed testnet deposit constant. It excludes contract storage entries, transaction fees, and any runtime changes."
}, null, 2));

if (
  exportNames.length !== 2 ||
  exportNames[0] !== "call" ||
  exportNames[1] !== "deploy" ||
  exports.some((entry) => entry.kind !== "function")
) {
  fail("WASM must export exactly function entry points deploy and call.");
}
