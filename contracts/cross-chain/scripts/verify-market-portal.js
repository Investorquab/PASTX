const fs = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");
const STOCKS = [
  { key: "AAPL-TEST", symbol: "pAAPL", price: "200" },
  { key: "NVDA-TEST", symbol: "pNVDA", price: "180" },
  { key: "TSLA-TEST", symbol: "pTSLA", price: "250" },
  { key: "MSFT-TEST", symbol: "pMSFT", price: "400" }
];
async function main() {
  const root = path.resolve(process.env.PASTX_DEPLOYMENT_OUTPUT_DIR || path.join(__dirname, "..", "deployments", "portal-v3-testnet"));
  const manifest = JSON.parse(await fs.readFile(path.join(root, "latest.json"), "utf8"));
  if (manifest.status !== "deployed-and-verified") throw new Error("latest.json is not marked deployed-and-verified.");
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 420420777n || manifest.network.chainId !== "420420777") throw new Error("Connected network is not Portaldot V3 testnet.");
  const token = await hre.ethers.getContractAt("PastxDemoToken", manifest.contracts.demoToken.address);
  const market = await hre.ethers.getContractAt("PastxMarket", manifest.contracts.market.address);
  const faucet = await hre.ethers.getContractAt("PastxFaucet", manifest.contracts.faucet.address);
  const swapInfo = manifest.contracts.iSwap;
  if (!swapInfo?.address) throw new Error("Deployment manifest has no iSwap contract address.");
  const swap = await hre.ethers.getContractAt("PastxISwap", swapInfo.address);
  const checks = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); checks.push(message); };
  check(await token.symbol() === "pUSD" && Number(await token.decimals()) === 18, "pUSD metadata verified.");
  check((await market.paymentToken()).toLowerCase() === manifest.contracts.demoToken.address.toLowerCase(), "Market pUSD address verified.");
  check((await faucet.token()).toLowerCase() === manifest.contracts.demoToken.address.toLowerCase(), "Faucet token verified.");
  check(await token.minters(manifest.contracts.faucet.address), "Faucet mint role verified.");
  check(await token.minters(swapInfo.address), "iSwap pUSD mint role verified.");
  check((await swap.token()).toLowerCase() === manifest.contracts.demoToken.address.toLowerCase(), "iSwap pUSD binding verified.");
  check(await swap.maxNativePerSwapRaw() === BigInt(swapInfo.maxNativePerSwapRaw), "iSwap per-swap cap verified.");
  check((await hre.ethers.provider.getBalance(swapInfo.address)) >= BigInt(swapInfo.maxNativePerSwapRaw), "iSwap has the configured minimum native liquidity.");
  check(await market.listingCount() === 4n, "Four listings found.");
  const addresses = [manifest.contracts.demoToken.address, manifest.contracts.market.address, manifest.contracts.faucet.address, swapInfo.address, ...STOCKS.map(s => manifest.contracts.stocks[s.key].address)];
  for (const address of addresses) check((await hre.ethers.provider.getCode(address)) !== "0x", "Code exists at " + address + ".");
  const listings = [];
  for (const s of STOCKS) {
    const item = manifest.contracts.stocks[s.key];
    const row = await market.getListing(hre.ethers.encodeBytes32String(s.key));
    check(row[0].toLowerCase() === item.address.toLowerCase(), s.key + " share-token address verified.");
    check(row[1].toLowerCase() === manifest.contracts.demoToken.address.toLowerCase(), s.key + " payment asset is pUSD.");
    check(row[2] === hre.ethers.parseEther(s.price) && row[3] === true, s.key + " price and enabled state verified.");
    const share = await hre.ethers.getContractAt("PastxStockToken", item.address);
    check(await share.symbol() === s.symbol && (await share.market()).toLowerCase() === manifest.contracts.market.address.toLowerCase(), s.key + " metadata/market authority verified.");
    listings.push({ listing: s.key, address: item.address, pricePusd: s.price, paymentToken: row[1], enabled: row[3] });
  }
  const report = { status: "verified", verifiedAt: new Date().toISOString(), chainId: network.chainId.toString(), latestBlock: await hre.ethers.provider.getBlockNumber(), checks, listings };
  await fs.writeFile(path.join(root, "verification.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => {
  const { redactError } = require("./portal-network");
  console.error(redactError(error));
  process.exitCode = 1;
});
