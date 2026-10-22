"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { CodePromise, ContractPromise } = require("@polkadot/api-contract");
const {
  CONTRACT_NAMES,
  DEPLOYMENT_ROOT,
  checkBudget,
  connectNative,
  contractFiles,
  deploymentId,
  dryRunConstructor,
  dryRunMessage,
  formatUnits,
  getAccountState,
  outputError,
  parseUnits,
  reserveAmount,
  saveJson,
  redact,
  fail
} = require("./common.cjs");

const STOCKS = [
  { key: "AAPL-TEST", name: "PASTX Apple Demo", symbol: "pAAPL", price: "200" },
  { key: "NVDA-TEST", name: "PASTX NVIDIA Demo", symbol: "pNVDA", price: "180" },
  { key: "TSLA-TEST", name: "PASTX Tesla Demo", symbol: "pTSLA", price: "250" },
  { key: "MSFT-TEST", name: "PASTX Microsoft Demo", symbol: "pMSFT", price: "400" }
];

function bytes32FromText(text) {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length > 32) fail("Listing identifier exceeds 32 bytes: " + text);
  return "0x" + bytes.toString("hex").padEnd(64, "0");
}

function saltFor(runId, key) {
  return Uint8Array.from(Buffer.from("PASTX:" + runId + ":" + key, "utf8"));
}

function eventSummary(records) {
  return (records || []).map(record => ({
    section: record.event.section,
    method: record.event.method,
    data: record.event.data.map(value => value.toString())
  }));
}

function decodeDispatchError(api, error) {
  if (!error) return null;
  if (error.isModule) {
    const meta = api.registry.findMetaError(error.asModule);
    return meta.section + "." + meta.name + (meta.docs?.length ? ": " + meta.docs.join(" ") : "");
  }
  return error.toString();
}

async function submitFinalized(api, signer, tx) {
  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let done = false;
    let txHash = null;

    const finish = (error, value) => {
      if (done) return;
      done = true;
      if (unsubscribe) unsubscribe();
      if (error) reject(error);
      else resolve(value);
    };

    tx.signAndSend(signer, result => {
      if (result.txHash) txHash = result.txHash.toHex();

      if (result.status.isInvalid || result.status.isDropped || result.status.isUsurped) {
        finish(new Error("Extrinsic was " + result.status.type + ". Hash: " + (txHash || "not available")));
        return;
      }

      if (result.status.isFinalized) {
        const failedEvent = (result.events || []).find(record =>
          record.event.section === "system" && record.event.method === "ExtrinsicFailed"
        );
        const decoded = decodeDispatchError(api, result.dispatchError || (failedEvent && failedEvent.event.data[0]));
        if (decoded) {
          finish(new Error("Finalized extrinsic failed: " + decoded + "; hash " + (txHash || "unknown")));
          return;
        }

        const instantiation = (result.events || []).find(record =>
          record.event.section === "contracts" && record.event.method === "Instantiated"
        );
        let contractAddress = null;
        if (instantiation && instantiation.event.data.length > 1) {
          contractAddress = instantiation.event.data[1].toString();
        }
        const finalizedHash = result.status.asFinalized.toHex();
        api.rpc.chain.getHeader(finalizedHash).then(header => {
          finish(null, {
            transactionHash: txHash,
            blockHash: finalizedHash,
            blockNumber: header.number.toString(),
            contractAddress,
            events: eventSummary(result.events)
          });
        }).catch(finish);
      }
    }).then(unsub => {
      unsubscribe = unsub;
      if (done && unsubscribe) unsubscribe();
    }).catch(finish);
  });
}

