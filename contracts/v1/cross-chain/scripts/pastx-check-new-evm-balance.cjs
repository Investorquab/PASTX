const { JsonRpcProvider, formatUnits } = require("ethers");
require("dotenv").config();

async function main() {
  const rpc =
    process.env.PORTALDOT_V3_EVM_RPC_URL ||
    "https://test-evm-rpc-v3.portaldot.dev";

  const address = "0xb15d7C69f360AdF08aE2c3dbf37ca79950e01df7";
  const provider = new JsonRpcProvider(rpc, 420420777, {
    staticNetwork: true,
  });

  try {
    const network = await provider.getNetwork();
    const block = await provider.getBlockNumber();
    const balance = await provider.getBalance(address);

    console.log("\nPASTX NEW EVM WALLET CHECK");
    console.log("--------------------------");
    console.log("Chain ID:", network.chainId.toString());
    console.log("Block:", block);
    console.log("New EVM address:", address);
    console.log("EVM balance:", formatUnits(balance, 14), "tPOT");
    console.log("Read-only: no transaction submitted.");
  } finally {
    await provider.destroy();
  }
}

main().catch((error) => {
  console.error("Balance check failed:", error.shortMessage || error.message);
  process.exitCode = 1;
});
