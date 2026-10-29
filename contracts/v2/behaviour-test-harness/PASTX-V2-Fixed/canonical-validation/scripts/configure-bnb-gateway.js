const { ethers, network } = require("hardhat");
const { chain, read } = require("./_common");
const { confirmDeployment } = require("./_confirm-deployment");

async function main() {
  if (network.name !== "bnbTestnet") {
    throw new Error("Use --network bnbTestnet");
  }
  await chain(97);

  const record = read("bnb-gateway");
  if (!record?.address || !ethers.isAddress(record.address)) {
    throw new Error("Missing or invalid deployments/bnb-gateway.json; refusing recovery.");
  }
  if (Number(record.chainId) !== 97) {
    throw new Error("Saved gateway record is not for BNB testnet chain ID 97.");
  }
  if (!record.wrappedPot || !ethers.isAddress(record.wrappedPot)) {
    throw new Error("Missing or invalid wrappedPot address in gateway record.");
  }
  if (!record.sourceEscrow || !ethers.isAddress(record.sourceEscrow)) {
    throw new Error("Missing or invalid sourceEscrow address in gateway record.");
  }
  if (Number(record.sourceNativeDecimals) !== 18) {
    throw new Error("Saved sourceNativeDecimals is not 18; refusing recovery.");
  }

  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();

  const [gatewayCode, wrappedPotCode] = await Promise.all([
    ethers.provider.getCode(record.address),
    ethers.provider.getCode(record.wrappedPot)
  ]);

  if (gatewayCode === "0x") {
    throw new Error("No contract code at the saved gateway address; refusing recovery.");
  }
  if (wrappedPotCode === "0x") {
    throw new Error("No contract code at the saved WrappedPot address; refusing recovery.");
  }

  const token = await ethers.getContractAt("WrappedPot", record.wrappedPot);
  const gateway = await ethers.getContractAt("BnbBridgeGateway", record.address);

  const [configuredGateway, decimals, sourceEscrow, wrappedPot] =
    await Promise.all([
      token.gateway(),
      gateway.sourceNativeDecimals(),
      gateway.sourceEscrow(),
      gateway.wrappedPot()
    ]);

  if (Number(decimals) !== 18) {
    throw new Error("Gateway sourceNativeDecimals mismatch.");
  }
  if (sourceEscrow.toLowerCase() !== record.sourceEscrow.toLowerCase()) {
    throw new Error("Gateway sourceEscrow does not match the saved record.");
  }
  if (wrappedPot.toLowerCase() !== record.wrappedPot.toLowerCase()) {
    throw new Error("Gateway wrappedPot does not match the saved record.");
  }

  if (configuredGateway.toLowerCase() === record.address.toLowerCase()) {
    console.log("Recovery not needed: WrappedPot already points to the saved gateway.");
    return;
  }

  if (configuredGateway !== ethers.ZeroAddress) {
    throw new Error(
      `WrappedPot points to a different gateway (${configuredGateway}); refusing to overwrite it.`
    );
  }

  const gas = await token.setGateway.estimateGas(record.address);
  const fees = await ethers.provider.getFeeData();
  const price = fees.maxFeePerGas ?? fees.gasPrice;
  const balance = await ethers.provider.getBalance(deployer);
  const gasLimit = gas * 120n / 100n;

  if (!price || balance < gasLimit * price) {
    throw new Error("Insufficient balance or fee data; no configuration transaction sent.");
  }

  await confirmDeployment({
    network: network.name,
    chainId: 97,
    deployer,
    actions: [
      `Configure existing WrappedPot ${record.wrappedPot} to use saved gateway ${record.address}; no contract deployment`
    ]
  });

  // This is the only transaction this recovery script can send.
  const tx = await token.setGateway(record.address, { gasLimit });
  console.log(`setGateway tx=${tx.hash}; estimatedGas=${gas}`);

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("setGateway failed; inspect the transaction and current on-chain state.");
  }

  const verified = await token.gateway();
  if (verified.toLowerCase() !== record.address.toLowerCase()) {
    throw new Error("Post-transaction gateway readback mismatch.");
  }

  console.log("Recovery successful: WrappedPot points to the saved gateway.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
