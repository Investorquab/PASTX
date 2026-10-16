import { describe, expect, it, vi } from "vitest";
import { ApiClientError, getApiHealth, getChainStatus, getMarketCandles, getMarketQuote } from "./api";

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
