require("dotenv").config();
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");

async function main() {
  const api = await ApiPromise.create({
    provider: new WsProvider(
      process.env.PORTALDOT_WS || "wss://test-node-v3.portaldot.dev"
    ),
  });

  try {
    const nativeAddress =
      "5GxJ1TP4wamgHz6dYoGyB2FpJiZdwpd4vo6qFU8Qr2BERiAk";

    const evmAddress =
      "0xb15d7C69f360AdF08aE2c3dbf37ca79950e01df7";

    const account = await api.query.system.account(nativeAddress);
    const decimals = Number(api.registry.chainDecimals[0] ?? 14);
    const fmt = (value) => `${ethers.formatUnits(value.toString(), decimals)} tPOT`;

    console.log("\nNEW WALLET — READ-ONLY CHECK");
    console.log("----------------------------");
    console.log("Native address:", nativeAddress);
    console.log("EVM address:", evmAddress);
    console.log("Free:", fmt(account.data.free));
    console.log("Reserved:", fmt(account.data.reserved));
    console.log("Frozen:", fmt(account.data.frozen ?? 0));
    console.log("Nonce:", account.nonce.toString());
    console.log("No transaction submitted.");
  } finally {
    await api.disconnect();
  }
}

main().catch((error) => {
  console.error("Wallet check failed:", error.message);
  process.exitCode = 1;
});
