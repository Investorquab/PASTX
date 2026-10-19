const hre = require("hardhat");
require("dotenv").config();

async function main() {
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
  const contract = await factory.deploy(relayer, 420420777, sourceEscrow);
  const receipt = await contract.deploymentTransaction().wait();
  await contract.waitForDeployment();

  const result = {
    network: "BNB Smart Chain testnet",
    chainId: network.chainId.toString(),
    contract: await contract.getAddress(),
    relayer,
    expectedSourceChainId: 420420777,
    expectedSourceEscrow: sourceEscrow,
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

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
