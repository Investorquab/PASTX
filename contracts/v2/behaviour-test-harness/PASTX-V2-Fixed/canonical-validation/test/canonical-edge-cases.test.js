const { expect } = require("chai");
const { ethers } = require("hardhat");

const SHARE = ethers.parseEther("1");
const PRICE = ethers.parseEther("0.2");
const SYMBOL = ethers.encodeBytes32String("EDGE");
const E = ethers.parseEther;

async function setup() {
  const [owner, alice, bob, outsider, relayer] =
    await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const Stock = await ethers.getContractFactory("PastxTestStock");
  const stock = await Stock.deploy("PASTX Edge Test Stock", "EDGE", owner.address);

  let market;
  let wrapped;

  if (chainId === 420420777n) {
    const Market = await ethers.getContractFactory("PortalDotNativeMarket");
    market = await Market.deploy(owner.address);
  } else if (chainId === 97n) {
    const Wrapped = await ethers.getContractFactory("WrappedPot");
    wrapped = await Wrapped.deploy(owner.address);

    // Local-test fixture only: never use this gateway configuration in production.
    await wrapped.setGateway(owner.address);
    await wrapped.mint(alice.address, E("100"));
    await wrapped.mint(bob.address, E("100"));
    await wrapped.mint(owner.address, E("100"));

    const Market = await ethers.getContractFactory("BnbWrappedPotMarket");
    market = await Market.deploy(owner.address, await wrapped.getAddress());

    await wrapped.connect(alice).approve(await market.getAddress(), ethers.MaxUint256);
    await wrapped.connect(bob).approve(await market.getAddress(), ethers.MaxUint256);
    await wrapped.connect(owner).approve(await market.getAddress(), ethers.MaxUint256);
  } else {
    throw new Error(`Unexpected chain ID ${chainId}`);
  }

  await stock.setMarket(await market.getAddress(), true);
  await stock.mint(await market.getAddress(), E("100"));
  await market.configureListing(SYMBOL, await stock.getAddress(), PRICE, true);

  return { owner, alice, bob, outsider, relayer, chainId, stock, market, wrapped };
}

async function buy(c, who, shares) {
  if (c.chainId === 420420777n) {
    return c.market.connect(who).buy(SYMBOL, shares, {
      value: PRICE * shares / SHARE
    });
  }
  return c.market.connect(who).buy(SYMBOL, shares);
}

async function sell(c, who, shares) {
  await c.stock.connect(who).approve(await c.market.getAddress(), shares);
  return c.market.connect(who).sell(SYMBOL, shares);
}

async function reserve(c) {
  return c.chainId === 420420777n
    ? c.market.reservedNativeLiquidity()
    : c.market.reservedWrappedLiquidity();
}

async function paymentBalance(c) {
  return c.chainId === 420420777n
    ? ethers.provider.getBalance(await c.market.getAddress())
    : c.wrapped.balanceOf(await c.market.getAddress());
}

