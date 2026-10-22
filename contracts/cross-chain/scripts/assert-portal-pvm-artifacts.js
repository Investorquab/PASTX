const fs = require("node:fs");
const path = require("node:path");

const ARTIFACT_ROOT = path.resolve(__dirname, "..", "artifacts", "portal");
const PVM_PREFIX = "0x50564d00";
const REQUIRED_CONTRACTS = [
  "PastxDemoToken",
  "PastxFaucet",
  "PastxMarket",
  "PastxStockToken",
  "PortalDotTestnetEscrow"
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

function artifactBytecode(artifact) {
  if (typeof artifact.bytecode === "string") return artifact.bytecode;
  if (artifact.bytecode && typeof artifact.bytecode.object === "string") return artifact.bytecode.object;
  return "";
}

function main() {
  const files = findJsonFiles(ARTIFACT_ROOT);
  if (!files.length) {
    throw new Error("No PortalDOT artifacts found. Run compile:portal first; expected artifacts under " + ARTIFACT_ROOT);
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
    if (!matches.length) throw new Error("Required PortalDOT contract artifact missing: " + contractName);

    for (const { file, artifact } of matches) {
      const bytecode = artifactBytecode(artifact).toLowerCase();
      if (!bytecode.startsWith(PVM_PREFIX)) {
        const actualPrefix = bytecode ? bytecode.slice(0, 10) : "(empty bytecode)";
        throw new Error(
          contractName + " was not compiled to PolkaVM bytecode. Expected prefix " +
          PVM_PREFIX + ", got " + actualPrefix + " in " + file +
          ". Check that hardhat.portal.config.js uses polkadot: true."
        );
      }
      console.log("POLKAVM_OK " + contractName + " " + file);
    }
  }

  console.log("PortalDOT compiler target verified: all required artifacts use PolkaVM bytecode.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
