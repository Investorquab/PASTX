import { describe, expect, it, vi } from "vitest";
import { ApiClientError, getApiCapabilities, getApiHealth, getChainStatus, getMarketCatalogue, getMarketCandles, getMarketLogoUrl, getMarketQuote, getMarketSearch } from "./api";

describe("getChainStatus", () => {
  it("returns the read-only status object", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      item: {
        configured: true, reachable: true, networkMatches: true,
        expectedChainId: 420420777, chainId: 420420777, blockNumber: "12345", status: "verified", verificationScope: "chain_id_and_latest_block_read"
      }
    }), { status: 200 }));
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).resolves.toMatchObject({
      status: "verified", chainId: 420420777, networkMatches: true, verificationScope: "chain_id_and_latest_block_read"
    });
  });

  it("reports API transport failures safely", async () => {
    await expect(getChainStatus(async () => { throw new Error("private detail"); })).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API is unavailable."
    });
  });

  it("rejects malformed API payloads", async () => {
    const fetcher = async () => new Response(JSON.stringify({ item: { status: "unknown", verificationScope: "chain_id_and_latest_block_read" } }), { status: 200 });
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);
  });

  it("accepts an explicitly configured positive chain ID from the API", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      item: {
        configured: true, reachable: true, networkMatches: true,
        expectedChainId: 1, chainId: 1, blockNumber: "1", status: "verified", verificationScope: "chain_id_and_latest_block_read"
      }
    }), { status: 200 });
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).resolves.toMatchObject({
      expectedChainId: 1, chainId: 1, blockNumber: "1", status: "verified", networkMatches: true
    });
  });

  it("rejects internally inconsistent chain identity states", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      item: {
        configured: true, reachable: true, networkMatches: true,
        expectedChainId: 5042, chainId: 1, blockNumber: "1", status: "verified", verificationScope: "chain_id_and_latest_block_read"
      }
    }), { status: 200 });
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API returned an inconsistent chain status."
    });
  });

  it("maps non-2xx responses to safe client errors", async () => {
    const fetcher = async () => new Response("private upstream details", { status: 503 });
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("getApiCapabilities", () => {
  const validCapabilities = {
    service: "pastx-api",
    capabilities: {
      referenceCatalogue: { implemented: true, enabled: true },
      marketQuotes: { implemented: true, enabled: false },
      marketCandles: { implemented: true, enabled: false },
      chainIdentityProbe: { implemented: true, enabled: true, verificationScope: "chain_id_and_latest_block_read" },
      walletConnection: { implemented: false, enabled: false },
      onchainBalances: { implemented: false, enabled: false },
      orderPreview: { implemented: true, enabled: true, execution: false },
      orderSubmission: { implemented: false, enabled: false },
      transactionHistory: { implemented: false, enabled: false },
      atomicSettlement: { implemented: false, enabled: false }
    },
    safety: {
      tradingEnabled: false,
      externalStockQuotesAreReferenceData: true,
      marketDataDisplayRequiresProviderPermission: true
    }
  };

  it("accepts the API capability contract and respects disabled data features", async () => {
    const fetcher = async () => new Response(JSON.stringify(validCapabilities), { status: 200 });
    await expect(getApiCapabilities(fetcher as unknown as typeof fetch)).resolves.toMatchObject({
      capabilities: { marketQuotes: { enabled: false }, marketCandles: { enabled: false }, orderSubmission: { enabled: false } },
      safety: { tradingEnabled: false }
    });
  });

  it("fails closed when the capability contract is malformed or enables trading", async () => {
    const malformed = { ...validCapabilities, safety: { ...validCapabilities.safety, tradingEnabled: true } };
    const fetcher = async () => new Response(JSON.stringify(malformed), { status: 200 });
    await expect(getApiCapabilities(fetcher as unknown as typeof fetch)).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API returned invalid capabilities."
    });
  });

  it("fails closed on an unavailable capability endpoint", async () => {
    const fetcher = async () => new Response("unavailable", { status: 503 });
    await expect(getApiCapabilities(fetcher as unknown as typeof fetch)).rejects.toMatchObject({
      name: "ApiClientError", statusCode: 503
    });
  });
});

