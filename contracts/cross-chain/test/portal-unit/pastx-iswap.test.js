const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

const PUSD = ethers.parseEther("1000");
const RATE = 1_000_000_000n; // Example only: after verifying the testnet's raw msg.value unit, 1,000 pUSD maps to 0.01 tPOT (1e12 raw units).
const MAX_NATIVE = 1_000_000_000_000n;

async function deploySwap() {
  const [owner, user, other] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("PastxDemoToken")).deploy(ethers.parseEther("1000000"));
  await token.waitForDeployment();
  const swap = await (await ethers.getContractFactory("PastxISwap")).deploy(await token.getAddress(), RATE, MAX_NATIVE);
  await swap.waitForDeployment();
  await (await token.setMinter(await swap.getAddress(), true)).wait();
  return { owner, user, other, token, swap };
}

describe("PastxISwap bounded native test-token pool", function () {
  it("quotes exactly 1,000 faucet pUSD for the configured 0.01-test-value cap", async function () {
    const { swap } = await deploySwap();
    assert.equal(await swap.quoteNativeForPusd(PUSD), MAX_NATIVE);
    assert.equal(await swap.maxNativePerSwapRaw(), MAX_NATIVE);
    assert.equal(await swap.quotePusdForNative(MAX_NATIVE), PUSD);
  });

  it("burns redeemed pUSD and pays only from a funded native reserve", async function () {
    const { owner, user, token, swap } = await deploySwap();
    await (await token.mint(user.address, PUSD)).wait();
    await (await swap.connect(owner).fundNativeLiquidity({ value: MAX_NATIVE })).wait();
    await (await token.connect(user).approve(await swap.getAddress(), PUSD)).wait();

    await (await swap.connect(user).swapPusdForNative(PUSD)).wait();

    assert.equal(await token.balanceOf(user.address), 0n);
    assert.equal(await token.totalSupply(), 0n);
    assert.equal(await ethers.provider.getBalance(await swap.getAddress()), 0n);
    assert.equal(await swap.totalPusdBurned(), PUSD);
    assert.equal(await swap.totalNativePaid(), MAX_NATIVE);
  });

  it("mints pUSD when native test value enters the pool", async function () {
    const { user, token, swap } = await deploySwap();
    await (await swap.connect(user).swapNativeForPusd({ value: MAX_NATIVE })).wait();

    assert.equal(await token.balanceOf(user.address), PUSD);
    assert.equal(await token.totalSupply(), PUSD);
    assert.equal(await ethers.provider.getBalance(await swap.getAddress()), MAX_NATIVE);
    assert.equal(await swap.totalNativeReceived(), MAX_NATIVE);
  });

  it("caps each native input and rejects a payout without enough reserve", async function () {
    const { owner, user, token, swap } = await deploySwap();
    await assert.rejects(swap.connect(user).swapNativeForPusd({ value: MAX_NATIVE + 1n }));
    await (await token.mint(user.address, PUSD)).wait();
    await (await token.connect(user).approve(await swap.getAddress(), PUSD)).wait();
    await assert.rejects(swap.connect(user).swapPusdForNative(PUSD));
    assert.equal(await token.balanceOf(user.address), PUSD);
    assert.equal(await swap.totalPusdBurned(), 0n);
  });

  it("rejects a pUSD swap whose quote exceeds the per-swap limit", async function () {
    const { user, token, swap } = await deploySwap();
    await (await token.mint(user.address, PUSD * 2n)).wait();
    await (await token.connect(user).approve(await swap.getAddress(), PUSD * 2n)).wait();
    await assert.rejects(swap.connect(user).swapPusdForNative(PUSD * 2n));
    assert.equal(await token.balanceOf(user.address), PUSD * 2n);
  });
});
