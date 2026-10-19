require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const accounts = process.env.BNB_TESTNET_DEPLOYER_PRIVATE_KEY
  ? [process.env.BNB_TESTNET_DEPLOYER_PRIVATE_KEY]
  : [];

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { chainId: 97 },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-dataseed.bnbchain.org",
      chainId: 97,
      accounts
    }
  },
  paths: {
    sources: "./contracts/bnb",
    tests: "./test/bnb",
    cache: "./cache/bnb",
    artifacts: "./artifacts/bnb"
  }
};
