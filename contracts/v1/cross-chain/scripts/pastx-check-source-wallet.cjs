require("dotenv").config();
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { formatUnits } = require("ethers");

(async () => {
  const api = await ApiPromise.create({
    provider: new WsProvider(
      process.env.PORTALDOT_WS || "wss://test-node-v3.portaldot.dev"
    ),
  });

  try {
    const address = "5DG1kXxFVY4kjZtLmGCsixwvxLxx29ELQTke5mDcEXu42Ubv";
    const account = await api.query.system.account(address);
    const decimals = Number(api.registry.chainDecimals[0] ?? 14);

    console.log("SOURCE WALLET:", address);
    console.log("Free:", formatUnits(account.data.free.toString(), decimals), "tPOT");
    console.log("Reserved:", formatUnits(account.data.reserved.toString(), decimals), "tPOT");
    console.log("Frozen:", formatUnits((account.data.frozen ?? 0).toString(), decimals), "tPOT");
    console.log("Read-only: no transaction submitted.");
  } finally {
    await api.disconnect();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
