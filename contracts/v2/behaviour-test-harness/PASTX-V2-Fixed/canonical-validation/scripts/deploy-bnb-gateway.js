const { ethers, network } = require("hardhat");
const { chain, deploy, read, save } = require("./_common");
const { confirmDeployment } = require("./_confirm-deployment");

async function main() {
  if (network.name !== "bnbTestnet") {
    throw new Error("Use --network bnbTestnet");
  }
  await chain(97);

  const w = read("bnb-wrapped-pot");
  const p = read("portaldot-escrow");
  if (!w?.address || !p?.address) {
    throw new Error("Deploy WrappedPot and PortalDot escrow first; required deployment JSON files are missing.");
  }
  if (!ethers.isAddress(w.address) || !ethers.isAddress(p.address)) {
    throw new Error("Invalid wrapped-token or source-escrow address in deployment records.");
  }

  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();
  const relayer = process.env.PASTX_BNB_RELAYER_ADDRESS;
  if (!ethers.isAddress(relayer || "") || relayer === ethers.ZeroAddress) {
    throw new Error("Set PASTX_BNB_RELAYER_ADDRESS in project-root .env");
  }

  const token = await ethers.getContractAt("WrappedPot", w.address);
  const currentGateway = await token.gateway();

  if (currentGateway !== ethers.ZeroAddress) {
    throw new Error(
      currentGateway.toLowerCase() === (read("bnb-gateway")?.address || "").toLowerCase()
        ? "A gateway is already configured. Verify the existing deployment instead of deploying a duplicate."
        : `WrappedPot already has a gateway configured (${currentGateway}); refusing to overwrite it.`
    );
  }

  const existingRecord = read("bnb-gateway");
  if (existingRecord?.address) {
    throw new Error(
      "A saved gateway deployment record exists but WrappedPot is not configured. Verify the record and use configure-bnb-gateway.js; refusing duplicate deployment."
    );
  }

  await confirmDeployment({
    network: network.name,
    chainId: 97,
    deployer,
    actions: [
      `Deploy BnbBridgeGateway; relayer = ${relayer}; wrapped token = ${w.address}; source escrow = ${p.address}; source chain ID = 420420777; source decimals = 18`,
      `After deployment, call WrappedPot.setGateway(new gateway address) on ${w.address}`
    ]
  });

  const d = await deploy("BnbBridgeGateway", [
    deployer,
    relayer,
    w.address,
    420420777,
    p.address,
    18
  ]);

  const gateway = await ethers.getContractAt("BnbBridgeGateway", d.address);

  if ((await gateway.sourceNativeDecimals()) !== 18n) {
    throw new Error("sourceNativeDecimals is not 18");
  }
  if ((await gateway.sourceEscrow()).toLowerCase() !== p.address.toLowerCase()) {
    throw new Error("Escrow address mismatch");
  }
  if ((await gateway.wrappedPot()).toLowerCase() !== w.address.toLowerCase()) {
    throw new Error("Wrapped token mismatch");
  }

  // Persist the deployed gateway before configuration so a failed setGateway
  // transaction does not lose the address needed for recovery.
  const deploymentRecord = {
    ...d,
    wrappedPot: w.address,
    sourceEscrow: p.address,
    sourceNativeDecimals: 18
  };
  save("bnb-gateway", deploymentRecord);
  console.log("Saved gateway deployment record before token configuration.");

  const gas = await token.setGateway.estimateGas(d.address);
  const fees = await ethers.provider.getFeeData();
  const price = fees.maxFeePerGas ?? fees.gasPrice;
  const balance = await ethers.provider.getBalance(deployer);
  const gasLimit = gas * 120n / 100n;

  if (!price || balance < gasLimit * price) {
    throw new Error("Insufficient balance or fee data for setGateway; gateway was deployed but token configuration was not sent.");
  }

  const tx = await token.setGateway(d.address, { gasLimit });
  console.log(`setGateway tx=${tx.hash}; estimatedGas=${gas}`);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("setGateway transaction failed");
  }

  if ((await token.gateway()).toLowerCase() !== d.address.toLowerCase()) {
    throw new Error("Gateway readback mismatch");
  }

  console.log("Gateway configured and verified. Deployment record: deployments/bnb-gateway.json");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
