// Local EVM unit tests only. They do not prove behavior on the live Portaldot V3 EVM RPC.
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: { hardhat: { chainId: 420420777 } },
  paths: {
    sources: "../portaldot-v3/evm",
    tests: "./test/portal-unit",
    cache: "./cache/portal-unit",
    artifacts: "./artifacts/portal-unit"
  }
};
