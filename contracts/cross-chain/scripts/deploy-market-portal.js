const fs = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");
const { assertPortalTestnet, redactError } = require("./portal-network");
const CAP = hre.ethers.parseEther("1000000");
const CLAIM = hre.ethers.parseEther("1000");
const COOLDOWN = 3600;
const STOCKS = [
  { key: "AAPL-TEST", name: "PASTX Apple Demo", symbol: "pAAPL", price: "200" },
  { key: "NVDA-TEST", name: "PASTX NVIDIA Demo", symbol: "pNVDA", price: "180" },
  { key: "TSLA-TEST", name: "PASTX Tesla Demo", symbol: "pTSLA", price: "250" },
  { key: "MSFT-TEST", name: "PASTX Microsoft Demo", symbol: "pMSFT", price: "400" }
];
const keyOf = s => hre.ethers.encodeBytes32String(s);
const runIdOf = d => d.toISOString().replace(/[:.]/g, "-");

function requiredRaw(name) {
  const value = (process.env[name] || "").trim();
  if (!/^[0-9]+$/.test(value) || BigInt(value) <= 0n) {
    throw new Error("Set " + name + " to a positive raw-unit integer after independently verifying Portaldot EVM native-value semantics.");
  }
  return BigInt(value);
}

function readISwapConfig() {
  if (process.env.PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED !== "true") {
    throw new Error("Deployment blocked: verify Portaldot EVM msg.value/native-value units with a small test first, then set PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED=true locally.");
  }
  const rate = requiredRaw("PASTX_ISWAP_NATIVE_RAW_PER_WHOLE_PUSD");
  const maxNative = requiredRaw("PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW");
  const seed = requiredRaw("PASTX_ISWAP_INITIAL_LIQUIDITY_RAW");
  const bridgeCap = requiredRaw("PASTX_BRIDGE_MAX_DEPOSIT_RAW");
  const quote = (CLAIM * rate) / hre.ethers.parseEther("1");
  if (quote !== maxNative) {
    throw new Error("iSwap configuration mismatch: exactly one 1,000 pUSD faucet claim must quote to PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW.");
  }
  if (seed !== maxNative) {
    throw new Error("For the judge demo, seed liquidity must equal one capped swap: PASTX_ISWAP_INITIAL_LIQUIDITY_RAW must equal PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW.");
  }
  if (bridgeCap !== maxNative) {
    throw new Error("iSwap and iBridge amount caps must match: PASTX_BRIDGE_MAX_DEPOSIT_RAW must equal PASTX_ISWAP_MAX_NATIVE_PER_SWAP_RAW.");
  }
  return { rate, maxNative, seed, bridgeCap };
}

