"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  checkBudget,
  formatUnits,
  getStorageCharge,
  parseUnits
} = require("../scripts/common.cjs");

test("parseUnits converts decimal native amounts without floating point", () => {
  assert.equal(parseUnits("10", 14), 1000000000000000n);
  assert.equal(parseUnits("1.25", 14), 125000000000000n);
  assert.equal(parseUnits("0.00000000000001", 14), 1n);
});

test("parseUnits rejects ambiguous or over-precision amounts", () => {
  assert.throws(() => parseUnits("1e3", 14), /Invalid positive token amount/);
  assert.throws(() => parseUnits("1.001", 2), /Too many decimal places/);
  assert.throws(() => parseUnits("-1", 14), /Invalid positive token amount/);
});

test("formatUnits formats large native balances without Number precision loss", () => {
  assert.equal(formatUnits(1000000000000000n, 14, 6), "10");
  assert.equal(formatUnits(1012500000000000n, 14, 6), "10.125");
});

test("getStorageCharge reads Charge enum codecs and JSON metadata", () => {
  assert.equal(getStorageCharge({ isCharge: true, asCharge: 125n }), 125n);
  assert.equal(getStorageCharge({ toJSON: () => ({ charge: "456" }) }), 456n);
  assert.equal(getStorageCharge({ toJSON: () => ({ refund: "456" }) }), 0n);
  assert.equal(getStorageCharge(null), 0n);
});

test("checkBudget includes the storage-deposit cap and protected native reserve", () => {
  const context = { spendable: 1000n, decimals: 2, symbol: "tPOT" };
  const quote = {
    fee: 10n,
    storageCharge: 100n,
    storageDepositLimit: 200n
  };
  const result = checkBudget(context, quote, "test step");
  assert.equal(result.reserve, 100n);
  assert.equal(result.needed, 310n);
});

test("checkBudget refuses a step that would break the reserve", () => {
  const context = { spendable: 309n, decimals: 2, symbol: "tPOT" };
  const quote = {
    fee: 10n,
    storageCharge: 100n,
    storageDepositLimit: 200n
  };
  assert.throws(() => checkBudget(context, quote, "test step"), /not safely funded/);
});
