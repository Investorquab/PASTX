const { expect } = require("chai");
const { ethers } = require("hardhat");

const SHARE = ethers.parseEther("1");
const symbol = ethers.encodeBytes32String("PSTX");

async function deploy() {
  const [owner, relayer, alice, bob] = await ethers.getSigners();
  const Stock = await ethers.getContractFactory("PastxTestStock");
  const stock = await Stock.deploy("PASTX Synthetic Stock", "PSTX", owner.address);
  const Wrapped = await ethers.getContractFactory("WrappedPot");
  const wrapped = await Wrapped.deploy(owner.address);
  const Market = await ethers.getContractFactory("BnbWrappedPotMarket");
  const market = await Market.deploy(owner.address, await wrapped.getAddress());
  await stock.setMarket(await market.getAddress(), true);
  const Gateway = await ethers.getContractFactory("BnbBridgeGateway");
  const gateway = await Gateway.deploy(owner.address, relayer.address, await wrapped.getAddress(), 420420777, bob.address, 14);
  await wrapped.setGateway(await gateway.getAddress());
  return { owner, relayer, alice, bob, stock, wrapped, market, gateway };
}

function depositId(sourceChain, escrow, sender, recipient, destinationChain, nonce, amount) {
  return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "address", "address", "uint256", "uint256", "uint256"],
    [sourceChain, escrow, sender, recipient, destinationChain, nonce, amount]
  ));
}

describe("PASTX V2 â€” BNB market and gateway behaviour (chainId 97)", function () {
  it("buys and sells synthetic shares; reserves only outstanding buy principal", async function () {
    const { owner, alice, bob, stock, wrapped, market, gateway } = await deploy();
    const price = ethers.parseEther("2");
    const shares = ethers.parseEther("3");
    await market.configureListing(symbol, await stock.getAddress(), price, true);
    await stock.mint(await market.getAddress(), ethers.parseEther("100"));
    await gateway.connect((await ethers.getSigners())[1]).completeDeposit(
      depositId(420420777, bob.address, alice.address, alice.address, 97, 0, 100000000000000n),
      alice.address, alice.address, 100000000000000n, 420420777, bob.address, 97, 0,
      ethers.keccak256(ethers.toUtf8Bytes("source-tx-1")), 0
    );
    expect(await wrapped.balanceOf(alice.address)).to.equal(ethers.parseEther("1"));
    // Fund user for this market test with an additional 10 wtPOT via a second valid source event.
    const escrow = bob.address;
    const amount = 1000000000000000n;
    const id2 = depositId(420420777, escrow, alice.address, alice.address, 97, 1, amount);
    await market.connect(owner).configureListing(symbol, await stock.getAddress(), ethers.parseEther("0.1"), true);
    await gateway.connect((await ethers.getSigners())[1]).completeDeposit(id2, alice.address, alice.address, amount, 420420777, escrow, 97, 1, ethers.keccak256(ethers.toUtf8Bytes("source-tx-2")), 0);
    await wrapped.connect(alice).approve(await market.getAddress(), ethers.MaxUint256);
    const cost = ethers.parseEther("0.3");
    await market.connect(alice).buy(symbol, shares);
    expect(await market.positions(alice.address, symbol)).to.equal(shares);
    expect(await market.reservedWrappedLiquidity()).to.equal(cost);
    await expect(market.withdrawLiquidity(ethers.parseEther("0.1"), owner.address)).to.be.revertedWithCustomError(market, "ReservedLiquidity");
    await stock.connect(alice).approve(await market.getAddress(), shares);
    await market.connect(owner).configureListing(symbol, await stock.getAddress(), ethers.parseEther("0.1"), false);
    await expect(market.connect(alice).buy(symbol, SHARE)).to.be.revertedWithCustomError(market, "InvalidListing");
    await market.connect(alice).sell(symbol, shares);
    expect(await market.positions(alice.address, symbol)).to.equal(0n);
    expect(await market.reservedWrappedLiquidity()).to.equal(0n);
  });

  it("enforces gateway-only minting, decimal scaling, and deposit replay protection", async function () {
    const { owner, relayer, alice, bob, wrapped, gateway } = await deploy();
    await expect(wrapped.connect(alice).mint(alice.address, SHARE)).to.be.revertedWithCustomError(wrapped, "NotGateway");
    const escrow = bob.address;
    const sourceAmount = 123456789012345n;
    const id = depositId(420420777, escrow, bob.address, alice.address, 97, 7, sourceAmount);
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("proof-unique-7"));
    await gateway.connect(relayer).completeDeposit(id, bob.address, alice.address, sourceAmount, 420420777, escrow, 97, 7, txHash, 2);
    expect(await wrapped.balanceOf(alice.address)).to.equal(sourceAmount * 10000n);
    await expect(gateway.connect(relayer).completeDeposit(id, bob.address, alice.address, sourceAmount, 420420777, escrow, 97, 7, txHash, 2)).to.be.revertedWithCustomError(gateway, "DuplicateDeposit");
    const idNext = depositId(420420777, escrow, bob.address, alice.address, 97, 8, sourceAmount);
    await expect(gateway.connect(relayer).completeDeposit(idNext, bob.address, alice.address, sourceAmount, 420420777, escrow, 97, 8, txHash, 2)).to.be.revertedWithCustomError(gateway, "DuplicateSourceEvent");
    await expect(gateway.connect(alice).completeDeposit(idNext, bob.address, alice.address, sourceAmount, 420420777, escrow, 97, 8, ethers.keccak256(ethers.toUtf8Bytes("another")), 3)).to.be.revertedWithCustomError(gateway, "NotRelayer");
  });

  it("burns wtPOT on withdrawal request and rejects unrepresentable amounts", async function () {
    const { owner, relayer, alice, bob, wrapped, gateway } = await deploy();
    const amount = 250000000000000n;
    const id = depositId(420420777, bob.address, bob.address, alice.address, 97, 1, amount);
    await gateway.connect(relayer).completeDeposit(id, bob.address, alice.address, amount, 420420777, bob.address, 97, 1, ethers.keccak256(ethers.toUtf8Bytes("withdraw-fund")), 0);
    const before = await wrapped.balanceOf(alice.address);
    await expect(gateway.connect(alice).requestWithdrawal(1n, bob.address)).to.be.revertedWithCustomError(gateway, "UnrepresentableAmount");
    await gateway.connect(alice).requestWithdrawal(before, bob.address);
    expect(await wrapped.balanceOf(alice.address)).to.equal(0n);
  });
});

