"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const packageRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(packageRoot, "contracts", "native-polkadot");
const artifactRoot = path.join(packageRoot, "artifacts", "native-polkadot");
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
const sources = contractNames.map(name => path.join(sourceRoot, name + ".sol"));
for (const file of sources) {
  if (!fs.existsSync(file)) fail("Required source missing: " + file);
  const source = fs.readFileSync(file, "utf8");
  if (/block\.chainid|\.code\.length/.test(source)) {
    fail(path.basename(file) + " contains an EVM-only builtin not allowed in the native target.");
  }
}

fs.rmSync(artifactRoot, { recursive: true, force: true });
fs.mkdirSync(artifactRoot, { recursive: true });

const args = ["compile", "--target", "polkadot", "-o", artifactRoot, ...sources];
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

  const wasm = fs.readFileSync(wasmPath);
  if (wasm.length < 8 || wasm[0] !== 0x00 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6d) {
    fail(name + ".wasm does not have the WebAssembly magic header.");
  }

  const metadata = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  if (!metadata.contract || !metadata.spec) {
    fail(name + ".contract is missing the expected contract/spec metadata.");
  }
  console.log("NATIVE_WASM_OK " + name + " (" + wasm.length + " bytes)");
}

console.log("NATIVE_COMPILE_OK: all four core PASTX contracts compiled to WASM.");
