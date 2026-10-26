require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.28",
  networks: { hardhat: { chainId: 97 } },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache-bnb-canonical",
    artifacts: "./artifacts-bnb-canonical"
  }
};
