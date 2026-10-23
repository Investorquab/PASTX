const hre = require("hardhat");
const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config();
const { assertPortalTestnet, redactError } = require("./portal-network");
const { assertValueProbeEvidence } = require("./value-probe-evidence");

async function main() {
  if (process.env.PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED !== "true") {
    throw new Error("Deployment blocked: first verify Portaldot EVM msg.value/native-value units with a small test and set PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED=true locally.");
  }
  const maxDepositText = (process.env.PASTX_BRIDGE_MAX_DEPOSIT_RAW || "").trim();
  const iswapCapText = (process.env.PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW || "").trim();
  if (!/^[0-9]+$/.test(maxDepositText) || BigInt(maxDepositText) <= 0n) throw new Error("Set PASTX_BRIDGE_MAX_DEPOSIT_RAW to a positive raw-unit cap after verifying native-value semantics.");
  if (maxDepositText !== iswapCapText) throw new Error("PASTX_BRIDGE_MAX_DEPOSIT_RAW must equal PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW for the 0.01 demo flow.");
  const maxDepositRaw = BigInt(maxDepositText);
  const preflight = await assertPortalTestnet(hre);
  assertValueProbeEvidence(maxDepositRaw, preflight.signer.address);
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
  const contract = await factory.deploy(relayer, 97, maxDepositRaw);
  const receipt = await contract.deploymentTransaction().wait();
  await contract.waitForDeployment();

  const result = {
    network: "PortalDOT V3 testnet",
    chainId: network.chainId.toString(),
    contract: await contract.getAddress(),
    relayer,
    destinationChainId: 97,
    maxDepositRaw: maxDepositRaw.toString(),
    nativeValueSemanticsVerifiedByOperator: true,
    deployer: deployer.address,
    deploymentTx: receipt.hash,
    deploymentBlock: receipt.blockNumber,
    note: "Testnet only; raw tPOT EVM value semantics were checked against the saved live probe report."
  };
  const outputRoot = path.resolve(
    process.env.PASTX_MASTER_DEPLOYMENT_OUTPUT_DIR ||
    path.join(__dirname, "..", "deployments", "all-testnet")
  );
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(path.join(outputRoot, "portal-escrow.json"), JSON.stringify({ ...result, status: "deployed" }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(redactError(error));
  process.exitCode = 1;
});