async function checkAndSubmitConstructor(context, name, args, salt, manifest, saveManifest) {
  const artifacts = contractFiles(name);
  const quote = await dryRunConstructor(context, artifacts, args, salt);
  const budget = checkBudget(context, quote, "Deploy " + name);
  const estimateRow = {
    step: "Deploy " + name,
    gasRequired: {
      refTime: quote.gasRequired.refTime.toString(),
      proofSize: quote.gasRequired.proofSize.toString()
    },
    estimatedFeeRaw: quote.fee.toString(),
    estimatedStorageDepositRaw: quote.storageCharge.toString(),
    protectedReserveRaw: budget.reserve.toString()
  };
  console.log("READY " + name + ": fee about " +
    formatUnits(quote.fee, context.decimals, 6) + " " + context.symbol +
    ", storage deposit about " +
    formatUnits(quote.storageCharge, context.decimals, 6) + " " + context.symbol);

  const index = manifest.transactions.length;
  manifest.transactions.push({
    ...estimateRow,
    status: "submitting",
    salt: Buffer.from(salt).toString("hex")
  });
  manifest.activeStep = "Deploy " + name;
  await saveManifest();

  const receipt = await submitFinalized(context.api, context.signer, quote.tx);
  const row = manifest.transactions[index];
  row.transactionHash = receipt.transactionHash;
  row.status = "finalized";
  row.blockHash = receipt.blockHash;
  row.blockNumber = receipt.blockNumber;
  row.contractAddress = receipt.contractAddress;
  row.events = receipt.events;
  await saveManifest();

  if (!receipt.contractAddress) {
    fail("Deployment finalized but no contracts.Instantiated address was found for " + name +
      ". Inspect the saved manifest and block events before retrying.");
  }

  const updated = await getAccountState(context);
  context.free = updated.free;
  context.reserved = updated.reserved;
  context.frozen = updated.frozen;
  context.spendable = updated.spendable;
  context.nonce = updated.nonce;

  const entry = {
    name,
    address: receipt.contractAddress,
    transactionHash: receipt.transactionHash,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber
  };
  manifest.contracts[name] = entry;
  manifest.activeStep = null;
  await saveManifest();
  console.log("DEPLOYED " + name + ": " + receipt.contractAddress);
  return new ContractPromise(context.api, artifacts.metadata, receipt.contractAddress);
}

async function checkAndSubmitMessage(context, contract, method, args, label, manifest, saveManifest) {
  const quote = await dryRunMessage(context, contract, method, args);
  const budget = checkBudget(context, quote, label);
  console.log("READY " + label + ": fee about " +
    formatUnits(quote.fee, context.decimals, 6) + " " + context.symbol +
    ", storage deposit about " +
    formatUnits(quote.storageCharge, context.decimals, 6) + " " + context.symbol);

  const index = manifest.transactions.length;
  manifest.transactions.push({
    step: label,
    status: "submitting",
    estimatedFeeRaw: quote.fee.toString(),
    estimatedStorageDepositRaw: quote.storageCharge.toString(),
    protectedReserveRaw: budget.reserve.toString()
  });
  manifest.activeStep = label;
  await saveManifest();

  const receipt = await submitFinalized(context.api, context.signer, quote.tx);
  const row = manifest.transactions[index];
  row.transactionHash = receipt.transactionHash;
  row.status = "finalized";
  row.blockHash = receipt.blockHash;
  row.blockNumber = receipt.blockNumber;
  row.events = receipt.events;
  await saveManifest();

  const updated = await getAccountState(context);
  context.free = updated.free;
  context.reserved = updated.reserved;
  context.frozen = updated.frozen;
  context.spendable = updated.spendable;
  context.nonce = updated.nonce;
  manifest.activeStep = null;
  await saveManifest();
  console.log("CONFIRMED " + label + ": " + receipt.transactionHash);
}

async function query(contract, context, method, ...args) {
  const result = await contract.query[method](
    context.signer.address,
    { value: 0, gasLimit: context.api.registry.createType("WeightV2", {
      refTime: 1000000000000n,
      proofSize: 10000000n
    }), storageDepositLimit: null },
    ...args
  );
  if (!result.result?.isOk) fail("Post-deploy verification call failed: " + method);
  return result.output?.toJSON();
}

