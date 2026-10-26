"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { spawnSync } = require("node:child_process");
require("dotenv").config();

const { HDNodeWallet, Wallet, getAddress } = require("ethers");
const { assertValueProbeEvidence, probeReportPath } = require("./value-probe-evidence");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const OUTPUT_ROOT = path.resolve(
  process.env.PASTX_MASTER_DEPLOYMENT_OUTPUT_DIR ||
  path.join(PACKAGE_ROOT, "deployments", "all-testnet")
);
const MARKET_OUTPUT_ROOT = path.join(OUTPUT_ROOT, "portal-market");
const PORTAL_CHAIN_ID = 420420777;
const BNB_CHAIN_ID = 97;
const EXPECTED_DEMO_CAP_RAW = 1_000_000_000_000n; // 0.01 tPOT if the confirmed runtime mapping is 14 decimals.

function fail(message) {
  throw new Error(message);
}

function requiredRaw(name) {
  const value = (process.env[name] || "").trim();
  if (!/^[0-9]+$/.test(value) || BigInt(value) <= 0n) fail("Set " + name + " to a positive raw-unit integer in contracts/cross-chain/.env.");
  return BigInt(value);
}

function requiredKey(name) {
  const value = (process.env[name] || "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) fail("Set " + name + " to a valid testnet-only EVM private key in local .env; never share it.");
  return value;
}

function requiredAddress(name) {
  const value = (process.env[name] || "").trim();
  try {
    if (!value) throw new Error("empty");
    return getAddress(value);
  } catch {
    fail("Set " + name + " to the expected non-zero EVM address in local .env.");
  }
}

function portalDeployerAddress() {
  const key = (process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY || "").trim();
  const mnemonic = (process.env.PORTALDOT_DEPLOYER_MNEMONIC || "").trim().split(/\s+/).filter(Boolean).join(" ");
  if (Boolean(key) === Boolean(mnemonic)) fail("Configure exactly one of PORTALDOT_DEPLOYER_PRIVATE_KEY or PORTALDOT_DEPLOYER_MNEMONIC.");
  if (key) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) fail("PORTALDOT_DEPLOYER_PRIVATE_KEY is malformed.");
    return new Wallet(key).address;
  }
  try {
    return HDNodeWallet.fromPhrase(mnemonic, "", "m/44'/60'/0'/0/0").address;
  } catch {
    fail("PORTALDOT_DEPLOYER_MNEMONIC cannot derive the expected SubWallet EVM path m/44'/60'/0'/0/0.");
  }
}

function validateConfiguration({ forDeploy = true } = {}) {
  if (forDeploy && process.env.PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED !== "true") {
    fail("Deployment disabled: first run the live Portaldot value probe, inspect its successful refund, and set PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED=true locally.");
  }
  const rate = requiredRaw("PASTX_ISWAP_NATIVE_RAW_PER_WHOLE_PUSD");
  const maxNative = requiredRaw("PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW");
  const seed = requiredRaw("PASTX_ISWAP_INITIAL_LIQUIDITY_RAW");
  const bridgeCap = requiredRaw("PASTX_BRIDGE_MAX_DEPOSIT_RAW");
  if (maxNative !== EXPECTED_DEMO_CAP_RAW) fail("This judge flow is fixed to exactly 0.01 tPOT raw units (1000000000000) after the 14-decimal mapping is confirmed.");
  if (rate * 1000n !== maxNative) fail("PASTX_ISWAP_NATIVE_RAW_PER_WHOLE_PUSD must quote 1,000 pUSD to the 0.01 tPOT demo cap.");
  if (seed !== maxNative) fail("PASTX_ISWAP_INITIAL_LIQUIDITY_RAW must equal the one-swap payout cap.");
  if (bridgeCap !== maxNative) fail("PASTX_BRIDGE_MAX_DEPOSIT_RAW must equal the iSwap cap for the judge round trip.");

  const portalAddress = portalDeployerAddress();
  const bnbDeployerKey = requiredKey("BNB_TESTNET_DEPLOYER_PRIVATE_KEY");
  const bnbAddress = new Wallet(bnbDeployerKey).address;
  const portalRelayerKey = requiredKey("PASTX_PORTALDOT_RELAYER_PRIVATE_KEY");
  const bnbRelayerKey = requiredKey("PASTX_BNB_RELAYER_PRIVATE_KEY");
  const portalRelayer = requiredAddress("PASTX_PORTAL_RELAYER_ADDRESS");
  const bnbRelayer = requiredAddress("PASTX_BNB_RELAYER_ADDRESS");
  if (new Wallet(portalRelayerKey).address.toLowerCase() !== portalRelayer.toLowerCase()) fail("Portaldot relayer key does not match PASTX_PORTAL_RELAYER_ADDRESS.");
  if (new Wallet(bnbRelayerKey).address.toLowerCase() !== bnbRelayer.toLowerCase()) fail("BNB relayer key does not match PASTX_BNB_RELAYER_ADDRESS.");

  const evidence = forDeploy ? assertValueProbeEvidence(maxNative, portalAddress) : null;
  return {
    portalAddress,
    bnbAddress,
    portalRelayer,
    bnbRelayer,
    rate,
    maxNative,
    seed,
    bridgeCap,
    evidencePath: probeReportPath(),
    probeDeployTx: evidence?.deployTxHash ?? null,
    probeObserveTx: evidence?.observeTxHash ?? null,
    probeReturnTx: evidence?.returnTxHash ?? null
  };
}

