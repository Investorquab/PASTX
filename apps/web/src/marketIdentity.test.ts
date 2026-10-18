import { describe, expect, it } from "vitest";
import { findMarketByIdentity, marketIdentityKey } from "./marketIdentity";

const listings = [
  { symbol: "ABC", name: "ABC Inc.", exchange: "NASDAQ", micCode: "XNAS" },
  { symbol: "ABC", name: "ABC Inc.", exchange: "New York Stock Exchange", micCode: "XNYS" },
  { symbol: "XYZ", name: "XYZ Corp.", exchange: "NASDAQ", micCode: "XNAS" },
  { symbol: "ABC", name: "ABC US", exchange: "Regional Exchange", country: "United States", currency: "USD" },
  { symbol: "ABC", name: "ABC CA", exchange: "Regional Exchange", country: "Canada", currency: "CAD" }
];

describe("market listing identity", () => {
  it("creates distinct stable keys for the same ticker on different venues", () => {
    expect(marketIdentityKey(listings[0])).not.toBe(marketIdentityKey(listings[1]));
    expect(marketIdentityKey(listings[0])).toBe("ABC::XNAS::::");
    expect(marketIdentityKey(listings[3])).not.toBe(marketIdentityKey(listings[4]));
  });

  it("resolves a selected listing by MIC instead of ticker or display exchange alone", () => {
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "New York Stock Exchange", micCode: "XNYS" })).toBe(listings[1]);
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "NASDAQ", micCode: "XNAS" })).toBe(listings[0]);
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "NASDAQ", micCode: "XNYS" })).toBeUndefined();
  });

  it("resolves country-distinct listings when MIC identity is unavailable", () => {
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "Regional Exchange", country: "Canada", currency: "CAD" })).toBe(listings[4]);
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "Regional Exchange", country: "United States", currency: "USD" })).toBe(listings[3]);
  });

  it("does not guess between country-distinct listings when country and currency are omitted", () => {
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "Regional Exchange" })).toBeUndefined();
  });

  it("does not silently substitute a different listing when the requested MIC is absent", () => {
    expect(findMarketByIdentity(listings, { symbol: "ABC", exchange: "NASDAQ", micCode: "XLON" })).toBeUndefined();
  });
});
