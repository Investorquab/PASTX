const assert = require("node:assert/strict");
const { ethers } = require("hardhat");
const UNIT = 10n ** 18n;
const STOCKS = [
  { key: "AAPL-TEST", name: "PASTX Apple Demo", symbol: "pAAPL", price: "200" },
  { key: "NVDA-TEST", name: "PASTX NVIDIA Demo", symbol: "pNVDA", price: "180" },
  { key: "TSLA-TEST", name: "PASTX Tesla Demo", symbol: "pTSLA", price: "250" },
  { key: "MSFT-TEST", name: "PASTX Microsoft Demo", symbol: "pMSFT", price: "400" }
];
const id = s => ethers.encodeBytes32String(s);

describe("PASTX Portaldot market contracts (local EVM semantic tests)", function () {
  async function fixture() {
    const [owner, user, other] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory("PastxDemoToken")).deploy(ethers.parseEther("1000000"));
    await token.waitForDeployment();
    const market = await (await ethers.getContractFactory("PastxMarket")).deploy(await token.getAddress());
    await market.waitForDeployment();
    const faucet = await (await ethers.getContractFactory("PastxFaucet")).deploy(await token.getAddress(), ethers.parseEther("1000"), 3600);
    await faucet.waitForDeployment();
    await (await token.setMinter(await faucet.getAddress(), true)).wait();
    await (await token.setMinter(owner.address, false)).wait();
    const stocks = {};
    for (const s of STOCKS) {
      const share = await (await ethers.getContractFactory("PastxStockToken")).deploy(s.name, s.symbol, await market.getAddress());
      await share.waitForDeployment();
      await (await market.listStock(id(s.key), await share.getAddress(), ethers.parseEther(s.price), await token.getAddress())).wait();
      stocks[s.key] = share;
    }
    return { owner, user, other, token, market, faucet, stocks };
  }

  it("enforces pUSD metadata, cap and minter permissions", async function () {
    const c = await fixture();
    assert.equal(await c.token.name(), "PASTX Demo Dollar");
    assert.equal(await c.token.symbol(), "pUSD");
    assert.equal(Number(await c.token.decimals()), 18);
    assert.equal(await c.token.cap(), ethers.parseEther("1000000"));
    assert.equal(await c.token.minters(await c.faucet.getAddress()), true);
    assert.equal(await c.token.minters(c.owner.address), false);
    await assert.rejects(c.token.connect(c.user).setMinter(c.user.address, true));
    await assert.rejects(c.token.mint(c.user.address, UNIT));
  });

  it("claims pUSD and enforces the per-wallet cooldown", async function () {
    const c = await fixture();
    await (await c.faucet.connect(c.user).claim()).wait();
    assert.equal(await c.token.balanceOf(c.user.address), ethers.parseEther("1000"));
    await assert.rejects(c.faucet.connect(c.user).claim());
  });

  it("does not permit faucet claims to exceed the supply cap", async function () {
    const [owner, user, another] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory("PastxDemoToken")).deploy(ethers.parseEther("1000"));
    await token.waitForDeployment();
    const faucet = await (await ethers.getContractFactory("PastxFaucet")).deploy(await token.getAddress(), ethers.parseEther("1000"), 3600);
    await faucet.waitForDeployment();
    await (await token.setMinter(await faucet.getAddress(), true)).wait();
    await (await token.setMinter(owner.address, false)).wait();
    await (await faucet.connect(user).claim()).wait();
    await assert.rejects(faucet.connect(another).claim());
    assert.equal(await token.totalSupply(), ethers.parseEther("1000"));
  });

  it("registers four pUSD-priced listings", async function () {
    const c = await fixture();
    assert.equal(await c.market.listingCount(), 4n);
    assert.equal((await c.market.paymentToken()).toLowerCase(), (await c.token.getAddress()).toLowerCase());
    for (const s of STOCKS) {
      const row = await c.market.getListing(id(s.key));
      assert.equal(row[0].toLowerCase(), (await c.stocks[s.key].getAddress()).toLowerCase());
      assert.equal(row[1].toLowerCase(), (await c.token.getAddress()).toLowerCase());
      assert.equal(row[2], ethers.parseEther(s.price));
      assert.equal(row[3], true);
    }
  });

  it("buys and sells shares and checks balances and trade events", async function () {
    const c = await fixture();
    await (await c.faucet.connect(c.user).claim()).wait();
    await (await c.token.connect(c.user).approve(await c.market.getAddress(), ethers.parseEther("1000"))).wait();
    const buy = await (await c.market.connect(c.user).buyMarket(id("AAPL-TEST"), 2)).wait();
    assert.equal(await c.token.balanceOf(c.user.address), ethers.parseEther("600"));
    assert.equal(await c.token.balanceOf(await c.market.getAddress()), ethers.parseEther("400"));
    assert.equal(await c.stocks["AAPL-TEST"].balanceOf(c.user.address), 2n * UNIT);
    const trade = buy.logs.map(log => { try { return c.market.interface.parseLog(log); } catch { return null; } }).find(x => x && x.name === "MarketTrade");
    assert.ok(trade);
    assert.equal(trade.args.isBuy, true);
    assert.equal(trade.args.total, ethers.parseEther("400"));

    await (await c.stocks["AAPL-TEST"].connect(c.user).approve(await c.market.getAddress(), UNIT)).wait();
    const before = await c.token.balanceOf(c.user.address);
    await (await c.market.connect(c.user).sellMarket(id("AAPL-TEST"), 1)).wait();
    assert.equal(await c.token.balanceOf(c.user.address), before + ethers.parseEther("200"));
    assert.equal(await c.stocks["AAPL-TEST"].balanceOf(c.user.address), UNIT);
    assert.equal(await c.stocks["AAPL-TEST"].totalSupply(), UNIT);
  });

  it("rejects zero shares, missing allowance, native value and unknown listings", async function () {
    const c = await fixture();
    await assert.rejects(c.market.connect(c.user).buyMarket(id("AAPL-TEST"), 0));
    await assert.rejects(c.market.connect(c.user).buyMarket(id("AAPL-TEST"), 1));
    await assert.rejects(c.market.connect(c.user).buyMarket(id("UNKNOWN"), 1));
    await assert.rejects(c.market.connect(c.user).buyMarket(id("AAPL-TEST"), 1, { value: 1n }));
  });

  it("rolls a failed sell back completely when pUSD reserves are insufficient", async function () {
    const c = await fixture();
    await (await c.faucet.connect(c.user).claim()).wait();
    await (await c.token.connect(c.user).approve(await c.market.getAddress(), ethers.parseEther("1000"))).wait();
    await (await c.market.connect(c.user).buyMarket(id("AAPL-TEST"), 1)).wait();
    await (await c.market.setPrice(id("AAPL-TEST"), ethers.parseEther("300"))).wait();
    await (await c.stocks["AAPL-TEST"].connect(c.user).approve(await c.market.getAddress(), UNIT)).wait();
    const beforePusd = await c.token.balanceOf(c.user.address);
    const beforeShares = await c.stocks["AAPL-TEST"].balanceOf(c.user.address);
    const beforeAllowance = await c.stocks["AAPL-TEST"].allowance(c.user.address, await c.market.getAddress());
    await assert.rejects(c.market.connect(c.user).sellMarket(id("AAPL-TEST"), 1));
    assert.equal(await c.token.balanceOf(c.user.address), beforePusd);
    assert.equal(await c.stocks["AAPL-TEST"].balanceOf(c.user.address), beforeShares);
    assert.equal(await c.stocks["AAPL-TEST"].balanceOf(await c.market.getAddress()), 0n);
    assert.equal(await c.stocks["AAPL-TEST"].allowance(c.user.address, await c.market.getAddress()), beforeAllowance);
  });

  it("rejects duplicate listings, foreign-market tokens and unauthorized administration", async function () {
    const c = await fixture();
    await assert.rejects(c.market.connect(c.user).setPrice(id("AAPL-TEST"), ethers.parseEther("1")));
    await assert.rejects(c.market.listStock(id("AAPL-TEST"), await c.stocks["AAPL-TEST"].getAddress(), ethers.parseEther("200"), await c.token.getAddress()));
    const anotherMarket = await (await ethers.getContractFactory("PastxMarket")).deploy(await c.token.getAddress());
    await anotherMarket.waitForDeployment();
    const foreign = await (await ethers.getContractFactory("PastxStockToken")).deploy("Foreign Synthetic Share", "pOTHER", await anotherMarket.getAddress());
    await foreign.waitForDeployment();
    await assert.rejects(c.market.listStock(id("OTHER-TEST"), await foreign.getAddress(), ethers.parseEther("1"), await c.token.getAddress()));
  });

  it("supports owner-managed prices and disabling a listing", async function () {
    const c = await fixture();
    await (await c.market.setStockEnabled(id("AAPL-TEST"), false)).wait();
    assert.equal((await c.market.getListing(id("AAPL-TEST")))[3], false);
    await assert.rejects(c.market.connect(c.user).buyMarket(id("AAPL-TEST"), 1));
    await assert.rejects(c.market.setPrice(id("AAPL-TEST"), 0));
    await (await c.market.setStockEnabled(id("AAPL-TEST"), true)).wait();
    await (await c.market.setPrice(id("AAPL-TEST"), ethers.parseEther("210"))).wait();
    assert.equal((await c.market.getListing(id("AAPL-TEST")))[2], ethers.parseEther("210"));
  });
});
