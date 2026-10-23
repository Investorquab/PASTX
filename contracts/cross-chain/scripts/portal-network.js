const DEFAULT_RPC_URL = "https://test-evm-rpc-v3.portaldot.dev";
const EXPECTED_NETWORK_NAME = "portalV3Testnet";
const EXPECTED_CHAIN_ID = 420420777n;
const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0";

function getExpectedDeployerAddress(hre) {
  const privateKey = (process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY || "").trim();
  const mnemonic = (process.env.PORTALDOT_DEPLOYER_MNEMONIC || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");

  if (Boolean(privateKey) === Boolean(mnemonic)) {
    throw new Error("Set exactly one signer source in contracts/cross-chain/.env: PORTALDOT_DEPLOYER_PRIVATE_KEY or PORTALDOT_DEPLOYER_MNEMONIC.");
  }

  if (privateKey) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error("PORTALDOT_DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hexadecimal characters.");
    }
    return new hre.ethers.Wallet(privateKey).address;
  }

  try {
    return hre.ethers.HDNodeWallet.fromPhrase(mnemonic, "", EVM_DERIVATION_PATH).address;
  } catch {
    throw new Error("PORTALDOT_DEPLOYER_MNEMONIC is invalid or cannot be derived using " + EVM_DERIVATION_PATH + ".");
  }
}

async function assertPortalTestnet(hre) {
  if (hre.network.name !== EXPECTED_NETWORK_NAME) {
    throw new Error("Refusing to run: use --network " + EXPECTED_NETWORK_NAME + "; received " + hre.network.name + ".");
  }

  const signers = await hre.ethers.getSigners();
  if (!signers.length) throw new Error("No deployer signer is configured.");

  const expectedAddress = getExpectedDeployerAddress(hre);
  const signer = signers[0];
  if (expectedAddress.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Configured Hardhat signer does not match the selected deployer secret. Check the SubWallet EVM account and derivation path " + EVM_DERIVATION_PATH + ".");
  }

  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) throw new Error("Wrong chain ID: expected 420420777, received " + network.chainId + ".");
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 1) throw new Error("RPC did not return a usable latest block.");
  const balance = await hre.ethers.provider.getBalance(signer.address);
  if (balance <= 0n) throw new Error("The configured Portaldot EVM deployer account " + signer.address + " has zero native tPOTv3 balance for gas. Verify that this exact 0x EVM account is the one funded by the testnet faucet. The native Substrate 5... account is different. No transactions were submitted.");

  return { signer, chainId: network.chainId, blockNumber, balance };
}

function redactError(value) {
  let text = String(value instanceof Error ? value.stack || value.message : value);
  for (const secret of [
    process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY,
    process.env.PORTALDOT_DEPLOYER_MNEMONIC,
    process.env.PORTALDOT_V3_EVM_RPC_URL
  ]) {
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text.replace(/https?:\/\/\S+/g, "[URL REDACTED]");
}

module.exports = {
  DEFAULT_RPC_URL,
  EVM_DERIVATION_PATH,
  EXPECTED_CHAIN_ID,
  EXPECTED_NETWORK_NAME,
  assertPortalTestnet,
  getExpectedDeployerAddress,
  redactError
};
