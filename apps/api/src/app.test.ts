import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKET_INSTRUMENTS } from "@pastx/shared";
import { MarketDataError, TwelveDataAdapter } from "@pastx/market-data";
import { buildApp } from "./app";
import { PORTALDOT_V3_EVM_CHAIN_ID } from "@pastx/chain-adapter";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PASTX API", () => {
  it("reports health without claiming trading is enabled", async () => {
    const app = await buildApp({ logger: false, marketDataApiKey: undefined });
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", tradingEnabled: false, marketDataConfigured: false, marketDataDisplayEnabled: false });
    await app.close();
  });

  it("publishes a capability contract that distinguishes implementation from enablement", async () => {
    const app = await buildApp({ logger: false, marketDataApiKey: "configured-key", marketDataDisplayEnabled: false });
    const response = await app.inject({ method: "GET", url: "/api/capabilities" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      capabilities: {
        referenceCatalogue: { implemented: true, enabled: true },
        marketQuotes: { implemented: true, enabled: false },
        marketCandles: { implemented: true, enabled: false },
        chainIdentityProbe: { implemented: true, enabled: true, verificationScope: "chain_id_only" },
        walletConnection: { implemented: false, enabled: false },
        orderPreview: { implemented: true, enabled: true, execution: false },
        orderSubmission: { implemented: false, enabled: false },
        atomicSettlement: { implemented: false, enabled: false }
      },
      safety: { tradingEnabled: false, externalStockQuotesAreReferenceData: true }
    });
    await app.close();
  });

  it("does not treat whitespace-only provider keys as configured", async () => {
    const app = await buildApp({ logger: false, marketDataApiKey: "   " });
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.json().marketDataConfigured).toBe(false);
    await app.close();
  });

  it("applies security headers to API responses", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBeTruthy();
    await app.close();
  });

  it("reports chain status without exposing RPC URL or enabling writes", async () => {
    const app = await buildApp({
      logger: false,
      chainProbe: async () => ({
        configured: true, reachable: true, networkMatches: true,
        expectedChainId: PORTALDOT_V3_EVM_CHAIN_ID, chainId: PORTALDOT_V3_EVM_CHAIN_ID, status: "verified", verificationScope: "chain_id_only"
      })
    });
    const response = await app.inject({ method: "GET", url: "/api/chain/status" });
    expect(response.statusCode).toBe(200);
    expect(response.json().item).toMatchObject({ status: "verified", chainId: 420420777, verificationScope: "chain_id_only" });
    expect(response.body).not.toContain("rpc.example");
    await app.close();
  });

  it("returns only explicitly classified reference catalogue entries", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/api/markets" });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual(MARKET_INSTRUMENTS);
    await app.close();
  });

  it("rejects unknown symbols", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/api/markets/NOPE/quote" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });

  it("blocks live quote display by default until licensing is confirmed", async () => {
    const getQuote = vi.fn();
    const fakeAdapter = { getQuote, getCandles: vi.fn() } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketData: fakeAdapter });
    const response = await app.inject({ method: "GET", url: "/api/markets/AAPL/quote" });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("MARKET_DATA_DISPLAY_DISABLED");
    expect(getQuote).not.toHaveBeenCalled();
    await app.close();
  });

  it("bounds candle query parameters before contacting the provider", async () => {
    const getCandles = vi.fn();
    const fakeAdapter = { getQuote: vi.fn(), getCandles } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketData: fakeAdapter, marketDataDisplayEnabled: true });
    const invalidInterval = await app.inject({ method: "GET", url: "/api/markets/AAPL/candles?interval=2min" });
    const invalidSize = await app.inject({ method: "GET", url: "/api/markets/AAPL/candles?outputsize=501" });
    expect(invalidInterval.statusCode).toBe(400);
    expect(invalidSize.statusCode).toBe(400);
    expect(getCandles).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns a normalized error when the API rate limit is exceeded", async () => {
    const app = await buildApp({ logger: false });
    let response;
    for (let index = 0; index < 61; index += 1) {
      response = await app.inject({ method: "GET", url: "/api/health" });
    }
    expect(response?.statusCode).toBe(429);
    expect(response?.json().error).toMatchObject({ code: "RATE_LIMITED", message: "Too many requests. Please retry later." });
    expect(response?.json().error.requestId).toBeTruthy();
    await app.close();
  });

  it("does not leak provider details on errors", async () => {
    const fakeAdapter = {
      getQuote: vi.fn().mockRejectedValue(new MarketDataError("PROVIDER_RATE_LIMIT", "Market data provider rate limit reached.", 429)),
      getCandles: vi.fn()
    } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketData: fakeAdapter, marketDataDisplayEnabled: true });
    const response = await app.inject({ method: "GET", url: "/api/markets/AAPL/quote" });
    expect(response.statusCode).toBe(429);
    expect(response.json().error).toMatchObject({ code: "PROVIDER_RATE_LIMIT" });
    expect(response.body).not.toContain("apikey");
    await app.close();
  });
});
