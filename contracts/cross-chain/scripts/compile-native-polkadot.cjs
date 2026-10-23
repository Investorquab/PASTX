"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { retainContractEntrypoints } = require(path.join(
  __dirname,
  "..",
  "native-polkadot",
  "scripts",
  "wasm-exports.cjs"
));

const packageRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(packageRoot, "..", "portaldot-v3", "native-solang");
const sourceDirectories = {
  PastxDemoToken: "pusd",
  PastxMarket: "market",
  PastxFaucet: "faucet",
  PastxStockToken: "stock-token"
};
const artifactRoot = path.join(packageRoot, "artifacts", "native-polkadot");
const cryptoModulePath = path.join(packageRoot, "native-polkadot", "node_modules", "@polkadot", "util-crypto");
const contractNames = [
  "PastxDemoToken",
  "PastxMarket",
  "PastxFaucet",
  "PastxStockToken"
];
const defaultCompiler = process.platform === "win32"
  ? path.join(os.tmpdir(), "pastx-solang-smoke", "solang.exe")
  : "solang";
const compiler = process.env.SOLANG_PATH || defaultCompiler;

function fail(message) {
  console.error("NATIVE_COMPILE_ERROR: " + message);
  process.exit(1);
}

if (!fs.existsSync(sourceRoot)) fail("Native source directory not found: " + sourceRoot);
if (!fs.existsSync(cryptoModulePath)) {
  fail("Native build dependencies are missing. Run npm run install:native:portal first so the rewritten WASM code hash can be calculated correctly.");
}
const { blake2AsHex } = require(cryptoModulePath);
if (typeof blake2AsHex !== "function") fail("@polkadot/util-crypto does not expose blake2AsHex.");

const sources = contractNames.map(name => path.join(sourceRoot, sourceDirectories[name], name + ".sol"));
for (const file of sources) {
  if (!fs.existsSync(file)) fail("Required source missing: " + file);
  const source = fs.readFileSync(file, "utf8");
  // Documentation comments may mention EVM-only features without invoking them.
  const executableSource = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  if (/\bblock\s*\.\s*chainid\b|\.\s*code\s*\.\s*length\b/.test(executableSource)) {
    fail(path.basename(file) + " contains an EVM-only builtin not allowed in the native target.");
  }
}

fs.rmSync(artifactRoot, { recursive: true, force: true });
fs.mkdirSync(artifactRoot, { recursive: true });

const args = ["compile", "--target", "polkadot", "--release", "-o", artifactRoot, ...sources];
console.log("Compiler: " + compiler);
console.log("Target: native Substrate Contracts pallet (Polkadot/SCALE)");
console.log("Source contracts: " + contractNames.join(", "));

const result = spawnSync(compiler, args, {
  cwd: packageRoot,
  stdio: "inherit",
  windowsHide: true
});

if (result.error) fail(result.error.message);
if (result.status !== 0) fail("Solang returned exit code " + result.status);

for (const name of contractNames) {
  const wasmPath = path.join(artifactRoot, name + ".wasm");
  const bundlePath = path.join(artifactRoot, name + ".contract");
  if (!fs.existsSync(wasmPath) || !fs.existsSync(bundlePath)) {
    fail("Expected both " + name + ".wasm and " + name + ".contract in " + artifactRoot);
  }

  let wasm = fs.readFileSync(wasmPath);
  if (wasm.length < 8 || wasm[0] !== 0x00 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6d) {
    fail(name + ".wasm does not have the WebAssembly magic header.");
  }

  const beforeExports = WebAssembly.Module.exports(new WebAssembly.Module(wasm)).map(entry => entry.name);
  let normalized;
  try {
    normalized = retainContractEntrypoints(wasm);
  } catch (error) {
    fail(name + ".wasm is not compatible with the Substrate Contracts export convention: " + error.message);
  }
  wasm = normalized.wasm;
  fs.writeFileSync(wasmPath, wasm);

  const metadata = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  if (!metadata.contract || !metadata.spec) {
    fail(name + ".contract is missing the expected contract/spec metadata.");
  }
  if (!metadata.source || typeof metadata.source.wasm !== "string") {
    fail(name + ".contract is missing source.wasm, so the compiled bundle cannot be kept in sync safely.");
  }

  // A .contract bundle embeds the WASM bytecode as source.wasm. Keep it byte
  // for byte consistent with the normalized deployable module and update its
  // Substrate Blake2-256 code hash after changing only the export table.
  metadata.source.wasm = wasm.toString("hex");
  metadata.source.hash = blake2AsHex(wasm, 256);
  fs.writeFileSync(bundlePath, JSON.stringify(metadata, null, 2) + "\n", "utf8");

  const verifiedBundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const bundledWasm = Buffer.from(verifiedBundle.source.wasm.replace(/^0x/i, ""), "hex");
  if (!bundledWasm.equals(wasm)) fail(name + ".contract source.wasm does not match the normalized .wasm file.");
  const exports = WebAssembly.Module.exports(new WebAssembly.Module(wasm));
  const exportNames = exports.map(entry => entry.name).sort();
  if (
    exportNames.length !== 2 ||
    exportNames[0] !== "call" ||
    exportNames[1] !== "deploy" ||
    exports.some(entry => entry.kind !== "function")
  ) {
    fail(name + ".wasm must export exactly the deploy and call functions.");
  }

  if (normalized.removed.length > 0) {
    console.log("NATIVE_EXPORTS_NORMALIZED " + name + ": removed " + normalized.removed.join(", "));
  }
  console.log("NATIVE_WASM_OK " + name + " (" + wasm.length + " bytes; exports: deploy, call)");
  console.log("NATIVE_CODE_HASH_OK " + name + " (" + metadata.source.hash + ")");
  if (beforeExports.length < 2) fail(name + ".wasm has fewer than the required contract exports.");
}

console.log("NATIVE_COMPILE_OK: all four core PASTX contracts compiled, normalized, and bundled for Substrate Contracts.");
