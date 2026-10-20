const assert = require("node:assert/strict");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const UNIT = 10n ** 18n;
const AAPL = ethers.encodeBytes32String("AAPL-TEST");
const TSLA = ethers.encodeBytes32String("TSLA-TEST");

describe("PASTX test market contracts", function () {
  async function fixture() {
    const [, user] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory("PastxDemoToken")).deploy(ethers.parseEther("1000000"));
    const market = await (await ethers.getContractFactory("PastxMarket")).deploy();
    const faucet = await (await ethers.getContractFactory("PastxFaucet")).deploy(await token.getAddress(), ethers.parseEther("1000"), 3600);
    await token.setMinter(await faucet.getAddress(), true);
    const aapl = await (await ethers.getContractFactory("PastxStockToken")).deploy("PASTX Apple Demo", "pAAPL", await market.getAddress());
    const tsla = await (await ethers.getContractFactory("PastxStockToken")).deploy("PASTX Tesla Demo", "pTSLA", await market.getAddress());
    await market.listStock(AAPL, await aapl.getAddress(), ethers.parseEther("200"), await token.getAddress());
    await market.listStock(TSLA, await tsla.getAddress(), ethers.parseEther("250"), ethers.ZeroAddress);
    return { user, token, market, faucet, aapl, tsla };
  }

  it("claims demo tokens and enforces faucet cooldown", async function () {
    const c = await fixture();
    await c.faucet.connect(c.user).claim();
    assert.equal(await c.token.balanceOf(c.user.address), ethers.parseEther("1000"));
    await assert.rejects(c.faucet.connect(c.user).claim());
  });

  it("buys and sells pUSD-priced synthetic shares", async function () {
    const c = await fixture();
    await c.faucet.connect(c.user).claim();
    await c.token.connect(c.user).approve(await c.market.getAddress(), ethers.parseEther("1000"));
    await expect(c.market.connect(c.user).buyMarket(AAPL, 2)).to.emit(c.market, "MarketTrade");
    assert.equal(await c.aapl.balanceOf(c.user.address), 2n * UNIT);
    await c.aapl.connect(c.user).approve(await c.market.getAddress(), 2n * UNIT);
    const before = await c.token.balanceOf(c.user.address);
    await c.market.connect(c.user).sellMarket(AAPL, 1);
    assert.equal(await c.aapl.balanceOf(c.user.address), UNIT);
    assert.equal(await c.token.balanceOf(c.user.address), before + ethers.parseEther("200"));
  });

  it("supports native-token buys and sells", async function () {
    const c = await fixture();
    await c.market.connect(c.user).buyMarket(TSLA, 1, { value: ethers.parseEther("250") });
    assert.equal(await c.tsla.balanceOf(c.user.address), UNIT);
    await c.tsla.connect(c.user).approve(await c.market.getAddress(), UNIT);
    const before = await ethers.provider.getBalance(c.user.address);
    const tx = await c.market.connect(c.user).sellMarket(TSLA, 1);
    const receipt = await tx.wait();
    assert.equal(await ethers.provider.getBalance(c.user.address), before + ethers.parseEther("250") - receipt.gasUsed * receipt.gasPrice);
  });
});
