const path = require("node:path");
// Local EVM unit tests only. They do not prove behavior on the live Portaldot V3 EVM RPC.
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: { hardhat: { chainId: 420420777 } },
  paths: {
    root: path.resolve(__dirname, "../.."),
    sources: "contracts/portaldot-v3/evm",
    tests: "contracts/cross-chain/test/portal-unit",
    cache: "contracts/cross-chain/cache/portal-unit",
    artifacts: "contracts/cross-chain/artifacts/portal-unit"
  }
};
