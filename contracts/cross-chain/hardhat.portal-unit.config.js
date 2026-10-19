// Local EVM unit tests only. This does not emulate PortalDOT's PolkaVM runtime.
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: { hardhat: { chainId: 420420777 } },
  paths: {
    sources: "./contracts/portal",
    tests: "./test/portal-unit",
    cache: "./cache/portal-unit",
    artifacts: "./artifacts/portal-unit"
  }
};
