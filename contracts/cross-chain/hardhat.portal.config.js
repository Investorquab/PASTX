const path = require("node:path");
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = (process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY || "").trim();
const mnemonic = (process.env.PORTALDOT_DEPLOYER_MNEMONIC || "")
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .join(" ");

if (privateKey && mnemonic) {
  throw new Error("Set only one signer source: PORTALDOT_DEPLOYER_PRIVATE_KEY or PORTALDOT_DEPLOYER_MNEMONIC.");
}

const accounts = mnemonic
  ? {
      mnemonic,
      path: "m/44'/60'/0'/0",
      initialIndex: 0,
      count: 1
    }
  : privateKey
    ? [privateKey]
    : [];

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { chainId: 420420777 },
    portalV3Testnet: {
      url: process.env.PORTALDOT_V3_EVM_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev",
      chainId: 420420777,
      accounts
    }
  },
  paths: {
    root: path.resolve(__dirname, "../.."),
    sources: "contracts/portaldot-v3/evm",
    tests: "contracts/cross-chain/test/portal-unit",
    cache: "contracts/cross-chain/cache/portal",
    artifacts: "contracts/cross-chain/artifacts/portal"
  }
};
