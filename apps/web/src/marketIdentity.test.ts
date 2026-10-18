import { describe, expect, it } from "vitest";
import { findMarketByIdentity, marketIdentityKey } from "./marketIdentity";

const listings = [
  { symbol: "ABC", name: "ABC Inc.", exchange: "NASDAQ", micCode: "XNAS" },
  { symbol: "ABC", name: "ABC Inc.", exchange: "New York Stock Exchange", micCode: "XNYS" },
  { symbol: "XYZ", name: "XYZ Corp.", exchange: "NASDAQ", micCode: "XNAS" }
];

describe("market listing identity", () => {
  it("creates distinct stable keys for the same ticker on different venues", () => {
    expect(marketIdentityKey(listings[0])).not.toBe(marketIdentityKey(listings[1]));
    expect(marketIdentityKey(listings[0])).toBe("ABC::XNAS");
  });

  it("resolves a selected listing by MIC instead of ticker or display exchange alone", () => {
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "New York Stock Exchange", micCode: "XNYS" })).toBe(listings[1]);
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "NASDAQ", micCode: "XNAS" })).toBe(listings[0]);
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "NASDAQ", micCode: "XNYS" })).toBeUndefined();
  });

  it("does not silently substitute a different listing when the requested MIC is absent", () => {
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "NASDAQ", micCode: "XLON" })).toBeUndefined();
  });
});