function safeEqualsAddress(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

async function verifyCore(context, manifest, token, market, faucet) {
  const cap = 1000000n * (10n ** 18n);
  const claim = 1000n * (10n ** 18n);
  if (String(await query(token, context, "name")) !== "PASTX Demo Dollar") fail("pUSD name verification failed.");
  if (String(await query(token, context, "symbol")) !== "pUSD") fail("pUSD symbol verification failed.");
  if (BigInt(await query(token, context, "decimals")) !== 18n) fail("pUSD decimals verification failed.");
  if (BigInt(await query(token, context, "cap")) !== cap) fail("pUSD cap verification failed.");
  if (!safeEqualsAddress(await query(market, context, "paymentToken"), manifest.contracts.PastxDemoToken.address)) {
    fail("Market payment-token binding verification failed.");
  }
  if (!safeEqualsAddress(await query(faucet, context, "token"), manifest.contracts.PastxDemoToken.address)) {
    fail("Faucet token binding verification failed.");
  }
  if (BigInt(await query(faucet, context, "claimAmount")) !== claim) fail("Faucet amount verification failed.");
  if (BigInt(await query(faucet, context, "cooldown")) !== 3600n) fail("Faucet cooldown verification failed.");
  if (await query(token, context, "minters", manifest.contracts.PastxFaucet.address) !== true) {
    fail("Faucet minter authorization verification failed.");
  }
  if (await query(token, context, "minters", context.signer.address) !== false) {
    fail("Deployer minter revocation verification failed.");
  }
  if (BigInt(await query(market, context, "listingCount")) !== 4n) fail("Expected exactly four market listings.");

  const verifiedListings = [];
  for (const stock of STOCKS) {
    const stockInfo = manifest.stocks[stock.key];
    const stockContract = new ContractPromise(context.api, contractFiles("PastxStockToken").metadata, stockInfo.address);
    if (String(await query(stockContract, context, "symbol")) !== stock.symbol) fail(stock.key + " symbol verification failed.");
    if (!safeEqualsAddress(await query(stockContract, context, "market"), manifest.contracts.PastxMarket.address)) {
      fail(stock.key + " market authority verification failed.");
    }
    const row = await query(market, context, "getListing", bytes32FromText(stock.key));
    if (!Array.isArray(row) || !safeEqualsAddress(row[0], stockInfo.address) ||
        !safeEqualsAddress(row[1], manifest.contracts.PastxDemoToken.address) ||
        BigInt(row[2]) !== BigInt(stock.priceRaw) || row[3] !== true) {
      fail(stock.key + " listing verification failed.");
    }
    verifiedListings.push({
      key: stock.key,
      symbol: stock.symbol,
      stockToken: stockInfo.address,
      paymentToken: manifest.contracts.PastxDemoToken.address,
      pricePusd: stock.price
    });
  }
  return {
    completed: true,
    completedAt: new Date().toISOString(),
    checks: [
      "Native chain identity and genesis hash recorded.",
      "pUSD name/symbol/decimals/cap verified through native contract queries.",
      "Market payment token and faucet token binding verified.",
      "Faucet claim amount/cooldown verified.",
      "Faucet minter role enabled and deployer direct minter role disabled.",
      "Four enabled synthetic listings verified along with stock-token market authority."
    ],
    listings: verifiedListings
  };
}

async function main() {
  const context = await connectNative();
  const runId = deploymentId();
  const outputDir = path.join(DEPLOYMENT_ROOT, runId);
  const latestFile = path.join(DEPLOYMENT_ROOT, "latest.json");
  if (fs.existsSync(latestFile)) {
    const previous = JSON.parse(fs.readFileSync(latestFile, "utf8"));
    if (previous.status === "in-progress" || previous.status === "partial-failure") {
      fail("A previous native deployment is " + previous.status + ". Inspect " + latestFile + " before starting another run.");
    }
  }

  const existingArtifacts = Object.fromEntries(CONTRACT_NAMES.map(name => [name, contractFiles(name)]));
  const manifest = {
    schemaVersion: 1,
    product: "PASTX Native Portaldot V3 synthetic market",
    status: "prepared",
    runId,
    createdAt: new Date().toISOString(),
    finishedAt: null,
    chain: context.chain,
    genesisHash: context.genesisHash,
    runtimeSpecVersion: context.specVersion,
    endpointConfiguration: "operator-configured; not saved",
    nativeCurrency: { symbol: context.symbol, decimals: context.decimals },
    deployer: context.signer.address,
    balanceAtStart: {
      freeRaw: context.free.toString(),
      spendableRaw: context.spendable.toString(),
      reservedRaw: context.reserved.toString(),
      formatted: formatUnits(context.free, context.decimals, 6) + " " + context.symbol
    },
    configuration: {
      paymentToken: { name: "PASTX Demo Dollar", symbol: "pUSD", decimals: 18, cap: "1000000" },
      faucet: { claimAmount: "1000 pUSD", cooldownSeconds: 3600 },
      paymentModel: "All four listings use valueless pUSD; native tPOT is for chain fees and storage deposits.",
      stocks: STOCKS
    },
    contracts: {},
    stocks: {},
    transactions: [],
    verification: { completed: false, checks: [] },
    frontendEnv: null,
    limitations: [
      "pUSD is valueless test currency, not redeemable USDC/USDT.",
      "Stock tokens are synthetic demo assets, not issuer equity or securities.",
      "Prices are fixed owner-set demo prices, not live exchange quotes or oracle prices.",
      "This native market deploy does not activate or deploy the separate cross-chain escrow prototype."
    ]
  };

  async function saveManifest() {
    manifest.updatedAt = new Date().toISOString();
    saveJson(path.join(outputDir, "deployment.json"), manifest);
    saveJson(latestFile, manifest);
  }

  try {
    const firstQuote = await dryRunConstructor(
      context,
      existingArtifacts.PastxDemoToken,
      [1000000n * (10n ** 18n)],
      "PASTX:" + runId + ":PastxDemoToken"
    );
    const budget = checkBudget(context, firstQuote, "First pUSD deployment");
    console.log("Native chain: " + context.chain);
    console.log("Genesis hash: " + context.genesisHash);
    console.log("Deployer: " + context.signer.address);
    console.log("Free balance: " + formatUnits(context.free, context.decimals, 6) + " " + context.symbol);
    console.log("First deployment quote: fee " + formatUnits(firstQuote.fee, context.decimals, 6) +
      " " + context.symbol + "; storage deposit " +
      formatUnits(firstQuote.storageCharge, context.decimals, 6) + " " + context.symbol);
    console.log("Protected reserve: " + formatUnits(budget.reserve, context.decimals, 6) + " " + context.symbol);
    console.log("Plan: 7 contract deployments + 6 configuration transactions = 13 finalized native transactions.");
    console.log("Dependent constructor and message calls will be dry-run and budget-checked immediately before each transaction.");
    console.log("This cannot be atomic across 13 transactions. A partial failure is recorded; do not rerun blindly.");

    if (!stdin.isTTY) fail("Interactive terminal required for deployment confirmation. No transactions were submitted.");
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const answer = await rl.question("Type DEPLOY PASTX to submit the native testnet deployment: ");
    rl.close();
    if (answer.trim() !== "DEPLOY PASTX") {
      manifest.status = "cancelled-before-transactions";
      await saveManifest();
      console.log("Cancelled. No transactions were submitted.");
      return;
    }

    manifest.status = "in-progress";
    manifest.startedAt = new Date().toISOString();
    await saveManifest();

    const token = await checkAndSubmitConstructor(
      context, "PastxDemoToken",
      [1000000n * (10n ** 18n)],
      saltFor(runId, "PastxDemoToken"),
      manifest, saveManifest
    );
    const market = await checkAndSubmitConstructor(
      context, "PastxMarket",
      [manifest.contracts.PastxDemoToken.address],
      saltFor(runId, "PastxMarket"),
      manifest, saveManifest
    );
    const faucet = await checkAndSubmitConstructor(
      context, "PastxFaucet",
      [manifest.contracts.PastxDemoToken.address, 1000n * (10n ** 18n), 3600],
      saltFor(runId, "PastxFaucet"),
      manifest, saveManifest
    );

    await checkAndSubmitMessage(
      context, token, "setMinter",
      [manifest.contracts.PastxFaucet.address, true],
      "Authorize faucet to mint pUSD", manifest, saveManifest
    );
    await checkAndSubmitMessage(
      context, token, "setMinter",
      [context.signer.address, false],
      "Revoke deployer direct pUSD mint", manifest, saveManifest
    );

    for (const stock of STOCKS) {
      const share = await checkAndSubmitConstructor(
        context, "PastxStockToken",
        [stock.name, stock.symbol, manifest.contracts.PastxMarket.address],
        saltFor(runId, stock.key),
        manifest, saveManifest
      );
      const address = manifest.transactions[manifest.transactions.length - 1].contractAddress;
      manifest.stocks[stock.key] = {
        name: stock.name,
        symbol: stock.symbol,
        address,
        price: stock.price,
        priceRaw: parseUnits(stock.price, 18).toString(),
        listingKey: bytes32FromText(stock.key),
        deploymentTransactionHash: manifest.transactions[manifest.transactions.length - 1].transactionHash
      };
      await saveManifest();

      const marketContract = market;
      await checkAndSubmitMessage(
        context,
        marketContract,
        "listStock",
        [bytes32FromText(stock.key), address, parseUnits(stock.price, 18), manifest.contracts.PastxDemoToken.address],
        "Register " + stock.key + " at " + stock.price + " pUSD",
        manifest,
        saveManifest
      );
    }

    manifest.verification = await verifyCore(context, manifest, token, market, faucet);
    manifest.status = "deployed-and-verified";
    manifest.finishedAt = new Date().toISOString();
    const publicEnv = [
      "# Public native contract addresses for the PASTX native adapter.",
      "VITE_PASTX_NATIVE_MARKET=" + manifest.contracts.PastxMarket.address,
      "VITE_PASTX_NATIVE_TOKEN=" + manifest.contracts.PastxDemoToken.address,
      "VITE_PASTX_NATIVE_FAUCET=" + manifest.contracts.PastxFaucet.address,
      "VITE_PASTX_NATIVE_STOCK_AAPL=" + manifest.stocks["AAPL-TEST"].address,
      "VITE_PASTX_NATIVE_STOCK_NVDA=" + manifest.stocks["NVDA-TEST"].address,
      "VITE_PASTX_NATIVE_STOCK_TSLA=" + manifest.stocks["TSLA-TEST"].address,
      "VITE_PASTX_NATIVE_STOCK_MSFT=" + manifest.stocks["MSFT-TEST"].address,
      ""
    ].join("\n");
    manifest.frontendEnv = "frontend.env";
    saveJson(path.join(outputDir, "verification.json"), manifest.verification);
    fs.writeFileSync(path.join(outputDir, "frontend.env"), publicEnv, "utf8");
    saveJson(path.join(outputDir, "abi", "PastxDemoToken.contract.json"), existingArtifacts.PastxDemoToken.metadata);
    saveJson(path.join(outputDir, "abi", "PastxMarket.contract.json"), existingArtifacts.PastxMarket.metadata);
    saveJson(path.join(outputDir, "abi", "PastxFaucet.contract.json"), existingArtifacts.PastxFaucet.metadata);
    saveJson(path.join(outputDir, "abi", "PastxStockToken.contract.json"), existingArtifacts.PastxStockToken.metadata);
    const addressLines = [
      "# PASTX Native Portaldot V3 Testnet Deployment",
      "",
      "- Status: " + manifest.status,
      "- Chain: " + manifest.chain,
      "- Genesis hash: " + manifest.genesisHash,
      "- Native deployer: " + manifest.deployer,
      "- Started: " + manifest.startedAt,
      "- Finished: " + manifest.finishedAt,
      "",
      "## Core Contracts",
      "",
      "- pUSD: " + manifest.contracts.PastxDemoToken.address,
      "- Market: " + manifest.contracts.PastxMarket.address,
      "- Faucet: " + manifest.contracts.PastxFaucet.address,
      "",
      "## Synthetic Listings",
      ""
    ];
    for (const stock of STOCKS) {
      addressLines.push("- " + stock.key + " (" + stock.symbol + ", " + stock.price + " pUSD): " + manifest.stocks[stock.key].address);
    }
    fs.writeFileSync(path.join(outputDir, "addresses.md"), addressLines.join("\n") + "\n", "utf8");
    await saveManifest();
    console.log("PASTX NATIVE DEPLOYMENT COMPLETE AND VERIFIED.");
    console.log("Manifest: " + path.join(outputDir, "deployment.json"));
    console.log("Addresses: " + path.join(outputDir, "addresses.md"));
    console.log("Frontend public addresses: " + path.join(outputDir, "frontend.env"));
  } catch (error) {
    manifest.status = manifest.transactions.length ? "partial-failure" : "failed-before-transactions";
    manifest.finishedAt = new Date().toISOString();
    manifest.failure = {
      stage: manifest.activeStep || "preflight-or-verification",
      message: redact(error),
      note: "Inspect latest.json and transaction records. Never rerun blindly after a partial failure."
    };
    await saveManifest();
    throw error;
  } finally {
    await context.api.disconnect();
  }
}

main().catch(error => {
  outputError(error);
  process.exitCode = 1;
});