describe("PASTX V2 canonical snapshot: expanded edge cases", function () {
  it("keeps position totals and reserved funds consistent across repeated partial trades", async function () {
    const c = await setup();

    await buy(c, c.alice, E("2"));
    await buy(c, c.bob, E("3"));

    expect(await c.market.positions(c.alice.address, SYMBOL)).to.equal(E("2"));
    expect(await c.market.positions(c.bob.address, SYMBOL)).to.equal(E("3"));
    expect(await c.market.totalPositionShares(SYMBOL)).to.equal(E("5"));
    expect(await reserve(c)).to.equal(E("1"));

    await sell(c, c.alice, E("0.5"));

    expect(await c.market.positions(c.alice.address, SYMBOL)).to.equal(E("1.5"));
    expect(await c.market.totalPositionShares(SYMBOL)).to.equal(E("4.5"));
    expect(await reserve(c)).to.equal(E("0.9"));

    await sell(c, c.bob, E("1"));
    await sell(c, c.alice, E("1.5"));
    await sell(c, c.bob, E("2"));

    expect(await c.market.totalPositionShares(SYMBOL)).to.equal(0n);
    expect(await reserve(c)).to.equal(0n);
  });

  it("rejects buys when paused but allows exits after pause and listing disable", async function () {
    const c = await setup();
    await buy(c, c.alice, SHARE);

    await c.market.setPaused(true);
    await expect(buy(c, c.bob, SHARE))
      .to.be.revertedWithCustomError(c.market, "Paused");

    await c.market.configureListing(
      SYMBOL, await c.stock.getAddress(), PRICE, false
    );

    await expect(buy(c, c.bob, SHARE))
      .to.be.revertedWithCustomError(c.market, "Paused");

    await sell(c, c.alice, SHARE);

    expect(await c.market.positions(c.alice.address, SYMBOL)).to.equal(0n);
    expect(await c.market.totalPositionShares(SYMBOL)).to.equal(0n);
    expect(await reserve(c)).to.equal(0n);
  });

  it("rejects owner-only market and stock administration by outsiders", async function () {
    const c = await setup();

    await expect(c.market.connect(c.outsider).setPaused(true))
      .to.be.revertedWithCustomError(c.market, "NotOwner");

    await expect(c.market.connect(c.outsider).configureListing(
      SYMBOL, await c.stock.getAddress(), PRICE, false
    )).to.be.revertedWithCustomError(c.market, "NotOwner");

    await expect(c.stock.connect(c.outsider).setMarket(
      await c.market.getAddress(), false
    )).to.be.revertedWithCustomError(c.stock, "NotOwner");

    await expect(c.stock.connect(c.outsider).mint(
      c.outsider.address, SHARE
    )).to.be.revertedWithCustomError(c.stock, "NotOwner");
  });

  it("rejects transfers between users and preserves their market positions", async function () {
    const c = await setup();
    await buy(c, c.alice, SHARE);

    await expect(c.stock.connect(c.alice).transfer(c.bob.address, SHARE))
      .to.be.revertedWithCustomError(c.stock, "NonTransferable");

    expect(await c.stock.balanceOf(c.alice.address)).to.equal(SHARE);
    expect(await c.market.positions(c.alice.address, SYMBOL)).to.equal(SHARE);
    expect(await c.market.positions(c.bob.address, SYMBOL)).to.equal(0n);
  });

  it("does not let the owner withdraw funds reserved for outstanding positions", async function () {
    const c = await setup();
    await buy(c, c.alice, E("2"));

    const locked = await reserve(c);
    expect(locked).to.equal(E("0.4"));

    if (c.chainId === 420420777n) {
      await expect(c.market.withdrawLiquidity(1n, c.owner.address))
        .to.be.revertedWithCustomError(c.market, "ReservedLiquidity");
    } else {
      await expect(c.market.withdrawLiquidity(1n, c.owner.address))
        .to.be.revertedWithCustomError(c.market, "ReservedLiquidity");
    }

    expect(await reserve(c)).to.equal(locked);
    expect(await paymentBalance(c)).to.be.gte(locked);
  });

  it("rejects attempts to change price or token while positions remain open", async function () {
    const c = await setup();
    await buy(c, c.alice, SHARE);

    await expect(c.market.configureListing(
      SYMBOL, await c.stock.getAddress(), E("0.3"), true
    )).to.be.revertedWithCustomError(c.market, "OutstandingPositions");

    const OtherStock = await ethers.getContractFactory("PastxTestStock");
    const other = await OtherStock.deploy("Other Synthetic Stock", "OTHER", c.owner.address);

    await expect(c.market.configureListing(
      SYMBOL, await other.getAddress(), PRICE, true
    )).to.be.revertedWithCustomError(c.market, "OutstandingPositions");
  });

  it("rejects zero shares and sells exceeding a user's recorded position", async function () {
    const c = await setup();

    await expect(buy(c, c.alice, 0n))
      .to.be.revertedWithCustomError(c.market, "InvalidAmount");

    await expect(c.market.connect(c.alice).sell(SYMBOL, SHARE))
      .to.be.revertedWithCustomError(c.market, "InsufficientPosition");

    await buy(c, c.alice, SHARE);

    await expect(c.market.connect(c.alice).sell(SYMBOL, E("2")))
      .to.be.revertedWithCustomError(c.market, "InsufficientPosition");

    expect(await c.market.positions(c.alice.address, SYMBOL)).to.equal(SHARE);
  });

  it("checks BNB gateway source validation and withdrawal decimal boundaries", async function () {
    if ((await ethers.provider.getNetwork()).chainId !== 97n) this.skip();

    const c = await setup();
    const Gateway = await ethers.getContractFactory("BnbBridgeGateway");
    const gateway = await Gateway.deploy(
      c.owner.address,
      c.relayer.address,
      await c.wrapped.getAddress(),
      420420777,
      c.bob.address,
      14
    );

    await c.wrapped.setGateway(await gateway.getAddress());

    const sourceAmount = 12345n;
    const nonce = 7n;
    const sourceChain = 420420777n;
    const destinationChain = 97n;
    const escrow = c.bob.address;
    const sourceSender = c.alice.address;
    const recipient = c.bob.address;

    const depositId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "address", "address", "uint256", "uint256", "uint256"],
        [sourceChain, escrow, sourceSender, recipient, destinationChain, nonce, sourceAmount]
      )
    );

    const evidence = [
      depositId, sourceSender, recipient, sourceAmount,
      sourceChain, escrow, destinationChain, nonce,
      ethers.keccak256(ethers.toUtf8Bytes("source-tx")), 0n
    ];

    await expect(gateway.connect(c.outsider).completeDeposit(...evidence))
      .to.be.revertedWithCustomError(gateway, "NotRelayer");

    const wrongSource = [...evidence];
    wrongSource[4] = 1n;

    await expect(gateway.connect(c.relayer).completeDeposit(...wrongSource))
      .to.be.revertedWithCustomError(gateway, "WrongSource");

    const balanceBeforeDeposit = await c.wrapped.balanceOf(recipient);

    await gateway.connect(c.relayer).completeDeposit(...evidence);

    expect(await c.wrapped.balanceOf(recipient) - balanceBeforeDeposit)
      .to.equal(sourceAmount * 10000n);

    await expect(gateway.connect(c.relayer).completeDeposit(...evidence))
      .to.be.revertedWithCustomError(gateway, "DuplicateDeposit");

    await expect(gateway.connect(c.alice).requestWithdrawal(1n, c.bob.address))
      .to.be.revertedWithCustomError(gateway, "UnrepresentableAmount");
  });

  it("checks Portaldot escrow relayer authorization and duplicate-release protection", async function () {
    if ((await ethers.provider.getNetwork()).chainId !== 420420777n) this.skip();

    const c = await setup();
    const Escrow = await ethers.getContractFactory("PortalDotBridgeEscrow");
    const escrow = await Escrow.deploy(c.owner.address, c.relayer.address, 97);

    await escrow.connect(c.alice).deposit(c.bob.address, {
      value: E("1")
    });

    const withdrawalId = ethers.keccak256(
      ethers.toUtf8Bytes("edge-case-withdrawal")
    );

    await expect(escrow.connect(c.outsider).release(
      withdrawalId, c.bob.address, E("0.1")
    )).to.be.revertedWithCustomError(escrow, "NotRelayer");

    await escrow.connect(c.relayer).release(
      withdrawalId, c.bob.address, E("0.1")
    );

    await expect(escrow.connect(c.relayer).release(
      withdrawalId, c.bob.address, E("0.1")
    )).to.be.revertedWithCustomError(escrow, "DuplicateWithdrawal");
  });
});

