const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

const UNIT = 10n ** 14n;
const AAPL_TEST = ethers.encodeBytes32String("AAPL-TEST");
const SOURCE_CHAIN_ID = 420420777n;
const DESTINATION_CHAIN_ID = 97n;

describe("PASTX BNB testnet gateway", function () {
  async function deployGateway() {
    const [owner, relayer, user, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("BnbTestnetGateway");
    const gateway = await factory.deploy(relayer.address, SOURCE_CHAIN_ID, other.address);
    await gateway.waitForDeployment();
    return { owner, relayer, user, other, gateway, escrowAddress: other.address };
  }

  function depositIdFor({ sourceEscrow, sender, recipient, amount, nonce = 0n }) {
    return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "address", "address", "uint256", "uint256", "uint256"],
      [SOURCE_CHAIN_ID, sourceEscrow, sender, recipient, DESTINATION_CHAIN_ID, nonce, amount]
    ));
  }

  async function completeDeposit(ctx, overrides = {}) {
    const sender = overrides.sender || ctx.other.address;
    const recipient = overrides.recipient || ctx.user.address;
    const amount = overrides.amount === undefined ? 1_000n * UNIT : overrides.amount;
    const nonce = overrides.nonce === undefined ? 0n : overrides.nonce;
    const sourceEscrow = overrides.sourceEscrow || ctx.escrowAddress;
    const sourceTxHash = overrides.sourceTxHash || ethers.keccak256(ethers.toUtf8Bytes("source-tx-" + nonce));
    const sourceLogIndex = overrides.sourceLogIndex === undefined ? nonce : overrides.sourceLogIndex;
    const depositId = depositIdFor({ sourceEscrow, sender, recipient, amount, nonce });
    await ctx.gateway.connect(ctx.relayer).completeDeposit(
      depositId, sender, recipient, amount, SOURCE_CHAIN_ID, sourceEscrow,
      DESTINATION_CHAIN_ID, nonce, sourceTxHash, sourceLogIndex
    );
    return { depositId, sender, recipient, amount, nonce, sourceEscrow, sourceTxHash, sourceLogIndex };
  }

  it("restricts source-event completion to the configured relayer", async function () {
    const ctx = await deployGateway();
    const sender = ctx.other.address;
    const amount = UNIT;
    const depositId = depositIdFor({ sourceEscrow: ctx.escrowAddress, sender, recipient: ctx.user.address, amount });
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("unsigned-tx"));
    await assert.rejects(ctx.gateway.connect(ctx.user).completeDeposit(
      depositId, sender, ctx.user.address, amount, SOURCE_CHAIN_ID, ctx.escrowAddress,
      DESTINATION_CHAIN_ID, 0n, txHash, 0n
    ));
  });

  it("mints 1:1 raw units and rejects deposit replay", async function () {
    const ctx = await deployGateway();
    const deposit = await completeDeposit(ctx, { amount: 20n * UNIT });
    assert.equal(await ctx.gateway.balanceOf(ctx.user.address), deposit.amount);
    assert.equal(await ctx.gateway.totalBridgedIn(), deposit.amount);
    assert.equal(await ctx.gateway.processedDepositIds(deposit.depositId), true);
    await assert.rejects(ctx.gateway.connect(ctx.relayer).completeDeposit(
      deposit.depositId, deposit.sender, deposit.recipient, deposit.amount, SOURCE_CHAIN_ID,
      deposit.sourceEscrow, DESTINATION_CHAIN_ID, deposit.nonce, deposit.sourceTxHash, deposit.sourceLogIndex
    ));
  });

  it("checks event-derived deposit id and prevents source-log replay", async function () {
    const ctx = await deployGateway();
    const amount = 10n * UNIT;
    const badId = ethers.keccak256(ethers.toUtf8Bytes("forged-id"));
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("same-source-tx"));
    await assert.rejects(ctx.gateway.connect(ctx.relayer).completeDeposit(
      badId, ctx.other.address, ctx.user.address, amount, SOURCE_CHAIN_ID,
      ctx.escrowAddress, DESTINATION_CHAIN_ID, 0n, txHash, 0n
    ));
    const first = await completeDeposit(ctx, { amount, sourceTxHash: txHash, sourceLogIndex: 3n });
    const secondId = depositIdFor({
      sourceEscrow: ctx.escrowAddress, sender: ctx.other.address, recipient: ctx.user.address,
      amount, nonce: 9n
    });
    await assert.rejects(ctx.gateway.connect(ctx.relayer).completeDeposit(
      secondId, ctx.other.address, ctx.user.address, amount, SOURCE_CHAIN_ID,
      ctx.escrowAddress, DESTINATION_CHAIN_ID, 9n, first.sourceTxHash, 3n
    ));
  });

  it("rejects wrong source chain, destination chain, and escrow", async function () {
    const ctx = await deployGateway();
    const amount = UNIT;
    const depositId = depositIdFor({ sourceEscrow: ctx.escrowAddress, sender: ctx.other.address, recipient: ctx.user.address, amount });
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("chain-validation"));
    await assert.rejects(ctx.gateway.connect(ctx.relayer).completeDeposit(
      depositId, ctx.other.address, ctx.user.address, amount, 1n, ctx.escrowAddress, DESTINATION_CHAIN_ID, 0n, txHash, 0n
    ));
    await assert.rejects(ctx.gateway.connect(ctx.relayer).completeDeposit(
      depositId, ctx.other.address, ctx.user.address, amount, SOURCE_CHAIN_ID, ctx.escrowAddress, 56n, 0n, txHash, 0n
    ));
    await assert.rejects(ctx.gateway.connect(ctx.relayer).completeDeposit(
      depositId, ctx.other.address, ctx.user.address, amount, SOURCE_CHAIN_ID, ctx.user.address, DESTINATION_CHAIN_ID, 0n, txHash, 0n
    ));
  });

  it("burns bridged test units and caps aggregate withdrawals", async function () {
    const ctx = await deployGateway();
    const deposit = await completeDeposit(ctx, { amount: 10n * UNIT });
    await assert.rejects(ctx.gateway.connect(ctx.user).requestWithdrawal(11n * UNIT, ctx.other.address));
    const tx = await ctx.gateway.connect(ctx.user).requestWithdrawal(10n * UNIT, ctx.other.address);
    const receipt = await tx.wait();
    const event = receipt.logs.map(log => { try { return ctx.gateway.interface.parseLog(log); } catch { return null; } })
      .find(parsed => parsed && parsed.name === "WithdrawalRequested");
    assert.ok(event);
    assert.equal(event.args.amount, deposit.amount);
    assert.equal(await ctx.gateway.balanceOf(ctx.user.address), 0n);
    assert.equal(await ctx.gateway.totalWithdrawalRequested(), 10n * UNIT);
  });

  it("executes test stock buy/sell against a seeded test reserve", async function () {
    const ctx = await deployGateway();
    const deposit = await completeDeposit(ctx, { amount: 1_000n * UNIT });
    await ctx.gateway.connect(ctx.owner).seedTestMarketLiquidity(1_000n * UNIT);

    const initialBalance = await ctx.gateway.balanceOf(ctx.user.address);
    const oneShare = 1_000_000n;
    await ctx.gateway.connect(ctx.user).buyStock(AAPL_TEST, oneShare);
    assert.equal(await ctx.gateway.stockPositions(ctx.user.address, AAPL_TEST), oneShare);
    assert.equal(await ctx.gateway.balanceOf(ctx.user.address), initialBalance - 200n * UNIT);

    await ctx.gateway.connect(ctx.owner).setStockPrice(AAPL_TEST, 220n * UNIT);
    await ctx.gateway.connect(ctx.user).sellStock(AAPL_TEST, oneShare);
    assert.equal(await ctx.gateway.stockPositions(ctx.user.address, AAPL_TEST), 0n);
    assert.equal(await ctx.gateway.balanceOf(ctx.user.address), initialBalance + 20n * UNIT);
    await assert.rejects(ctx.gateway.connect(ctx.user).requestWithdrawal(initialBalance + 20n * UNIT, ctx.other.address));
  });

  it("rejects unknown stocks, overselling, and unsafe liquidity seeds", async function () {
    const ctx = await deployGateway();
    const unknownStock = ethers.encodeBytes32String("UNKNOWN");
    await assert.rejects(ctx.gateway.connect(ctx.user).buyStock(unknownStock, 1_000_000n));
    await assert.rejects(ctx.gateway.connect(ctx.user).sellStock(AAPL_TEST, 1_000_000n));
    await assert.rejects(ctx.gateway.connect(ctx.user).seedTestMarketLiquidity(UNIT));
    await assert.rejects(ctx.gateway.connect(ctx.owner).seedTestMarketLiquidity(0n));
    await assert.rejects(ctx.gateway.connect(ctx.owner).seedTestMarketLiquidity(1_000_001n * UNIT));
    await ctx.gateway.connect(ctx.owner).seedTestMarketLiquidity(UNIT);
    await assert.rejects(ctx.gateway.connect(ctx.owner).seedTestMarketLiquidity(UNIT));
  });
});