describe("getMarketCatalogue", () => {
  const validCatalogue = {
    count: 2,
    classification: "reference catalogue; not proof of tokenized equity or executable market",
    items: [
      { symbol: "AAPL", name: "Apple Inc.", kind: "reference", description: "External stock-price reference only.", currency: "USD", providerSymbol: "AAPL" },
      { symbol: "NVDA", name: "NVIDIA Corporation", kind: "reference", description: "External stock-price reference only.", currency: "USD", providerSymbol: "NVDA" }
    ]
  };

  it("returns validated catalogue entries from the API", async () => {
    const fetcher = async () => new Response(JSON.stringify(validCatalogue), { status: 200 });
    await expect(getMarketCatalogue(fetcher as unknown as typeof fetch)).resolves.toMatchObject([
      { symbol: "AAPL", name: "Apple Inc.", kind: "reference", currency: "USD" },
      { symbol: "NVDA", name: "NVIDIA Corporation", kind: "reference", currency: "USD" }
    ]);
  });

  it("rejects duplicate symbols and inconsistent counts", async () => {
    const duplicate = { ...validCatalogue, items: [validCatalogue.items[0], validCatalogue.items[0]] };
    const duplicateFetcher = async () => new Response(JSON.stringify(duplicate), { status: 200 });
    await expect(getMarketCatalogue(duplicateFetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);

    const wrongCount = { ...validCatalogue, count: 99 };
    const countFetcher = async () => new Response(JSON.stringify(wrongCount), { status: 200 });
    await expect(getMarketCatalogue(countFetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);
  });

  it("fails closed for malformed entries or an unavailable API", async () => {
    const malformed = { ...validCatalogue, items: [{ ...validCatalogue.items[0], currency: "usd" }] , count: 1 };
    const malformedFetcher = async () => new Response(JSON.stringify(malformed), { status: 200 });
    await expect(getMarketCatalogue(malformedFetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);

    const unavailable = async () => new Response("unavailable", { status: 503 });
    await expect(getMarketCatalogue(unavailable as unknown as typeof fetch)).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("market data API client", () => {
  it("validates health before allowing live data requests", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      status: "ok", service: "pastx-api", marketDataConfigured: true,
      marketDataDisplayEnabled: true, tradingEnabled: false
    }), { status: 200 });
    await expect(getApiHealth(fetcher as unknown as typeof fetch)).resolves.toMatchObject({
      marketDataConfigured: true, marketDataDisplayEnabled: true, tradingEnabled: false
    });
  });

  it("accepts a normalized provider quote only", async () => {
    const fetcher = async () => new Response(JSON.stringify({ item: {
      symbol: "AAPL", price: 250, change: 2, changePercent: 0.8,
      currency: "USD", observedAt: "2026-10-15T03:00:00.000Z",
      source: "twelve_data", delayed: null
    } }), { status: 200 });
    await expect(getMarketQuote("AAPL", fetcher as unknown as typeof fetch)).resolves.toMatchObject({
      symbol: "AAPL", price: 250, source: "twelve_data"
    });
  });

  it("rejects a valid quote for a different requested symbol", async () => {
    const fetcher = async () => new Response(JSON.stringify({ item: {
      symbol: "NVDA", price: 250, change: 2, changePercent: 0.8,
      currency: "USD", observedAt: "2026-10-15T03:00:00.000Z",
      source: "twelve_data", delayed: null
    } }), { status: 200 });
    await expect(getMarketQuote("AAPL", fetcher as unknown as typeof fetch)).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API returned an invalid market quote."
    });
  });

  it("rejects a provider quote with the wrong catalogue currency", async () => {
    const fetcher = async () => new Response(JSON.stringify({ item: {
      symbol: "AAPL", price: 250, change: 2, changePercent: 0.8,
      currency: "EUR", observedAt: "2026-10-15T03:00:00.000Z",
      source: "twelve_data", delayed: null
    } }), { status: 200 });
    await expect(getMarketQuote("AAPL", fetcher as unknown as typeof fetch)).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API returned an invalid market quote."
    });
  });

  it("rejects fixture quotes from the live-data API method", async () => {
    const fetcher = async () => new Response(JSON.stringify({ item: {
      symbol: "AAPL", price: 250, change: 2, changePercent: 0.8,
      currency: "USD", observedAt: "2026-10-15T03:00:00.000Z",
      source: "fixture", delayed: null
    } }), { status: 200 });
    await expect(getMarketQuote("AAPL", fetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);
  });

  it("rejects invalid candle limits before issuing a request", async () => {
    const fetcher = vi.fn();
    await expect(getMarketCandles("AAPL", "1day", 501, fetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects unsupported candle intervals before issuing a request", async () => {
    const fetcher = vi.fn();
    await expect(getMarketCandles("AAPL", "2min" as never, 30, fetcher as unknown as typeof fetch)).rejects.toMatchObject({
      name: "ApiClientError", message: "Unsupported candle interval."
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects candle payloads for a different symbol or interval", async () => {
    const wrongSymbol = async () => new Response(JSON.stringify({
      symbol: "NVDA", interval: "1day", items: []
    }), { status: 200 });
    await expect(getMarketCandles("AAPL", "1day", 30, wrongSymbol as unknown as typeof fetch)).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API returned invalid candle data."
    });

    const wrongInterval = async () => new Response(JSON.stringify({
      symbol: "AAPL", interval: "5min", items: []
    }), { status: 200 });
    await expect(getMarketCandles("AAPL", "1day", 30, wrongInterval as unknown as typeof fetch)).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API returned invalid candle data."
    });
  });

  it("validates OHLC candle relationships", async () => {
    const fetcher = async () => new Response(JSON.stringify({ symbol: "AAPL", interval: "1day", items: [{
      timestamp: "2026-10-15T03:00:00.000Z", open: 10, high: 12, low: 9, close: 11, volume: 50
    }] }), { status: 200 });
    await expect(getMarketCandles("AAPL", "1day", 1, fetcher as unknown as typeof fetch)).resolves.toMatchObject([
      { open: 10, high: 12, low: 9, close: 11, volume: 50 }
    ]);

    const malformed = async () => new Response(JSON.stringify({ symbol: "AAPL", interval: "1day", items: [{
      timestamp: "2026-10-15T03:00:00.000Z", open: 10, high: 9, low: 8, close: 11, volume: 50
    }] }), { status: 200 });
    await expect(getMarketCandles("AAPL", "1day", 1, malformed as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);
  });
});


describe("provider stock directory client",()=>{
 const stock={symbol:"AMD",name:"Advanced Micro Devices",kind:"reference",description:"Listed stock",currency:"USD",providerSymbol:"AMD",exchange:"NASDAQ",micCode:"XNAS",country:"United States",instrumentType:"Common Stock"};
 it("parses search results with an exchange identity",async()=>{const fetcher=async()=>new Response(JSON.stringify({query:"AMD",count:1,items:[stock],classification:"external listed-stock directory; not proof of a Portaldot-issued equity token"}),{status:200});await expect(getMarketSearch("AMD",15,fetcher as unknown as typeof fetch)).resolves.toMatchObject([{symbol:"AMD",exchange:"NASDAQ",micCode:"XNAS"}]);});
 it("rejects unsafe logo URLs and supports no-logo fallback",async()=>{const bad=async()=>new Response(JSON.stringify({url:"javascript:alert(1)"}),{status:200});await expect(getMarketLogoUrl(stock,bad as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);const none=async()=>new Response(JSON.stringify({url:null}),{status:200});await expect(getMarketLogoUrl(stock,none as unknown as typeof fetch)).resolves.toBeNull();});
});
