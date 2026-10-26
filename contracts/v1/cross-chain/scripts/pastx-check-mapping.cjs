require("dotenv").config();
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");

(async () => {
  const api = await ApiPromise.create({
    provider: new WsProvider(
      process.env.PORTALDOT_WS || "wss://test-node-v3.portaldot.dev"
    ),
  });

  try {
    const evm = "0x0e9e6054e743E881E4E593f92c9d998eD3057a60";

    console.log("Runtime:", api.runtimeVersion.specName.toString());
    console.log("Chain SS58:", api.registry.chainSS58);

    const result = await api.call.reviveApi.accountIdVersioned(evm);
    console.log("accountIdVersioned result:", result.toString());
    console.log("Raw result:", result.toHex());

    console.log("Read-only: no transaction submitted.");
  } finally {
    await api.disconnect();
  }
})().catch((error) => {
  console.error("Mapping query failed:", error.message);
  process.exitCode = 1;
});
