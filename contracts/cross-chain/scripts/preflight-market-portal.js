const hre = require("hardhat");
const { assertPortalTestnet, redactError } = require("./portal-network");
async function main() {
  const r = await assertPortalTestnet(hre);
  console.log(JSON.stringify({
    status: "preflight-passed",
    network: "Portaldot V3 Testnet",
    chainId: r.chainId.toString(),
    blockNumber: r.blockNumber,
    deployer: r.signer.address,
    nativeBalanceRaw: r.balance.toString(),
    nativeBalanceTPOTv3: hre.ethers.formatUnits(r.balance, 14),
    rpcEndpoint: "configured; not printed or saved",
    transactionsSent: false,
    warning: "Chain ID alone does not prove an RPC is canonical. Confirm the current official Portaldot endpoint before deploying."
  }, null, 2));
}
main().catch(error => { console.error(redactError(error)); process.exitCode = 1; });