async function main() {
  const iSwapConfig = readISwapConfig();
  const preflight = await assertPortalTestnet(hre);
  const [deployer] = await hre.ethers.getSigners();
  const startedAt = new Date().toISOString();
  const runId = runIdOf(new Date(startedAt));
  const outputRoot = path.resolve(process.env.PASTX_DEPLOYMENT_OUTPUT_DIR || path.join(__dirname, "..", "deployments", "portal-v3-testnet"));
  const runDirectory = path.join(outputRoot, runId);
  const manifest = {
    schemaVersion: 1,
    product: "PASTX Portaldot V3 synthetic market",
    status: "in-progress",
    startedAt,
    finishedAt: null,
    network: { name: "Portaldot V3 Testnet", chainId: preflight.chainId.toString(), rpcConfiguration: process.env.PORTALDOT_V3_EVM_RPC_URL ? "operator-configured" : "default-configured", nativeCurrency: { name: "tPOTv3", symbol: "tPOTv3", decimals: 14 }, blockNumberAtStart: preflight.blockNumber },
    deployer: deployer.address,
    deployerNativeBalanceAtStart: { raw: preflight.balance.toString(), tPOTv3: hre.ethers.formatUnits(preflight.balance, 14) },
    configuration: { pUSD: { symbol: "pUSD", decimals: 18, cap: "1000000", capRaw: CAP.toString() }, faucet: { claimAmount: "1000 pUSD", claimAmountRaw: CLAIM.toString(), cooldownSeconds: COOLDOWN }, paymentModel: "All four listings use pUSD; native tPOTv3 is used for gas and the capped test-only iSwap pool.", iSwap: { nativeRawPerWholePusd: iSwapConfig.rate.toString(), maxNativePerSwapRaw: iSwapConfig.maxNative.toString(), initialNativeLiquidityRaw: iSwapConfig.seed.toString(), semanticsVerifiedByOperator: true }, prices: STOCKS.map(s => ({ listing: s.key, symbol: s.symbol, pricePusd: s.price })) },
    contracts: { demoToken: null, market: null, faucet: null, iSwap: null, stocks: {} },
    transactions: [],
    verification: { completed: false, checks: [] },
    frontendEnv: null,
    limitations: ["pUSD is valueless test currency, not USDC/USDT or fiat-redeemable; iSwap only converts it against a capped, funded native test-value pool.", "Synthetic stock tokens do not represent issuer equity.", "Prices are fixed and owner-set, not live quotes or oracle values.", "This deployment does not activate the iBridge simulation."]
  };

  async function save() {
    await fs.mkdir(runDirectory, { recursive: true });
    const json = JSON.stringify(manifest, null, 2) + "\n";
    await fs.writeFile(path.join(runDirectory, "deployment.json"), json, "utf8");
    await fs.writeFile(path.join(outputRoot, "latest.json"), json, "utf8");
  }
  async function send(label, submit) {
    const tx = await submit();
    const row = { step: label, transactionHash: tx.hash, status: "submitted" };
    manifest.transactions.push(row);
    await save();
    const receipt = await tx.wait(1);
    if (!receipt || (receipt.status !== 1 && receipt.status !== 1n)) throw new Error("Transaction failed at " + label + "; hash " + tx.hash);
    row.status = "confirmed";
    row.blockNumber = Number(receipt.blockNumber);
    row.gasUsed = receipt.gasUsed.toString();
    await save();
    console.log("CONFIRMED " + label + ": " + tx.hash);
  }
  async function deploy(name, args, key, extra = {}) {
    const instance = await (await hre.ethers.getContractFactory(name)).deploy(...args);
    const tx = instance.deploymentTransaction();
    if (!tx) throw new Error("No deployment transaction for " + name);
    const row = { step: "Deploy " + name, contractName: name, transactionHash: tx.hash, status: "submitted" };
    manifest.transactions.push(row);
    await save();
    const receipt = await tx.wait(1);
    if (!receipt || (receipt.status !== 1 && receipt.status !== 1n)) throw new Error("Deployment failed for " + name + "; hash " + tx.hash);
    await instance.waitForDeployment();
    const address = await instance.getAddress();
    row.status = "confirmed"; row.contractAddress = address; row.blockNumber = Number(receipt.blockNumber); row.gasUsed = receipt.gasUsed.toString();
    if (key !== "stocks") manifest.contracts[key] = { contractName: name, address, deploymentTransactionHash: tx.hash, deploymentBlock: row.blockNumber, ...extra };
    await save();
    console.log("DEPLOYED " + name + ": " + address + " (tx " + tx.hash + ")");
    return instance;
  }

  let stage = "initialize deployment manifest";
  await save();
  try {
    stage = "deploy pUSD";
    const token = await deploy("PastxDemoToken", [CAP], "demoToken", { name: "PASTX Demo Dollar", symbol: "pUSD", decimals: 18, cap: "1000000" });
    const tokenAddress = await token.getAddress();

    stage = "deploy bounded iSwap";
    const swap = await deploy("PastxISwap", [tokenAddress, iSwapConfig.rate, iSwapConfig.maxNative], "iSwap", {
      demoToken: tokenAddress,
      nativeRawPerWholePusd: iSwapConfig.rate.toString(),
      maxNativePerSwapRaw: iSwapConfig.maxNative.toString(),
      nativeValueSemanticsVerified: true
    });
    const swapAddress = await swap.getAddress();

    stage = "deploy market";
    const market = await deploy("PastxMarket", [tokenAddress], "market", { paymentToken: tokenAddress });
    const marketAddress = await market.getAddress();

    stage = "deploy faucet";
    const faucet = await deploy("PastxFaucet", [tokenAddress, CLAIM, COOLDOWN], "faucet", { claimAmount: "1000 pUSD", cooldownSeconds: COOLDOWN });
    const faucetAddress = await faucet.getAddress();

    stage = "authorize faucet minter role";
    await send("Authorize faucet to mint pUSD", () => token.setMinter(faucetAddress, true));
    stage = "authorize iSwap minter";
    await send("Authorize iSwap to mint pUSD for native-to-demo swaps", () => token.setMinter(swapAddress, true));
    stage = "revoke deployer direct minter role";
    await send("Disable deployer direct pUSD mint", () => token.setMinter(deployer.address, false));

    stage = "seed capped iSwap native liquidity";
    await send("Seed iSwap with one capped native-value swap", () => swap.fundNativeLiquidity({ value: iSwapConfig.seed }));

    for (const s of STOCKS) {
      stage = "deploy synthetic share token " + s.key;
      const share = await deploy("PastxStockToken", [s.name, s.symbol, marketAddress], "stocks");
      const address = await share.getAddress();
      const deployRow = manifest.transactions[manifest.transactions.length - 1];
      manifest.contracts.stocks[s.key] = { contractName: "PastxStockToken", address, deploymentTransactionHash: deployRow.transactionHash, deploymentBlock: deployRow.blockNumber, listing: s.key, name: s.name, symbol: s.symbol, pricePusd: s.price };
      await save();
      stage = "register listing " + s.key;
      await send("Register " + s.key + " at " + s.price + " pUSD", () => market.listStock(keyOf(s.key), address, hre.ethers.parseEther(s.price), tokenAddress));
    }

    stage = "verify deployment and listings";
    const network = await hre.ethers.provider.getNetwork();
    const endBlock = await hre.ethers.provider.getBlockNumber();
    if (network.chainId !== 420420777n) throw new Error("Network changed during deployment.");
    if (await token.name() !== "PASTX Demo Dollar" || await token.symbol() !== "pUSD" || Number(await token.decimals()) !== 18 || await token.cap() !== CAP) throw new Error("pUSD metadata/cap verification failed.");
    if ((await market.paymentToken()).toLowerCase() !== tokenAddress.toLowerCase()) throw new Error("Market pUSD binding failed.");
    if ((await faucet.token()).toLowerCase() !== tokenAddress.toLowerCase() || await faucet.claimAmount() !== CLAIM || await faucet.cooldown() !== BigInt(COOLDOWN)) throw new Error("Faucet configuration verification failed.");
    if (!(await token.minters(faucetAddress)) || !(await token.minters(swapAddress)) || await token.minters(deployer.address)) throw new Error("pUSD minter permissions are incorrect.");
    if ((await swap.token()).toLowerCase() !== tokenAddress.toLowerCase() || await swap.nativeRawPerWholePusd() !== iSwapConfig.rate || await swap.maxNativePerSwapRaw() !== iSwapConfig.maxNative || await hre.ethers.provider.getBalance(swapAddress) < iSwapConfig.seed) throw new Error("iSwap token, rate, cap, or native liquidity verification failed.");
    if (await market.listingCount() !== 4n) throw new Error("Expected exactly four listings.");

    const listingChecks = [];
    for (const s of STOCKS) {
      const item = manifest.contracts.stocks[s.key];
      for (const address of [tokenAddress, marketAddress, faucetAddress, item.address]) {
        if (await hre.ethers.provider.getCode(address) === "0x") throw new Error("No bytecode at " + address);
      }
      const row = await market.getListing(keyOf(s.key));
      if (row[0].toLowerCase() !== item.address.toLowerCase() || row[1].toLowerCase() !== tokenAddress.toLowerCase() || row[2] !== hre.ethers.parseEther(s.price) || row[3] !== true) throw new Error("Listing mismatch: " + s.key);
      const share = await hre.ethers.getContractAt("PastxStockToken", item.address);
      if ((await share.market()).toLowerCase() !== marketAddress.toLowerCase() || await share.symbol() !== s.symbol) throw new Error("Share token mismatch: " + s.key);
      listingChecks.push({ listing: s.key, stockToken: item.address, paymentToken: row[1], pricePusd: s.price, enabled: row[3] });
    }

    manifest.network.blockNumberAtEnd = endBlock;
    manifest.verification = { completed: true, completedAt: new Date().toISOString(), checks: ["Chain ID checked before deploy and after.", "All contract addresses contain deployed bytecode.", "pUSD metadata, decimals and cap verified.", "Faucet settings and minter permissions verified.", "Market uses pUSD.", "Four enabled pUSD listings and prices verified.", "Synthetic token market authorities verified."], listings: listingChecks };
    manifest.frontendEnv = { VITE_PASTX_PORTAL_MARKET: marketAddress, VITE_PASTX_PORTAL_TOKEN: tokenAddress, VITE_PASTX_PORTAL_FAUCET: faucetAddress, VITE_PASTX_PORTAL_ISWAP_ADDRESS: swapAddress, VITE_PASTX_BRIDGE_MAX_DEPOSIT_RAW: iSwapConfig.bridgeCap.toString(), VITE_PASTX_SOURCE_VALUE_SEMANTICS_VERIFIED: "true" };
    manifest.status = "deployed-and-verified";
    manifest.finishedAt = new Date().toISOString();

    const abiDir = path.join(runDirectory, "abi");
    await fs.mkdir(abiDir, { recursive: true });
    for (const name of ["PastxDemoToken", "PastxFaucet", "PastxStockToken", "PastxMarket", "PastxISwap"]) {
      const artifact = await hre.artifacts.readArtifact(name);
      await fs.writeFile(path.join(abiDir, name + ".json"), JSON.stringify(artifact.abi, null, 2) + "\n", "utf8");
    }
    const envText = "# Public contract addresses only. Copy to apps/web/.env.local.\n" +
      "VITE_PASTX_PORTAL_MARKET=" + marketAddress + "\n" +
      "VITE_PASTX_PORTAL_TOKEN=" + tokenAddress + "\n" +
      "VITE_PASTX_PORTAL_FAUCET=" + faucetAddress + "\n" +
      "VITE_PASTX_PORTAL_ISWAP_ADDRESS=" + swapAddress + "\n" +
      "VITE_PASTX_BRIDGE_MAX_DEPOSIT_RAW=" + iSwapConfig.bridgeCap.toString() + "\n" +
      "VITE_PASTX_SOURCE_VALUE_SEMANTICS_VERIFIED=true\n";
    await fs.writeFile(path.join(runDirectory, "frontend.env"), envText, "utf8");
    await fs.writeFile(path.join(outputRoot, "frontend.env"), envText, "utf8");

    const lines = ["# PASTX Portaldot V3 testnet deployment", "", "- Status: " + manifest.status, "- Chain ID: " + manifest.network.chainId, "- Deployer: " + manifest.deployer, "- Started: " + startedAt, "- Finished: " + manifest.finishedAt, "", "## Core contracts", "", "- pUSD: " + tokenAddress + " — tx " + manifest.contracts.demoToken.deploymentTransactionHash, "- iSwap: " + swapAddress + " — tx " + manifest.contracts.iSwap.deploymentTransactionHash + " (one 1,000 pUSD claim maps to one capped native-test-value payout)", "- Market: " + marketAddress + " — tx " + manifest.contracts.market.deploymentTransactionHash, "- Faucet: " + faucetAddress + " — tx " + manifest.contracts.faucet.deploymentTransactionHash, "", "## Synthetic listings", ""];
    for (const s of STOCKS) {
      const item = manifest.contracts.stocks[s.key];
      lines.push("- " + s.key + " (" + s.symbol + ", " + s.price + " pUSD): " + item.address + " — tx " + item.deploymentTransactionHash);
    }
    lines.push("", "Test-only currency/shares. Verify transaction hashes against the official explorer/RPC.");
    const addressText = lines.join("\n") + "\n";
    await fs.writeFile(path.join(runDirectory, "addresses.md"), addressText, "utf8");
    await fs.writeFile(path.join(outputRoot, "addresses.md"), addressText, "utf8");
    await save();

    console.log("PASTX DEPLOYMENT COMPLETE");
    console.log("Manifest: " + path.join(runDirectory, "deployment.json"));
    console.log("Latest manifest: " + path.join(outputRoot, "latest.json"));
    console.log("Addresses: " + path.join(outputRoot, "addresses.md"));
    console.log("Frontend env: " + path.join(outputRoot, "frontend.env"));
    console.log("ABIs: " + abiDir);
  } catch (error) {
    manifest.status = "partial-failure";
    manifest.finishedAt = new Date().toISOString();
    manifest.failure = { stage, note: "Inspect latest.json and transaction hashes before deciding whether to resume. Do not rerun blindly." };
    await save();
    throw new Error(stage + ": " + redactError(error));
  }
}
main().catch(error => { console.error(redactError(error)); process.exitCode = 1; });
