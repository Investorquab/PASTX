import { describe, expect, it, vi } from "vitest";
import { ApiClientError, getApiHealth, getChainStatus, getMarketCandles, getMarketQuote } from "./api";

describe("getChainStatus", () => {
  it("returns the read-only status object", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      item: {
        configured: true, reachable: true, networkMatches: true,
        expectedChainId: 420420777, chainId: 420420777, status: "verified", verificationScope: "chain_id_only"
      }
    }), { status: 200 }));
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).resolves.toMatchObject({
      status: "verified", chainId: 420420777, networkMatches: true, verificationScope: "chain_id_only"
    });
  });

  it("reports API transport failures safely", async () => {
    await expect(getChainStatus(async () => { throw new Error("private detail"); })).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API is unavailable."
    });
  });

  it("rejects malformed API payloads", async () => {
    const fetcher = async () => new Response(JSON.stringify({ item: { status: "unknown", verificationScope: "chain_id_only" } }), { status: 200 });
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);
  });

  it("maps non-2xx responses to safe client errors", async () => {
    const fetcher = async () => new Response("private upstream details", { status: 503 });
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).rejects.toMatchObject({ statusCode: 503 });
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

  it("validates OHLC candle relationships", async () => {
    const fetcher = async () => new Response(JSON.stringify({ items: [{
      timestamp: "2026-10-15T03:00:00.000Z", open: 10, high: 12, low: 9, close: 11, volume: 50
    }] }), { status: 200 });
    await expect(getMarketCandles("AAPL", "1day", 1, fetcher as unknown as typeof fetch)).resolves.toMatchObject([
      { open: 10, high: 12, low: 9, close: 11, volume: 50 }
    ]);

    const malformed = async () => new Response(JSON.stringify({ items: [{
      timestamp: "2026-10-15T03:00:00.000Z", open: 10, high: 9, low: 8, close: 11, volume: 50
    }] }), { status: 200 });
    await expect(getMarketCandles("AAPL", "1day", 1, malformed as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);
  });
});
