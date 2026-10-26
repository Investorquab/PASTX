const fs = require("node:fs");
const path = require("node:path");

const ARTIFACT_ROOT = path.resolve(__dirname, "..", "artifacts", "portal");
const REQUIRED_CONTRACTS = [
  "PastxDemoToken",
  "PastxFaucet",
  "PastxISwap",
  "PastxMarket",
  "PastxStockToken",
  "PortalDotTestnetEscrow",
  "PortalValueSemanticsProbe"
];

function findJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findJsonFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".json")) found.push(fullPath);
  }
  return found;
}

function getBytecode(artifact) {
  if (typeof artifact.bytecode === "string") return artifact.bytecode.toLowerCase();
  if (artifact.bytecode && typeof artifact.bytecode.object === "string") {
    const object = artifact.bytecode.object;
    return (object.startsWith("0x") ? object : "0x" + object).toLowerCase();
  }
  return "";
}

function main() {
  const files = findJsonFiles(ARTIFACT_ROOT);
  if (!files.length) {
    throw new Error("No Portaldot EVM artifacts found. Run compile:portal first; expected artifacts under " + ARTIFACT_ROOT);
  }

  const artifacts = files.map(file => {
    try {
      return { file, artifact: JSON.parse(fs.readFileSync(file, "utf8")) };
    } catch (error) {
      throw new Error("Could not parse artifact " + file + ": " + String(error));
    }
  });

  for (const contractName of REQUIRED_CONTRACTS) {
    const matches = artifacts.filter(({ artifact }) => artifact.contractName === contractName);
    if (!matches.length) throw new Error("Required Portaldot contract artifact missing: " + contractName);

    for (const { file, artifact } of matches) {
      const bytecode = getBytecode(artifact);
      if (!/^0x[0-9a-f]+$/.test(bytecode) || bytecode === "0x") {
        throw new Error(contractName + " has empty or malformed EVM bytecode in " + file);
      }
      if (bytecode.startsWith("0x50564d00")) {
        throw new Error(contractName + " contains PolkaVM bytecode, but this build targets standard EVM. Check hardhat.portal.config.js.");
      }
      // Valid Solidity creation bytecode may begin with different PUSH opcodes
      // (for example 0x61 or 0x62) as code size changes. Do not require a single
      // opcode; reject the known PolkaVM magic above and malformed/empty EVM hex.
      if (bytecode.length < 10 || !/^0x[0-9a-f]+$/.test(bytecode)) {
        throw new Error(contractName + " does not contain usable EVM bytecode in " + file);
      }
      console.log("EVM_BYTECODE_OK " + contractName + " " + file + " (" + bytecode.slice(0, 10) + ")");
    }
  }

  console.log("Portaldot EVM target verified: all required artifacts contain standard Solidity EVM bytecode.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
