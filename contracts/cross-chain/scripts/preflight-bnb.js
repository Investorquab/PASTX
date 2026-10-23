const hre = require("hardhat");
require("dotenv").config();
const { redactError } = require("./portal-network");

function requirePrivateKey(name) {
  const key = (process.env[name] || "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(name + " must be configured in the local .env file.");
  return key;
}

function requireAddress(name) {
  const value = (process.env[name] || "").trim();
  if (!hre.ethers.isAddress(value) || value === hre.ethers.ZeroAddress) {
    throw new Error(name + " must be a valid non-zero EVM address.");
  }
  return hre.ethers.getAddress(value);
}

async function main() {
  if (hre.network.name !== "bscTestnet") throw new Error("Run with --network bscTestnet.");
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 97n) throw new Error("Wrong BNB network; expected chain ID 97, got " + network.chainId + ".");
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  if (blockNumber < 1) throw new Error("BNB RPC returned no usable latest block.");

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No BNB testnet deployer is configured.");
  const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
  if (deployerBalance <= 0n) throw new Error("BNB testnet deployer has no tBNB for gas. No transactions were submitted.");

  const bnbRelayerKey = requirePrivateKey("PASTX_BNB_RELAYER_PRIVATE_KEY");
  const portalRelayerKey = requirePrivateKey("PASTX_PORTALDOT_RELAYER_PRIVATE_KEY");
  const bnbRelayerAddress = requireAddress("PASTX_BNB_RELAYER_ADDRESS");
  const portalRelayerAddress = requireAddress("PASTX_PORTAL_RELAYER_ADDRESS");
  if (hre.ethers.getAddress(new hre.ethers.Wallet(bnbRelayerKey).address) !== bnbRelayerAddress) {
    throw new Error("PASTX_BNB_RELAYER_PRIVATE_KEY does not derive PASTX_BNB_RELAYER_ADDRESS.");
  }
  if (hre.ethers.getAddress(new hre.ethers.Wallet(portalRelayerKey).address) !== portalRelayerAddress) {
    throw new Error("PASTX_PORTALDOT_RELAYER_PRIVATE_KEY does not derive PASTX_PORTAL_RELAYER_ADDRESS.");
  }

  const capText = (process.env.PASTX_BRIDGE_MAX_DEPOSIT_RAW || "").trim();
  const swapCapText = (process.env.PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW || "").trim();
  if (!/^[0-9]+$/.test(capText) || BigInt(capText) <= 0n || capText !== swapCapText) {
    throw new Error("PASTX_BRIDGE_MAX_DEPOSIT_RAW must be positive and match PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW.");
  }
  const portalRpc = (process.env.PORTALDOT_V3_EVM_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev").trim();
  const portalProvider = new hre.ethers.JsonRpcProvider(portalRpc);
  let portalChainId;
  let portalRelayerBalance;
  try {
    const portalNetwork = await portalProvider.getNetwork();
    portalChainId = portalNetwork.chainId;
    if (portalChainId !== 420420777n) throw new Error("Wrong Portaldot EVM RPC chain ID: " + portalChainId);
    portalRelayerBalance = await portalProvider.getBalance(portalRelayerAddress);
  } finally {
    await portalProvider.destroy();
  }
  if (portalRelayerBalance <= 0n) throw new Error("Configured Portaldot relayer has zero EVM tPOT balance. Fund and verify it before deployment.");
  const bnbRelayerBalance = await hre.ethers.provider.getBalance(bnbRelayerAddress);
  if (bnbRelayerBalance <= 0n) throw new Error("Configured BNB relayer has zero tBNB balance. Fund and verify it before deployment.");

  console.log(JSON.stringify({
    status: "preflight-passed",
    network: "BNB Smart Chain Testnet",
    chainId: network.chainId.toString(),
    blockNumber,
    deployer: deployer.address,
    deployerBalanceTbnb: hre.ethers.formatEther(deployerBalance),
    bnbRelayerAddress,
    bnbRelayerBalanceTbnb: hre.ethers.formatEther(bnbRelayerBalance),
    portalRelayerAddress,
    portalRelayerBalanceTpotIf14Decimals: hre.ethers.formatUnits(portalRelayerBalance, 14),
    sourceChainId: portalChainId.toString(),
    bridgeCapRaw: capText,
    transactionsSent: false,
    warning: "Positive balances do not guarantee sufficient fees for every deployment transaction. Review balances and fee estimates before approving the master deployment."
  }, null, 2));
}

main().catch(error => { console.error(redactError(error)); process.exitCode = 1; });
