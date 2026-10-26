require("dotenv").config({ path: require("node:path").resolve(__dirname, "../../../../.env") });
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.28",
  networks: { hardhat: { chainId: 97 } },
  paths: { sources: "./contracts", tests: "./test", cache: "./cache-test", artifacts: "./artifacts-test" }
};

