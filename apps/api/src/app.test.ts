import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKET_INSTRUMENTS } from "@pastx/shared";
import { MarketDataError, TwelveDataAdapter } from "@pastx/market-data";
import { buildApp } from "./app";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PASTX API", () => {
  it("reports health without claiming trading is enabled", async () => {
    const app = await buildApp({ logger: false, marketDataApiKey: undefined });
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", tradingEnabled: false, marketDataConfigured: false });
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

  it("bounds candle query parameters before contacting the provider", async () => {
    const getCandles = vi.fn();
    const fakeAdapter = { getQuote: vi.fn(), getCandles } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketData: fakeAdapter });
    const invalidInterval = await app.inject({ method: "GET", url: "/api/markets/AAPL/candles?interval=2min" });
    const invalidSize = await app.inject({ method: "GET", url: "/api/markets/AAPL/candles?outputsize=501" });
    expect(invalidInterval.statusCode).toBe(400);
    expect(invalidSize.statusCode).toBe(400);
    expect(getCandles).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not leak provider details on errors", async () => {
    const fakeAdapter = {
      getQuote: vi.fn().mockRejectedValue(new MarketDataError("PROVIDER_RATE_LIMIT", "Market data provider rate limit reached.", 429)),
      getCandles: vi.fn()
    } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketData: fakeAdapter });
    const response = await app.inject({ method: "GET", url: "/api/markets/AAPL/quote" });
    expect(response.statusCode).toBe(429);
    expect(response.json().error).toMatchObject({ code: "PROVIDER_RATE_LIMIT" });
    expect(response.body).not.toContain("apikey");
    await app.close();
  });
});
