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

async function main() {
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
    configuration: { pUSD: { symbol: "pUSD", decimals: 18, cap: "1000000", capRaw: CAP.toString() }, faucet: { claimAmount: "1000 pUSD", claimAmountRaw: CLAIM.toString(), cooldownSeconds: COOLDOWN }, paymentModel: "All four listings use pUSD; native tPOTv3 is for gas only.", prices: STOCKS.map(s => ({ listing: s.key, symbol: s.symbol, pricePusd: s.price })) },
    contracts: { demoToken: null, market: null, faucet: null, stocks: {} },
    transactions: [],
    verification: { completed: false, checks: [] },
    frontendEnv: null,
    limitations: ["pUSD is valueless test currency, not USDC/USDT and not redeemable.", "Synthetic stock tokens do not represent issuer equity.", "Prices are fixed and owner-set, not live quotes or oracle values.", "This deployment does not activate the iBridge simulation."]
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

    stage = "deploy market";
    const market = await deploy("PastxMarket", [tokenAddress], "market", { paymentToken: tokenAddress });
    const marketAddress = await market.getAddress();

    stage = "deploy faucet";
    const faucet = await deploy("PastxFaucet", [tokenAddress, CLAIM, COOLDOWN], "faucet", { claimAmount: "1000 pUSD", cooldownSeconds: COOLDOWN });
    const faucetAddress = await faucet.getAddress();

    stage = "authorize faucet minter role";
    await send("Authorize faucet to mint pUSD", () => token.setMinter(faucetAddress, true));
    stage = "revoke deployer direct minter role";
    await send("Disable deployer direct pUSD mint", () => token.setMinter(deployer.address, false));

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
    if (!(await token.minters(faucetAddress)) || await token.minters(deployer.address)) throw new Error("pUSD minter permissions are incorrect.");
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
    manifest.frontendEnv = { VITE_PASTX_PORTAL_MARKET: marketAddress, VITE_PASTX_PORTAL_TOKEN: tokenAddress, VITE_PASTX_PORTAL_FAUCET: faucetAddress };
    manifest.status = "deployed-and-verified";
    manifest.finishedAt = new Date().toISOString();

    const abiDir = path.join(runDirectory, "abi");
    await fs.mkdir(abiDir, { recursive: true });
    for (const name of ["PastxDemoToken", "PastxFaucet", "PastxStockToken", "PastxMarket"]) {
      const artifact = await hre.artifacts.readArtifact(name);
      await fs.writeFile(path.join(abiDir, name + ".json"), JSON.stringify(artifact.abi, null, 2) + "\n", "utf8");
    }
    const envText = "# Public contract addresses only. Copy to apps/web/.env.local.\n" +
      "VITE_PASTX_PORTAL_MARKET=" + marketAddress + "\n" +
      "VITE_PASTX_PORTAL_TOKEN=" + tokenAddress + "\n" +
      "VITE_PASTX_PORTAL_FAUCET=" + faucetAddress + "\n";
    await fs.writeFile(path.join(runDirectory, "frontend.env"), envText, "utf8");
    await fs.writeFile(path.join(outputRoot, "frontend.env"), envText, "utf8");

    const lines = ["# PASTX Portaldot V3 testnet deployment", "", "- Status: " + manifest.status, "- Chain ID: " + manifest.network.chainId, "- Deployer: " + manifest.deployer, "- Started: " + startedAt, "- Finished: " + manifest.finishedAt, "", "## Core contracts", "", "- pUSD: " + tokenAddress + " — tx " + manifest.contracts.demoToken.deploymentTransactionHash, "- Market: " + marketAddress + " — tx " + manifest.contracts.market.deploymentTransactionHash, "- Faucet: " + faucetAddress + " — tx " + manifest.contracts.faucet.deploymentTransactionHash, "", "## Synthetic listings", ""];
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
