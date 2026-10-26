"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ContractPromise } = require("@polkadot/api-contract");
const {
  DEPLOYMENT_ROOT,
  connectNative,
  contractFiles,
  formatUnits,
  maxBlockWeight,
  outputError,
  saveJson,
  fail
} = require("./common.cjs");

function sameAddress(api, a, b) {
  try {
    return api.registry.createType("AccountId32", a).toHex() ===
      api.registry.createType("AccountId32", b).toHex();
  } catch {
    return String(a) === String(b);
  }
}

function listingParts(row) {
  if (Array.isArray(row)) return row;
  if (!row || typeof row !== "object") return null;
  return [
    row.stockToken ?? row.stock_token,
    row.paymentToken_ ?? row.paymentToken ?? row.payment_token,
    row.pricePerShare ?? row.price_per_share,
    row.enabled
  ];
}

async function read(contract, context, method, ...args) {
  const query = contract.query[method];
  if (typeof query !== "function") fail("Missing contract query method: " + method);
  const result = await query(
    context.signer.address,
    { value: 0, gasLimit: maxBlockWeight(context.api), storageDepositLimit: null },
    ...args
  );
  if (!result.result?.isOk) fail("Query failed: " + method);
  return result.output?.toJSON();
}

function bytes32FromText(text) {
  const bytes = Buffer.from(text, "utf8");
  return "0x" + bytes.toString("hex").padEnd(64, "0");
}

async function main() {
  const latestFile = path.join(DEPLOYMENT_ROOT, "latest.json");
  if (!fs.existsSync(latestFile)) fail("No native deployment manifest found at " + latestFile);
  const manifest = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  if (!manifest.contracts?.PastxDemoToken || !manifest.contracts?.PastxMarket || !manifest.contracts?.PastxFaucet) {
    fail("Deployment manifest is missing core contract addresses.");
  }

  const context = await connectNative({ requireGenesisPin: true });
  try {
    if (context.chain !== manifest.chain || context.genesisHash !== manifest.genesisHash) {
      fail("Connected native chain identity differs from the deployment manifest.");
    }
    const requiredAddresses = [
      manifest.contracts.PastxDemoToken.address,
      manifest.contracts.PastxMarket.address,
      manifest.contracts.PastxFaucet.address,
      ...Object.values(manifest.stocks || {}).map(stock => stock.address)
    ];
    const checks = [];
    for (const address of requiredAddresses) {
      const info = await context.api.query.contracts.contractInfoOf(address);
      if (info.isNone) fail("No contracts pallet info at " + address);
      checks.push("Contract exists: " + address);
    }

    const token = new ContractPromise(context.api, contractFiles("PastxDemoToken").metadata, manifest.contracts.PastxDemoToken.address);
    const market = new ContractPromise(context.api, contractFiles("PastxMarket").metadata, manifest.contracts.PastxMarket.address);
    const faucet = new ContractPromise(context.api, contractFiles("PastxFaucet").metadata, manifest.contracts.PastxFaucet.address);

    if (String(await read(token, context, "name")) !== "PASTX Demo Dollar") fail("pUSD name check failed.");
    if (String(await read(token, context, "symbol")) !== "pUSD") fail("pUSD symbol check failed.");
    if (BigInt(await read(token, context, "decimals")) !== 18n) fail("pUSD decimals check failed.");
    if (BigInt(await read(token, context, "cap")) !== 1000000n * (10n ** 18n)) fail("pUSD cap check failed.");
    if (!sameAddress(context.api, await read(market, context, "paymentToken"), manifest.contracts.PastxDemoToken.address)) {
      fail("Market payment-token binding check failed.");
    }
    if (!sameAddress(context.api, await read(faucet, context, "token"), manifest.contracts.PastxDemoToken.address)) {
      fail("Faucet binding check failed.");
    }
    if (BigInt(await read(faucet, context, "claimAmount")) !== 1000n * (10n ** 18n)) fail("Faucet claim amount check failed.");
    if (BigInt(await read(faucet, context, "cooldown")) !== 3600n) fail("Faucet cooldown check failed.");
    if (await read(token, context, "minters", manifest.contracts.PastxFaucet.address) !== true) fail("Faucet minter check failed.");
    if (await read(token, context, "minters", context.signer.address) !== false) fail("Deployer minter role remains enabled.");
    if (BigInt(await read(market, context, "listingCount")) !== 4n) fail("Market must have exactly four listings.");

    for (const stock of [
      { key: "AAPL-TEST", symbol: "pAAPL", price: "200" },
      { key: "NVDA-TEST", symbol: "pNVDA", price: "180" },
      { key: "TSLA-TEST", symbol: "pTSLA", price: "250" },
      { key: "MSFT-TEST", symbol: "pMSFT", price: "400" }
    ]) {
      const saved = manifest.stocks[stock.key];
      if (!saved) fail("Missing stock manifest entry: " + stock.key);
      const tokenContract = new ContractPromise(context.api, contractFiles("PastxStockToken").metadata, saved.address);
      if (String(await read(tokenContract, context, "symbol")) !== stock.symbol) fail(stock.key + " symbol check failed.");
      if (!sameAddress(context.api, await read(tokenContract, context, "market"), manifest.contracts.PastxMarket.address)) {
        fail(stock.key + " market check failed.");
      }
      const rawRow = await read(market, context, "getListing", bytes32FromText(stock.key));
      const row = listingParts(rawRow);
      if (!row || !sameAddress(context.api, row[0], saved.address) ||
          !sameAddress(context.api, row[1], manifest.contracts.PastxDemoToken.address) ||
          BigInt(row[2]) !== BigInt(saved.priceRaw) || row[3] !== true) {
        fail(stock.key + " listing check failed.");
      }
      checks.push("Verified listing " + stock.key + " at " + stock.price + " pUSD.");
    }

    manifest.verification = {
      completed: true,
      completedAt: new Date().toISOString(),
      checks
    };
    if (manifest.status === "deployed-and-verified") manifest.status = "deployed-and-verified";
    saveJson(path.join(DEPLOYMENT_ROOT, manifest.runId, "verification.json"), manifest.verification);
    saveJson(latestFile, manifest);
    console.log(JSON.stringify({
      status: "native-market-verification-passed",
      chain: context.chain,
      genesisHash: context.genesisHash,
      nativeDeployer: context.signer.address,
      currentFreeBalance: formatUnits(context.free, context.decimals, 6) + " " + context.symbol,
      contractsChecked: requiredAddresses.length,
      listingsChecked: 4,
      verification: manifest.verification,
      transactionsSent: false
    }, null, 2));
  } finally {
    await context.api.disconnect();
  }
}

main().catch(error => {
  outputError(error);
  process.exitCode = 1;
});
