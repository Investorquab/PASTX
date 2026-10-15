import { describe, expect, it } from "vitest";
import { isMarketQuote, type MarketQuote } from "./marketQuote";

const validQuote: MarketQuote = {
  symbol: "AAPL",
  price: 247.96,
  change: 3.04,
  changePercent: 1.24,
  currency: "USD",
  observedAt: "2026-10-15T03:00:00.000Z",
  source: "twelve_data",
};

describe("isMarketQuote", () => {
  it("accepts a normalized provider quote", () => {
    expect(isMarketQuote(validQuote)).toBe(true);
  });

  it("accepts a fixture quote while preserving its explicit source", () => {
    expect(isMarketQuote({ ...validQuote, source: "fixture" })).toBe(true);
  });

  it("rejects non-object payloads", () => {
    expect(isMarketQuote(null)).toBe(false);
    expect(isMarketQuote([])).toBe(false);
    expect(isMarketQuote("AAPL")).toBe(false);
  });

  it("rejects zero, negative, infinite, and NaN prices", () => {
    for (const price of [0, -1, Infinity, NaN]) {
      expect(isMarketQuote({ ...validQuote, price })).toBe(false);
    }
  });

  it("rejects invalid symbols and currencies", () => {
    expect(isMarketQuote({ ...validQuote, symbol: "aapl" })).toBe(false);
    expect(isMarketQuote({ ...validQuote, symbol: "AAPL<script>" })).toBe(false);
    expect(isMarketQuote({ ...validQuote, currency: "US$" })).toBe(false);
  });

  it("rejects non-finite change and invalid timestamps", () => {
    expect(isMarketQuote({ ...validQuote, changePercent: Infinity })).toBe(false);
    expect(isMarketQuote({ ...validQuote, observedAt: "not-a-date" })).toBe(false);
  });

  it("rejects unrecognized source labels", () => {
    expect(isMarketQuote({ ...validQuote, source: "guessed" })).toBe(false);
  });
});
