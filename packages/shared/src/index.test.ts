import { describe, expect, it } from "vitest";
import {
  calculateReferenceNotional,
  isCandleInterval,
  MARKET_INSTRUMENTS,
  parsePreviewQuantity
} from "./index";

describe("market domain contracts", () => {
  it("classifies external stocks as reference instruments", () => {
    expect(MARKET_INSTRUMENTS).toHaveLength(4);
    expect(MARKET_INSTRUMENTS.every((item) => item.kind === "reference")).toBe(true);
    expect(MARKET_INSTRUMENTS.every((item) => item.description.includes("not an on-chain equity token"))).toBe(true);
  });

  it("only accepts supported candle intervals", () => {
    expect(isCandleInterval("1min")).toBe(true);
    expect(isCandleInterval("1day")).toBe(true);
    expect(isCandleInterval("2min")).toBe(false);
    expect(isCandleInterval("")).toBe(false);
  });
});

describe("shared non-executable order preview arithmetic", () => {
  it("calculates reference notional without creating an order", () => {
    expect(calculateReferenceNotional("2.5", 100)).toBe(250);
  });

  it("rejects empty, zero, negative, non-finite and oversized quantities", () => {
    for (const raw of ["", " ", "0", "-1", "Infinity", "NaN", "1000001"]) {
      expect(parsePreviewQuantity(raw)).toBeNull();
      expect(calculateReferenceNotional(raw, 100)).toBeNull();
    }
  });

  it("rejects invalid prices and arithmetic overflow", () => {
    expect(calculateReferenceNotional("1", 0)).toBeNull();
    expect(calculateReferenceNotional("1", -10)).toBeNull();
    expect(calculateReferenceNotional("1000000", Number.MAX_VALUE)).toBeNull();
  });
});
