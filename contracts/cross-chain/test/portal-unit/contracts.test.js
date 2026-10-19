const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

describe("PASTX PortalDOT escrow EVM unit model", function () {
  it("records a unique test deposit and locks native test value", async function () {
    const [relayer, user, recipient] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PortalDotTestnetEscrow");
    const escrow = await factory.deploy(relayer.address, 97);
    await escrow.waitForDeployment();

    const amount = 7n;
    const tx = await escrow.connect(user).deposit(recipient.address, { value: amount });
    const receipt = await tx.wait();
    const event = receipt.logs.map(log => { try { return escrow.interface.parseLog(log); } catch { return null; } })
      .find(parsed => parsed && parsed.name === "DepositInitiated");

    assert.ok(event);
    assert.equal(event.args.sender, user.address);
    assert.equal(event.args.destinationRecipient, recipient.address);
    assert.equal(event.args.amount, amount);
    assert.equal(event.args.sourceChainId, 420420777n);
    assert.equal(await escrow.totalDeposited(), amount);
    assert.equal(await ethers.provider.getBalance(escrow.target), amount);
  });

  it("restricts releases, prevents replay, and caps release by deposits", async function () {
    const [relayer, user, recipient] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PortalDotTestnetEscrow");
    const escrow = await factory.deploy(relayer.address, 97);
    await escrow.waitForDeployment();

    const amount = 9n;
    await escrow.connect(user).deposit(recipient.address, { value: amount });
    const withdrawalId = ethers.keccak256(ethers.toUtf8Bytes("withdrawal-one"));
    await assert.rejects(escrow.connect(user).releaseWithdrawal(withdrawalId, recipient.address, 1n));
    await assert.rejects(escrow.connect(relayer).releaseWithdrawal(withdrawalId, recipient.address, 10n));

    await escrow.connect(relayer).releaseWithdrawal(withdrawalId, recipient.address, 4n);
    assert.equal(await escrow.processedWithdrawals(withdrawalId), true);
    assert.equal(await escrow.totalReleased(), 4n);
    await assert.rejects(escrow.connect(relayer).releaseWithdrawal(withdrawalId, recipient.address, 4n));
  });
});
