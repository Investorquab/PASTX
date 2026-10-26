require("dotenv").config();
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { encodeAddress } = require("@polkadot/util-crypto");
const { JsonRpcProvider, formatUnits } = require("ethers");

async function main() {
  const evmAddress = "0xb15d7C69f360AdF08aE2c3dbf37ca79950e01df7";
  const ws = process.env.PORTALDOT_WS || "wss://test-node-v3.portaldot.dev";
  const rpc = process.env.PORTALDOT_V3_EVM_RPC_URL ||
    "https://test-evm-rpc-v3.portaldot.dev";

  const api = await ApiPromise.create({
    provider: new WsProvider(ws),
  });
  const provider = new JsonRpcProvider(rpc, 420420777, {
    staticNetwork: true,
  });

  try {
    const mappedRaw = await api.call.reviveApi.accountId(evmAddress);
    const mappedNative = encodeAddress(
      mappedRaw.toU8a(),
      api.registry.chainSS58 ?? 42
    );

    const [account, evmBalance] = await Promise.all([
      api.query.system.account(mappedNative),
      provider.getBalance(evmAddress),
    ]);

    const decimals = Number(api.registry.chainDecimals[0] ?? 14);
    const fmt = (v) => formatUnits(v.toString(), decimals);

    console.log("\nPASTX NEW EVM FUNDING CHECK");
    console.log("--------------------------");
    console.log("EVM address:", evmAddress);
    console.log("Mapped native destination:", mappedNative);
    console.log("Destination free:", fmt(account.data.free), "tPOT");
    console.log("Destination reserved:", fmt(account.data.reserved), "tPOT");
    console.log("EVM balance:", fmt(evmBalance), "tPOT");
    console.log("Read-only: no transaction submitted.");
  } finally {
    await api.disconnect();
    await provider.destroy();
  }
}

main().catch((error) => {
  console.error("Mapping check failed:", error.message);
  process.exitCode = 1;
});
