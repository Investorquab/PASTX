const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

describe("Portaldot EVM value-semantics probe", function () {
  it("reports exactly msg.value and returns the full test value to the owner", async function () {
    const [owner, sender] = await ethers.getSigners();
    const probe = await (await ethers.getContractFactory("PortalValueSemanticsProbe")).deploy();
    await probe.waitForDeployment();
    const amount = 1_000_000_000_000n;

    const observedReceipt = await (await probe.connect(sender).observeValue({ value: amount })).wait();
    const observed = observedReceipt.logs.map(log => {
      try { return probe.interface.parseLog(log); } catch { return null; }
    }).find(item => item && item.name === "ValueObserved");

    assert.ok(observed);
    assert.equal(observed.args.msgValue, amount);
    assert.equal(observed.args.contractBalance, amount);
    assert.equal(await ethers.provider.getBalance(await probe.getAddress()), amount);

    const returnedReceipt = await (await probe.connect(owner).returnAllToOwner()).wait();
    const returned = returnedReceipt.logs.map(log => {
      try { return probe.interface.parseLog(log); } catch { return null; }
    }).find(item => item && item.name === "ValueReturned");

    assert.ok(returned);
    assert.equal(returned.args.amount, amount);
    assert.equal(await ethers.provider.getBalance(await probe.getAddress()), 0n);
  });
});
