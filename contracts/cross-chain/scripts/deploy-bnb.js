const hre = require("hardhat");
const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config();
const { assertValueProbeEvidence } = require("./value-probe-evidence");
const { redactError } = require("./portal-network");

async function main() {
  if (process.env.PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED !== "true") {
    throw new Error("Deployment blocked until Portaldot EVM msg.value/native-value units have been independently verified.");
  }
  const maxDepositText = (process.env.PASTX_BRIDGE_MAX_DEPOSIT_RAW || "").trim();
  if (!/^[0-9]+$/.test(maxDepositText) || BigInt(maxDepositText) <= 0n) {
    throw new Error("Set PASTX_BRIDGE_MAX_DEPOSIT_RAW to a positive verified raw-unit value.");
  }
  const maxDepositRaw = BigInt(maxDepositText);
  assertValueProbeEvidence(maxDepositRaw);
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 97n) {
    throw new Error(`Refusing deployment: expected BNB Smart Chain testnet 97, received ${network.chainId}`);
  }

  const relayer = process.env.PASTX_BNB_RELAYER_ADDRESS;
  const sourceEscrow = process.env.PASTX_PORTALDOT_ESCROW_ADDRESS;
  if (!relayer || !hre.ethers.isAddress(relayer) || relayer === hre.ethers.ZeroAddress) {
    throw new Error("Set PASTX_BNB_RELAYER_ADDRESS to the funded BNB testnet relayer address.");
  }
  if (!sourceEscrow || !hre.ethers.isAddress(sourceEscrow) || sourceEscrow === hre.ethers.ZeroAddress) {
    throw new Error("Set PASTX_PORTALDOT_ESCROW_ADDRESS to the deployed PortalDOT V3 testnet escrow.");
  }

  const [deployer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractFactory("BnbTestnetGateway");
  const contract = await factory.deploy(relayer, 420420777, sourceEscrow, maxDepositRaw);
  const receipt = await contract.deploymentTransaction().wait();
  await contract.waitForDeployment();

  const result = {
    network: "BNB Smart Chain testnet",
    chainId: network.chainId.toString(),
    contract: await contract.getAddress(),
    relayer,
    expectedSourceChainId: 420420777,
    expectedSourceEscrow: sourceEscrow,
    maxDepositRaw: maxDepositRaw.toString(),
    deployer: deployer.address,
    deploymentTx: receipt.hash,
    deploymentBlock: receipt.blockNumber,
    stocks: ["AAPL-TEST", "TSLA-TEST", "NVDA-TEST", "MSFT-TEST"],
    note: "Mock stock positions and test units only; no real stock tokens, market liquidity, or redeemable value."
  };

  const seedAmount = process.env.PASTX_DEMO_MARKET_SEED_RAW;
  if (seedAmount) {
    if (!/^\d+$/.test(seedAmount) || BigInt(seedAmount) <= 0n) {
      throw new Error("PASTX_DEMO_MARKET_SEED_RAW must be a positive integer in raw 14-decimal units.");
    }
    const seedTx = await contract.seedTestMarketLiquidity(BigInt(seedAmount));
    const seedReceipt = await seedTx.wait();
    result.marketSeedTx = seedReceipt.hash;
    result.marketSeedRaw = seedAmount;
  }

  const outputRoot = path.resolve(
    process.env.PASTX_MASTER_DEPLOYMENT_OUTPUT_DIR ||
    path.join(__dirname, "..", "deployments", "all-testnet")
  );
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(path.join(outputRoot, "bnb-gateway.json"), JSON.stringify({ ...result, status: "deployed" }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(redactError(error));
  process.exitCode = 1;
});