function runNpm(scriptName, env) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  console.log("\n$ npm run " + scriptName);
  const result = spawnSync(command, ["run", scriptName], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true
  });
  if (result.error) fail("Could not run npm script " + scriptName + ": " + result.error.message);
  if (result.status !== 0) fail("npm run " + scriptName + " exited with " + (result.status === null ? "no status" : result.status) + ".");
}

async function saveManifest(manifest) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_ROOT, "latest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function assertFreshOutput() {
  for (const file of [
    path.join(OUTPUT_ROOT, "latest.json"),
    path.join(OUTPUT_ROOT, "portal-escrow.json"),
    path.join(OUTPUT_ROOT, "bnb-gateway.json"),
    path.join(MARKET_OUTPUT_ROOT, "latest.json")
  ]) {
    if (fs.existsSync(file)) {
      fail("Existing deployment output detected at " + file + ". Inspect it and resume deliberately; this script will not redeploy over existing or partial records.");
    }
  }
}

async function main() {
  const preflightOnly = process.argv.includes("--preflight-only");
  const config = validateConfiguration({ forDeploy: !preflightOnly });
  if (!preflightOnly) assertFreshOutput();

  console.log("\nPASTX TESTNET DEPLOYMENT PREFLIGHT");
  console.log("----------------------------------");
  console.log("Portaldot EVM deployer: " + config.portalAddress);
  console.log("BNB testnet deployer:   " + config.bnbAddress);
  console.log("Portaldot relayer:      " + config.portalRelayer);
  console.log("BNB relayer:            " + config.bnbRelayer);
  console.log("Swap/bridge cap raw:    " + config.maxNative.toString());
  console.log("Value probe report:     " + config.evidencePath);
  if (config.probeDeployTx) {
    console.log("Probe transaction:      " + config.probeDeployTx);
    console.log("Probe observe tx:       " + config.probeObserveTx);
    console.log("Probe return tx:        " + config.probeReturnTx);
  } else {
    console.log("Value probe:            NOT REQUIRED FOR READ-ONLY ACCOUNT PREFLIGHT; deployment remains locked");
  }
  console.log("\nNext, read-only balance/network checks run on BOTH EVM networks. Positive balance does not guarantee enough gas for the complete multi-transaction deployment.");

  runNpm("preflight:market:portal", {});
  runNpm("preflight:bnb", {});
  if (process.argv.includes("--preflight-only")) {
    console.log("\nALL PREFLIGHTS PASSED. No deployment transactions were submitted.");
    return;
  }
  if (!stdin.isTTY) fail("Interactive terminal required. Run npm run preflight:all:testnet first, then deploy from a terminal with DEPLOY PASTX TESTNET confirmation.");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(
    "\nThis will submit several transactions on Portaldot V3 EVM and BNB testnet and spend gas plus 0.01 tPOT to fund iSwap. Type DEPLOY PASTX TESTNET to continue: "
  );
  rl.close();
  if (answer.trim() !== "DEPLOY PASTX TESTNET") {
    console.log("Cancelled. No deployment transaction was submitted.");
    return;
  }

  const manifest = {
    schemaVersion: 1,
    product: "PASTX iSwap + iBridge testnet bundle",
    status: "in-progress",
    startedAt: new Date().toISOString(),
    networks: {
      portaldot: { name: "Portaldot V3 EVM Testnet", chainId: String(PORTAL_CHAIN_ID), deployer: config.portalAddress },
      bnb: { name: "BNB Smart Chain Testnet", chainId: String(BNB_CHAIN_ID), deployer: config.bnbAddress }
    },
    verifiedValueProbe: {
      reportPath: config.evidencePath,
      rawAmount: config.maxNative.toString(),
      deployTxHash: config.probeDeployTx,
      observeTxHash: config.probeObserveTx,
      returnTxHash: config.probeReturnTx
    },
    steps: [],
    contracts: {},
    note: "This orchestrator deploys the Portaldot EVM market and iSwap, the Portaldot source escrow, and the BNB wrapped-token gateway. Native ink!/Solang contracts are alternative runtimes and are not deployed by this EVM bridge command. The trusted relayer is not started by this command."
  };
  let stage = "deploy Portaldot EVM market and iSwap";
  await saveManifest(manifest);
  try {
    runNpm("deploy:market:portal", {
      PASTX_DEPLOYMENT_OUTPUT_DIR: MARKET_OUTPUT_ROOT,
      PASTX_MASTER_DEPLOYMENT_OUTPUT_DIR: OUTPUT_ROOT
    });
    const marketPath = path.join(MARKET_OUTPUT_ROOT, "latest.json");
    const marketManifest = JSON.parse(await fs.readFile(marketPath, "utf8"));
    if (marketManifest.status !== "deployed-and-verified") fail("Portaldot market manifest is not verified; inspect " + marketPath);
    manifest.steps.push({ name: stage, status: "confirmed", manifest: marketPath });
    manifest.contracts.portaldotMarket = {
      token: marketManifest.contracts.demoToken,
      market: marketManifest.contracts.market,
      faucet: marketManifest.contracts.faucet,
      iSwap: marketManifest.contracts.iSwap,
      stocks: marketManifest.contracts.stocks
    };
    await saveManifest(manifest);

    stage = "deploy Portaldot bridge escrow";
    manifest.activeStage = stage;
    await saveManifest(manifest);
    runNpm("deploy:portal", { PASTX_MASTER_DEPLOYMENT_OUTPUT_DIR: OUTPUT_ROOT });
    const portalBridge = JSON.parse(await fs.readFile(path.join(OUTPUT_ROOT, "portal-escrow.json"), "utf8"));
    if (portalBridge.status !== "deployed" || !portalBridge.contract) fail("Portaldot escrow record is incomplete.");
    manifest.steps.push({ name: stage, status: "confirmed", deploymentTx: portalBridge.deploymentTx });
    manifest.contracts.portalEscrow = portalBridge;
    await saveManifest(manifest);

    stage = "deploy BNB wrapped-token gateway";
    manifest.activeStage = stage;
    await saveManifest(manifest);
    runNpm("deploy:bnb", {
      PASTX_MASTER_DEPLOYMENT_OUTPUT_DIR: OUTPUT_ROOT,
      PASTX_PORTALDOT_ESCROW_ADDRESS: portalBridge.contract
    });
    const bnbBridge = JSON.parse(await fs.readFile(path.join(OUTPUT_ROOT, "bnb-gateway.json"), "utf8"));
    if (bnbBridge.status !== "deployed" || !bnbBridge.contract || bnbBridge.expectedSourceEscrow.toLowerCase() !== portalBridge.contract.toLowerCase()) {
      fail("BNB gateway record does not match the newly deployed Portaldot escrow.");
    }
    manifest.steps.push({ name: stage, status: "confirmed", deploymentTx: bnbBridge.deploymentTx });
    manifest.contracts.bnbGateway = bnbBridge;
    manifest.status = "contracts-deployed-awaiting-relayer-and-round-trip-test";
    manifest.activeStage = null;
    manifest.finishedAt = new Date().toISOString();
    manifest.addressesFile = "addresses.md";
    manifest.frontendEnvFile = "frontend.env";
    const frontendEnv = [
      "# Generated public PASTX contract addresses for apps/web/.env.local",
      "VITE_PASTX_PORTALDOT_EVM_RPC_URL=" + (process.env.PORTALDOT_V3_EVM_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev"),
      "VITE_PASTX_BSC_TESTNET_RPC_URL=" + (process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-dataseed.bnbchain.org"),
      "VITE_PASTX_PORTAL_MARKET=" + market.market.address,
      "VITE_PASTX_PORTAL_TOKEN=" + market.token.address,
      "VITE_PASTX_PORTAL_FAUCET=" + market.faucet.address,
      "VITE_PASTX_PORTAL_ISWAP_ADDRESS=" + market.iSwap.address,
      "VITE_PASTX_PORTALDOT_ESCROW_ADDRESS=" + portalBridge.contract,
      "VITE_PASTX_BNB_GATEWAY_ADDRESS=" + bnbBridge.contract,
      "VITE_PASTX_BRIDGE_MAX_DEPOSIT_RAW=" + config.bridgeCap.toString(),
      "VITE_PASTX_SOURCE_VALUE_SEMANTICS_VERIFIED=true",
      ""
    ].join("\n");
    await fs.writeFile(path.join(OUTPUT_ROOT, "frontend.env"), frontendEnv, "utf8");
    await saveManifest(manifest);

    const market = manifest.contracts.portaldotMarket;
    const lines = [
      "# PASTX iSwap + iBridge Testnet Deployment",
      "",
      "- Status: " + manifest.status,
      "- Portaldot EVM chain ID: " + PORTAL_CHAIN_ID,
      "- BNB testnet chain ID: " + BNB_CHAIN_ID,
      "- Deployment started: " + manifest.startedAt,
      "- Deployment finished: " + manifest.finishedAt,
      "",
      "## Portaldot V3 EVM",
      "",
      "- pUSD: " + market.token.address + " (tx " + market.token.deploymentTransactionHash + ")",
      "- Market: " + market.market.address + " (tx " + market.market.deploymentTransactionHash + ")",
      "- Faucet: " + market.faucet.address + " (tx " + market.faucet.deploymentTransactionHash + ")",
      "- iSwap: " + market.iSwap.address + " (tx " + market.iSwap.deploymentTransactionHash + ")",
      "- Source bridge escrow: " + portalBridge.contract + " (tx " + portalBridge.deploymentTx + ")",
      "",
      "## BNB Smart Chain Testnet",
      "",
      "- wtPOTv3 bridge gateway: " + bnbBridge.contract + " (tx " + bnbBridge.deploymentTx + ")",
      "",
      "## Required next step",
      "",
      "Start the trusted relayer in DRY-RUN mode first, confirm both relayer keys match their contract roles and balances, then explicitly enable PASTX_RELAY_EXECUTE only for the testnet. This output does not claim that a bridge round trip has succeeded."
    ];
    await fs.writeFile(path.join(OUTPUT_ROOT, "addresses.md"), lines.join("\n") + "\n", "utf8");
    console.log("\nPASTX TESTNET CONTRACT DEPLOYMENTS COMPLETE");
    console.log("Master manifest: " + path.join(OUTPUT_ROOT, "latest.json"));
    console.log("Addresses: " + path.join(OUTPUT_ROOT, "addresses.md"));
    console.log("Public frontend env: " + path.join(OUTPUT_ROOT, "frontend.env"));
    console.log("Bridge contracts are deployed; relayer execution and the end-to-end round trip remain to be verified.");
  } catch (error) {
    manifest.status = manifest.activeStage ? "partial-failure-inspect-before-resume" : (manifest.steps.length ? "partial-failure-inspect-before-resume" : "failed-before-contract-deployment");
    manifest.failedStage = stage;
    manifest.failure = String(error instanceof Error ? error.message : error);
    manifest.finishedAt = new Date().toISOString();
    await saveManifest(manifest);
    throw error;
  }
}

main().catch(error => {
  console.error("\nPASTX MASTER DEPLOYMENT STOPPED: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
