const DEFAULT_RPC_URL = "https://test-evm-rpc-v3.portaldot.dev";
const EXPECTED_NETWORK_NAME = "portalV3Testnet";
const EXPECTED_CHAIN_ID = 420420777n;

async function assertPortalTestnet(hre) {
  if (hre.network.name !== EXPECTED_NETWORK_NAME) {
    throw new Error("Refusing to run: use --network " + EXPECTED_NETWORK_NAME + "; received " + hre.network.name + ".");
  }
  const privateKey = process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("Set PORTALDOT_DEPLOYER_PRIVATE_KEY in contracts/cross-chain/.env. Never paste it into chat or commit it.");
  }
  const signers = await hre.ethers.getSigners();
  if (!signers.length) throw new Error("No deployer signer is configured.");
  const expectedAddress = new hre.ethers.Wallet(privateKey).address;
  const signer = signers[0];
  if (expectedAddress.toLowerCase() !== signer.address.toLowerCase()) throw new Error("Signer does not match PORTALDOT_DEPLOYER_PRIVATE_KEY.");
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) throw new Error("Wrong chain ID: expected 420420777, received " + network.chainId + ".");
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 1) throw new Error("RPC did not return a usable latest block.");
  const balance = await hre.ethers.provider.getBalance(signer.address);
  if (balance <= 0n) throw new Error("The deployer has no native tPOTv3 balance for gas.");
  return { signer, chainId: network.chainId, blockNumber, balance };
}

function redactError(value) {
  let text = String(value instanceof Error ? value.stack || value.message : value);
  for (const secret of [process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY, process.env.PORTALDOT_V3_EVM_RPC_URL]) {
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text.replace(/https?:\/\/\S+/g, "[URL REDACTED]");
}
module.exports = { DEFAULT_RPC_URL, EXPECTED_CHAIN_ID, EXPECTED_NETWORK_NAME, assertPortalTestnet, redactError };
