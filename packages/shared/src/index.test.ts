import { describe, expect, it } from "vitest";
import { isCandleInterval, MARKET_INSTRUMENTS } from "./index";

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
