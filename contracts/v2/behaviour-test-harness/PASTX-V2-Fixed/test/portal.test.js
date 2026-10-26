const { expect } = require("chai");
const { ethers } = require("hardhat");
const SHARE = ethers.parseEther("1");
const symbol = ethers.encodeBytes32String("PSTX");

describe("PASTX V2 — Portaldot market and escrow behaviour (chainId 420420777)", function () {
  it("buys and sells with native value and allows exit after listing disable", async function () {
    const [owner, alice] = await ethers.getSigners();
    const Stock = await ethers.getContractFactory("PastxTestStock");
    const stock = await Stock.deploy("PASTX Synthetic Stock", "PSTX", owner.address);
    const Market = await ethers.getContractFactory("PortalDotNativeMarket");
    const market = await Market.deploy(owner.address);
    await stock.setMarket(await market.getAddress(), true);
    const price = ethers.parseEther("0.2");
    const shares = ethers.parseEther("2");
    await market.configureListing(symbol, await stock.getAddress(), price, true);
    await stock.mint(await market.getAddress(), ethers.parseEther("20"));
    await market.connect(alice).buy(symbol, shares, { value: ethers.parseEther("0.4") });
    expect(await market.positions(alice.address, symbol)).to.equal(shares);
    expect(await market.reservedNativeLiquidity()).to.equal(ethers.parseEther("0.4"));
    await expect(market.withdrawLiquidity(ethers.parseEther("0.01"), owner.address)).to.be.revertedWithCustomError(market, "ReservedLiquidity");
    await stock.connect(alice).approve(await market.getAddress(), shares);
    await market.configureListing(symbol, await stock.getAddress(), price, false);
    await expect(market.connect(alice).buy(symbol, SHARE, { value: price })).to.be.revertedWithCustomError(market, "InvalidListing");
    await market.connect(alice).sell(symbol, shares);
    expect(await market.positions(alice.address, symbol)).to.equal(0n);
    expect(await market.reservedNativeLiquidity()).to.equal(0n);
  });

  it("escrow records deposits, restricts release to relayer, and blocks duplicate releases", async function () {
    const [owner, relayer, alice, recipient] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("PortalDotBridgeEscrow");
    const escrow = await Escrow.deploy(owner.address, relayer.address, 97);
    await escrow.connect(alice).deposit(recipient.address, { value: ethers.parseEther("1") });
    expect(await escrow.totalDeposited()).to.equal(ethers.parseEther("1"));
    const withdrawalId = ethers.keccak256(ethers.toUtf8Bytes("unique-withdrawal"));
    await expect(escrow.connect(alice).release(withdrawalId, recipient.address, ethers.parseEther("0.1"))).to.be.revertedWithCustomError(escrow, "NotRelayer");
    await escrow.connect(relayer).release(withdrawalId, recipient.address, ethers.parseEther("0.1"));
    expect(await escrow.totalReleased()).to.equal(ethers.parseEther("0.1"));
    await expect(escrow.connect(relayer).release(withdrawalId, recipient.address, ethers.parseEther("0.1"))).to.be.revertedWithCustomError(escrow, "DuplicateWithdrawal");
    await expect(escrow.connect(relayer).release(ethers.ZeroHash, recipient.address, 1n)).to.be.revertedWithCustomError(escrow, "InvalidAddress");
  });
});
