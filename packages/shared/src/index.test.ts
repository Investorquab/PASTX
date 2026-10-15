import { describe, expect, it } from "vitest";
import {
  buildOrderIntentPreview,
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

describe("shared non-executable order preview", () => {
  it("builds a normalized reference-only preview", () => {
    expect(buildOrderIntentPreview("buy", "aapl", "2.5", 100)).toEqual({
      side: "buy", symbol: "AAPL", quantity: 2.5, referencePrice: 100,
      referenceNotional: 250, currency: "USD", executable: false
    });
    expect(buildOrderIntentPreview("sell", "NVDA", "1", 120)).toMatchObject({
      side: "sell", symbol: "NVDA", referenceNotional: 120, executable: false
    });
  });

  it("rejects invalid symbols, quantities, prices and overflow", () => {
    expect(buildOrderIntentPreview("buy", "UNKNOWN", "1", 10)).toBeNull();
    for (const raw of ["", " ", "0", "-1", "Infinity", "NaN", "1000001"]) {
      expect(parsePreviewQuantity(raw)).toBeNull();
      expect(calculateReferenceNotional(raw, 100)).toBeNull();
      expect(buildOrderIntentPreview("buy", "AAPL", raw, 100)).toBeNull();
    }
    expect(calculateReferenceNotional("1", 0)).toBeNull();
    expect(calculateReferenceNotional("1000000", Number.MAX_VALUE)).toBeNull();
  });
});
