const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 420420777n) {
    throw new Error(`Refusing deployment: expected PortalDOT V3 testnet 420420777, received ${network.chainId}`);
  }

  const relayer = process.env.PASTX_PORTAL_RELAYER_ADDRESS;
  if (!relayer || !hre.ethers.isAddress(relayer) || relayer === hre.ethers.ZeroAddress) {
    throw new Error("Set PASTX_PORTAL_RELAYER_ADDRESS to the funded testnet relayer address.");
  }

  const [deployer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractFactory("PortalDotTestnetEscrow");
  const contract = await factory.deploy(relayer, 97);
  const receipt = await contract.deploymentTransaction().wait();
  await contract.waitForDeployment();

  console.log(JSON.stringify({
    network: "PortalDOT V3 testnet",
    chainId: network.chainId.toString(),
    contract: await contract.getAddress(),
    relayer,
    destinationChainId: 97,
    deployer: deployer.address,
    deploymentTx: receipt.hash,
    deploymentBlock: receipt.blockNumber,
    note: "Testnet only; raw tPOT EVM value semantics must be verified before sending any amount."
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
