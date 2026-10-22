require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
require("dotenv").config();

const privateKey = (process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY || "").trim();
const mnemonic = (process.env.PORTALDOT_DEPLOYER_MNEMONIC || "").trim().split(/\s+/).filter(Boolean).join(" ");

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
  solidity: "0.8.28",
  resolc: {
    compilerSource: "npm",
    settings: {
      optimizer: { enabled: true, parameters: "z", fallbackOz: true, runs: 200 },
      standardJson: true
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { chainId: 420420777, polkadot: true },
    portalV3Testnet: {
      url: process.env.PORTALDOT_V3_EVM_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev",
      chainId: 420420777,
      accounts,
      polkadot: true
    }
  },
  paths: {
    sources: "./contracts/portal",
    tests: "./test/portal-pvm",
    cache: "./cache/portal",
    artifacts: "./artifacts/portal"
  }
};
