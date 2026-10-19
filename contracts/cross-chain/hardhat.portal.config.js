require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
require("dotenv").config();

const accounts = process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY
  ? [process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY]
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
    hardhat: { chainId: 420420777, polkavm: true },
    portalV3Testnet: {
      url: process.env.PORTALDOT_V3_EVM_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev",
      chainId: 420420777,
      accounts,
      polkavm: true
    }
  },
  paths: {
    sources: "./contracts/portal",
    tests: "./test/portal-pvm",
    cache: "./cache/portal",
    artifacts: "./artifacts/portal"
  }
};
