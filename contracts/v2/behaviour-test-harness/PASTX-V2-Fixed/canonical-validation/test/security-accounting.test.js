const { expect } = require("chai");
const { ethers } = require("hardhat");

const SHARE = ethers.parseEther("1");
const symbol = ethers.encodeBytes32String("SECURITY");
const E = ethers.parseEther;

async function setup() {
  const [owner, alice, bob, outsider, relayer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const Stock = await ethers.getContractFactory("PastxTestStock");
  const stock = await Stock.deploy("PASTX Security Test Stock", "PSTXS", owner.address);

  let market, wrapped;
  if (chainId === 420420777n) {
    const Market = await ethers.getContractFactory("PortalDotNativeMarket");
    market = await Market.deploy(owner.address);
  } else if (chainId === 97n) {
    const Wrapped = await ethers.getContractFactory("WrappedPot");
    wrapped = await Wrapped.deploy(owner.address);
    // Test-only: owner is set as gateway so test cases can fund accounts without
    // relying on a bridge attestation. Never use this configuration in production.
    await wrapped.setGateway(owner.address);
    const Market = await ethers.getContractFactory("BnbWrappedPotMarket");
    market = await Market.deploy(owner.address, await wrapped.getAddress());
    await wrapped.mint(alice.address, E("20"));
    await wrapped.mint(bob.address, E("20"));
    await wrapped.mint(owner.address, E("20"));
    await wrapped.connect(alice).approve(await market.getAddress(), ethers.MaxUint256);
    await wrapped.connect(bob).approve(await market.getAddress(), ethers.MaxUint256);
    await wrapped.connect(owner).approve(await market.getAddress(), ethers.MaxUint256);
  } else {
    throw new Error(`Unexpected test chain ID ${chainId}`);
  }

  await stock.setMarket(await market.getAddress(), true);
  await stock.mint(await market.getAddress(), E("100"));
  await market.configureListing(symbol, await stock.getAddress(), E("0.2"), true);
  await stock.connect(alice).approve(await market.getAddress(), ethers.MaxUint256);
  await stock.connect(bob).approve(await market.getAddress(), ethers.MaxUint256);
  return { owner, alice, bob, outsider, relayer, stock, market, wrapped, chainId };
}

async function buy(ctx, who, shares) {
  if (ctx.chainId === 420420777n) {
    return ctx.market.connect(who).buy(symbol, shares, { value: E("0.2") * shares / SHARE });
  }
  return ctx.market.connect(who).buy(symbol, shares);
}

async function addExtraLiquidity(ctx, amount) {
  if (ctx.chainId === 420420777n) {
    return ctx.market.connect(ctx.owner).addLiquidity({ value: amount });
  }
  return ctx.market.connect(ctx.owner).addLiquidity(amount);
}

async function reserved(ctx) {
  return ctx.chainId === 420420777n
    ? ctx.market.reservedNativeLiquidity()
    : ctx.market.reservedWrappedLiquidity();
}

async function marketBalance(ctx) {
  return ctx.chainId === 420420777n
    ? ethers.provider.getBalance(await ctx.market.getAddress())
    : ctx.wrapped.balanceOf(await ctx.market.getAddress());
}

async function withdraw(ctx, amount, to) {
  return ctx.chainId === 420420777n
    ? ctx.market.withdrawLiquidity(amount, to)
    : ctx.market.withdrawLiquidity(amount, to);
}

describe("PASTX V2 — expanded security and accounting checks", function () {
  it("rejects unauthorized administration and invalid trade inputs", async function () {
    const c = await setup();
    await expect(c.market.connect(c.outsider).setPaused(true))
      .to.be.revertedWithCustomError(c.market, "NotOwner");
    await expect(c.market.connect(c.outsider).configureListing(symbol, await c.stock.getAddress(), E("1"), true))
      .to.be.revertedWithCustomError(c.market, "NotOwner");
    await expect(buy(c, c.alice, 0n)).to.be.revertedWithCustomError(c.market, "InvalidAmount");

    if (c.chainId === 420420777n) {
      await expect(c.market.connect(c.alice).buy(symbol, SHARE, { value: 1n }))
        .to.be.revertedWithCustomError(c.market, "IncorrectPayment");
    }
    await expect(c.market.connect(c.alice).sell(symbol, SHARE))
      .to.be.revertedWithCustomError(c.market, "InsufficientPosition");
  });

  it("keeps reserves and position totals consistent across partial buys and sells", async function () {
    const c = await setup();
    const two = E("2");
    const one = E("1");
    await buy(c, c.alice, two);
    await buy(c, c.bob, one);
    expect(await c.market.positions(c.alice.address, symbol)).to.equal(two);
    expect(await c.market.positions(c.bob.address, symbol)).to.equal(one);
    expect(await c.market.totalPositionShares(symbol)).to.equal(E("3"));
    expect(await reserved(c)).to.equal(E("0.6"));

    await c.market.connect(c.alice).sell(symbol, one);
    expect(await c.market.positions(c.alice.address, symbol)).to.equal(one);
    expect(await c.market.totalPositionShares(symbol)).to.equal(E("2"));
    expect(await reserved(c)).to.equal(E("0.4"));

    await addExtraLiquidity(c, E("0.5"));
    expect(await marketBalance(c)).to.equal(E("0.9"));
    await withdraw(c, E("0.5"), c.owner.address);
    expect(await marketBalance(c)).to.equal(E("0.4"));
    await expect(withdraw(c, 1n, c.owner.address))
      .to.be.revertedWithCustomError(c.market, "ReservedLiquidity");

    await c.market.connect(c.alice).sell(symbol, one);
    await c.market.connect(c.bob).sell(symbol, one);
    expect(await c.market.totalPositionShares(symbol)).to.equal(0n);
    expect(await reserved(c)).to.equal(0n);
    expect(await marketBalance(c)).to.equal(0n);
  });

  it("does not permit changing a listing's token or price while positions remain open", async function () {
    const c = await setup();
    await buy(c, c.alice, SHARE);
    await expect(c.market.configureListing(symbol, await c.stock.getAddress(), E("0.3"), true))
      .to.be.revertedWithCustomError(c.market, "OutstandingPositions");
    const OtherStock = await ethers.getContractFactory("PastxTestStock");
    const other = await OtherStock.deploy("Other Synthetic Stock", "OTHER", c.owner.address);
    await expect(c.market.configureListing(symbol, await other.getAddress(), E("0.2"), true))
      .to.be.revertedWithCustomError(c.market, "OutstandingPositions");
  });

    it("blocks buys but allows funded exits while paused", async function () {
    const c = await setup();
    await buy(c, c.alice, SHARE);

    await c.market.connect(c.owner).setPaused(true);

    await expect(buy(c, c.bob, SHARE))
      .to.be.revertedWithCustomError(c.market, "Paused");

    await c.market.connect(c.alice).sell(symbol, SHARE);

    expect(await c.market.positions(c.alice.address, symbol)).to.equal(0n);
    expect(await c.market.totalPositionShares(symbol)).to.equal(0n);
  });

  it("blocks user-to-user stock transfers while preserving market positions", async function () {
    const c = await setup();
    await buy(c, c.alice, SHARE);

    await expect(c.stock.connect(c.alice).transfer(c.bob.address, SHARE))
      .to.be.revertedWithCustomError(c.stock, "NonTransferable");

    expect(await c.stock.balanceOf(c.alice.address)).to.equal(SHARE);
    expect(await c.stock.balanceOf(c.bob.address)).to.equal(0n);
    expect(await c.market.positions(c.alice.address, symbol)).to.equal(SHARE);
    expect(await c.market.positions(c.bob.address, symbol)).to.equal(0n);
  });

  it("rejects zero-liquidity withdrawals and zero-value liquidity deposits", async function () {
    const c = await setup();
    if (c.chainId === 420420777n) {
      await expect(c.market.connect(c.owner).addLiquidity({ value: 0n }))
        .to.be.revertedWithCustomError(c.market, "InvalidAmount");
      await expect(c.market.withdrawLiquidity(0n, c.owner.address))
        .to.be.revertedWithCustomError(c.market, "InsufficientNativeLiquidity");
    } else {
      await expect(c.market.connect(c.owner).addLiquidity(0n))
        .to.be.revertedWithCustomError(c.market, "InvalidAmount");
      await expect(c.market.withdrawLiquidity(0n, c.owner.address))
        .to.be.revertedWithCustomError(c.market, "InsufficientMarketLiquidity");
    }
  });
});
