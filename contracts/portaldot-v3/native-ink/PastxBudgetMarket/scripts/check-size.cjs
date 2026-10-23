"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const wasmPath = path.join(ROOT, "target", "ink", "pastx_budget_market.wasm");
const bundlePath = path.join(ROOT, "target", "ink", "pastx_budget_market.contract");
const metadataPath = path.join(ROOT, "target", "ink", "pastx_budget_market.json");

// Last observed on PortaldotV3 Test on 2026-10-22. The live preflight reads
// runtime constants directly and remains authoritative if they change.
const OBSERVED_DEPOSIT_PER_BYTE_TPOT = 0.06;
const OBSERVED_DEPOSIT_PER_ITEM_TPOT = 0.15;
const TARGET_CODE_BUDGET_TPOT = 300;
const TOTAL_BUDGET_TPOT = 400;
const PROTECTED_RESERVE_TPOT = 1;

function fail(message) {
  console.error("BUNDLE_CHECK_ERROR: " + message);
  process.exit(1);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) fail("Missing " + label + ": " + filePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail("Invalid JSON in " + label + ": " + error.message);
  }
}

for (const [p, label] of [
  [wasmPath, "cargo-contract WASM"],
  [bundlePath, "deployable .contract bundle"],
  [metadataPath, "standalone ABI metadata"]
]) {
  if (!fs.existsSync(p)) fail("Missing " + label + ": " + p);
}

const wasm = fs.readFileSync(wasmPath);
if (
  wasm.length < 8 ||
  wasm[0] !== 0 ||
  wasm[1] !== 0x61 ||
  wasm[2] !== 0x73 ||
  wasm[3] !== 0x6d
) {
  fail("WASM does not have the WebAssembly magic header.");
}

let wasmModule;
try {
  wasmModule = new WebAssembly.Module(wasm);
} catch (error) {
  fail("WASM cannot be validated by the WebAssembly engine: " + error.message);
}

const wasmExports = WebAssembly.Module.exports(wasmModule);
const exportNames = wasmExports.map((entry) => entry.name).sort();
if (
  exportNames.length !== 2 ||
  exportNames[0] !== "call" ||
  exportNames[1] !== "deploy" ||
  wasmExports.some((entry) => entry.kind !== "function")
) {
  fail("cargo-contract output must expose exactly the function exports 'deploy' and 'call'. Found: " + exportNames.join(", "));
}

const bundle = readJson(bundlePath, "deployable .contract bundle");
const metadata = readJson(metadataPath, "standalone ABI metadata");

if (!bundle.source || typeof bundle.source.wasm !== "string") {
  fail(".contract bundle must embed source.wasm.");
}
if (!bundle.source.hash || typeof bundle.source.hash !== "string") {
  fail(".contract bundle is missing source.hash.");
}
if (!bundle.contract || typeof bundle.contract.name !== "string") {
  fail(".contract bundle is missing contract.name.");
}
if (!metadata.spec || !Array.isArray(metadata.spec.constructors) || !Array.isArray(metadata.spec.messages)) {
  fail("standalone ABI metadata is missing constructors/messages.");
}

const bundledHex = bundle.source.wasm.replace(/^0x/i, "");
if (!/^(?:[0-9a-fA-F]{2})+$/.test(bundledHex)) {
  fail(".contract source.wasm is not an even-length hex string.");
}
const bundledWasm = Buffer.from(bundledHex, "hex");
if (!bundledWasm.equals(wasm)) {
  fail("The .contract bundle's source.wasm does not match the actual .wasm file byte-for-byte.");
}
if (
  metadata.source?.hash !== bundle.source.hash ||
  metadata.contract?.name !== bundle.contract.name
) {
  fail("The standalone ABI metadata and .contract bundle do not come from the same build.");
}

const codeDepositTpot =
  wasm.length * OBSERVED_DEPOSIT_PER_BYTE_TPOT + OBSERVED_DEPOSIT_PER_ITEM_TPOT;
const remainingAfterCodeAndReserve =
  TOTAL_BUDGET_TPOT - codeDepositTpot - PROTECTED_RESERVE_TPOT;

const report = {
  contractName: bundle.contract.name,
  wasmBytes: wasm.length,
  exports: wasmExports.map((entry) => ({ name: entry.name, kind: entry.kind })),
  sourceCodeHash: bundle.source.hash,
  bundleMatchesWasm: true,
  standaloneMetadataMatchesBundle: true,
  abiConstructorCount: metadata.spec.constructors.length,
  abiMessageCount: metadata.spec.messages.length,
  observedDepositPerByteTpot: OBSERVED_DEPOSIT_PER_BYTE_TPOT,
  observedDepositPerItemTpot: OBSERVED_DEPOSIT_PER_ITEM_TPOT,
  estimatedCodeDepositTpot: Number(codeDepositTpot.toFixed(4)),
  targetCodeBudgetTpot: TARGET_CODE_BUDGET_TPOT,
  totalPlanningBudgetTpot: TOTAL_BUDGET_TPOT,
  protectedReserveTpot: PROTECTED_RESERVE_TPOT,
  estimatedBudgetAfterCodeDepositTpot: Number((TOTAL_BUDGET_TPOT - codeDepositTpot).toFixed(4)),
  estimatedBudgetAfterCodeAndProtectedReserveTpot: Number(remainingAfterCodeAndReserve.toFixed(4)),
  target300TpotCodeBudgetMet: codeDepositTpot <= TARGET_CODE_BUDGET_TPOT,
  bundleRole: "One compact ink! contract for the budget-constrained native demo; this workflow never deploys.",
  caveat: "This build gate estimates the uploaded-code deposit from the last-observed runtime rates. The live read-only preflight separately checks current runtime storage deposit, fees, signer balance, and reserve; the live quote is authoritative."
};

console.log(JSON.stringify(report, null, 2));

if (codeDepositTpot > TARGET_CODE_BUDGET_TPOT) {
  fail("Compact ink! WASM exceeds the 300 tPOT code-deposit target. Reduce the artifact size or re-evaluate the budget; do not deploy.");
}
if (remainingAfterCodeAndReserve <= 0) {
  fail("Code deposit plus the protected 1 tPOT reserve exceeds the 400 tPOT planning budget.");
}
