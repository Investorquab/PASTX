const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PASTX V2 bridge lifecycle", function () {
  const PORTAL_CHAIN = 420420777n;
  const BNB_CHAIN = 97n;
  const amount = 12345n;

  it("PortalDot deposit records the exact native amount and escrow accounting", async function () {
    if ((await ethers.provider.getNetwork()).chainId !== PORTAL_CHAIN) {
      this.skip();
    }

    const [owner, relayer, alice, recipient] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("PortalDotBridgeEscrow");
    const escrow = await Escrow.deploy(owner.address, relayer.address, BNB_CHAIN);

    const tx = await escrow.connect(alice).deposit(recipient.address, {
      value: amount
    });
    const receipt = await tx.wait();
    const event = receipt.logs
      .map(log => {
        try { return escrow.interface.parseLog(log); }
        catch { return null; }
      })
      .find(parsed => parsed && parsed.name === "DepositInitiated");

    expect(event, "DepositInitiated event missing").to.exist;
    expect(event.args.amount).to.equal(amount);
    expect(event.args.sourceChainId).to.equal(PORTAL_CHAIN);
    expect(event.args.destinationChainId).to.equal(BNB_CHAIN);
    expect(await escrow.totalDeposited()).to.equal(amount);
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(amount);
  });

  it("PortalDot escrow releases only once and never exceeds deposited funds", async function () {
    if ((await ethers.provider.getNetwork()).chainId !== PORTAL_CHAIN) {
      this.skip();
    }

    const [owner, relayer, alice, recipient] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("PortalDotBridgeEscrow");
    const escrow = await Escrow.deploy(owner.address, relayer.address, BNB_CHAIN);

    await escrow.connect(alice).deposit(recipient.address, { value: amount });

    const withdrawalId = ethers.keccak256(
      ethers.toUtf8Bytes("lifecycle-withdrawal-1")
    );

    await expect(
      escrow.connect(relayer).release( withdrawalId, recipient.address, amount + 1n )
    ).to.be.revertedWithCustomError(escrow, "ExceedsEscrowBalance");

    const before = await ethers.provider.getBalance(recipient.address);
    await escrow.connect(relayer).release(withdrawalId, recipient.address, amount);
    const after = await ethers.provider.getBalance(recipient.address);

    expect(after - before).to.equal(amount);
    expect(await escrow.totalReleased()).to.equal(amount);

    await expect(
      escrow.connect(relayer).release(withdrawalId, recipient.address, amount)
    ).to.be.revertedWithCustomError(escrow, "DuplicateWithdrawal");
  });

  it("BNB gateway mints the exact raw EVM amount at 18 decimals and rejects duplicate source events", async function () {
    if ((await ethers.provider.getNetwork()).chainId !== BNB_CHAIN) {
      this.skip();
    }

    const [owner, relayer, alice, recipient, escrowAddress] =
      await ethers.getSigners();

    const Wrapped = await ethers.getContractFactory("WrappedPot");
    const wrapped = await Wrapped.deploy(owner.address);

    const Gateway = await ethers.getContractFactory("BnbBridgeGateway");
    const gateway = await Gateway.deploy(
      owner.address,
      relayer.address,
      await wrapped.getAddress(),
      PORTAL_CHAIN,
      escrowAddress.address,
      18
    );

    await wrapped.setGateway(await gateway.getAddress());

    const nonce = 0n;
    const sourceTxHash = ethers.keccak256(ethers.toUtf8Bytes("source-tx-1"));
    const sourceLogIndex = 0n;

    const depositId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "address", "address", "uint256", "uint256", "uint256"],
        [
          PORTAL_CHAIN,
          escrowAddress.address,
          alice.address,
          recipient.address,
          BNB_CHAIN,
          nonce,
          amount
        ]
      )
    );

    const evidence = [
      depositId, alice.address, recipient.address, amount,
      PORTAL_CHAIN, escrowAddress.address, BNB_CHAIN, nonce,
      sourceTxHash, sourceLogIndex
    ];

    await gateway.connect(relayer).completeDeposit(...evidence);

    expect(await wrapped.balanceOf(recipient.address)).to.equal(amount);

    await expect(
      gateway.connect(relayer).completeDeposit(...evidence)
    ).to.be.revertedWithCustomError(gateway, "DuplicateDeposit");

    const anotherNonce = 1n;
    const anotherDepositId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "address", "address", "uint256", "uint256", "uint256"],
        [PORTAL_CHAIN, escrowAddress.address, alice.address, recipient.address, BNB_CHAIN, anotherNonce, amount]
      )
    );
    await expect(
      gateway.connect(relayer).completeDeposit(
        anotherDepositId, alice.address, recipient.address, amount,
        PORTAL_CHAIN, escrowAddress.address, BNB_CHAIN, anotherNonce,
        sourceTxHash, sourceLogIndex
      )
    ).to.be.revertedWithCustomError(gateway, "DuplicateSourceEvent");
  });

  it("BNB withdrawal preserves raw EVM units at 18 decimals", async function () {
    if ((await ethers.provider.getNetwork()).chainId !== BNB_CHAIN) {
      this.skip();
    }

    const [owner, relayer, alice, recipient, escrowAddress] =
      await ethers.getSigners();

    const Wrapped = await ethers.getContractFactory("WrappedPot");
    const wrapped = await Wrapped.deploy(owner.address);

    const Gateway = await ethers.getContractFactory("BnbBridgeGateway");
    const gateway = await Gateway.deploy(
      owner.address,
      relayer.address,
      await wrapped.getAddress(),
      PORTAL_CHAIN,
      escrowAddress.address,
      18
    );

    await wrapped.setGateway(await gateway.getAddress());

    const seedNonce = 0n;
    const seedTxHash = ethers.keccak256(ethers.toUtf8Bytes("withdrawal-seed-tx"));
    const seedDepositId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "address", "address", "uint256", "uint256", "uint256"],
        [PORTAL_CHAIN, escrowAddress.address, alice.address, alice.address, BNB_CHAIN, seedNonce, amount]
      )
    );

    await gateway.connect(relayer).completeDeposit(
      seedDepositId, alice.address, alice.address, amount,
      PORTAL_CHAIN, escrowAddress.address, BNB_CHAIN, seedNonce,
      seedTxHash, 0n
    );

    const oneUnitTx = await gateway.connect(alice).requestWithdrawal(
      1n,
      recipient.address
    );
    const oneUnitReceipt = await oneUnitTx.wait();
    const oneUnitEvent = oneUnitReceipt.logs
      .map(log => {
        try { return gateway.interface.parseLog(log); }
        catch { return null; }
      })
      .find(parsed => parsed && parsed.name === "WithdrawalRequested");

    expect(oneUnitEvent, "One-unit withdrawal event missing").to.exist;
    expect(oneUnitEvent.args.wrappedAmount).to.equal(1n);
    expect(oneUnitEvent.args.sourceAmount).to.equal(1n);

    const burnAmount = amount - 1n;
    const supplyBefore = await wrapped.totalSupply();

    const tx = await gateway.connect(alice).requestWithdrawal(
      burnAmount,
      recipient.address
    );
    const receipt = await tx.wait();

    const event = receipt.logs
      .map(log => {
        try { return gateway.interface.parseLog(log); }
        catch { return null; }
      })
      .find(parsed => parsed && parsed.name === "WithdrawalRequested");

    expect(event, "WithdrawalRequested event missing").to.exist;
    expect(event.args.wrappedAmount).to.equal(burnAmount);
    expect(event.args.sourceAmount).to.equal(burnAmount);
    expect(await wrapped.balanceOf(alice.address)).to.equal(0n);
    expect(await wrapped.totalSupply()).to.equal(supplyBefore - burnAmount);
  });
});
