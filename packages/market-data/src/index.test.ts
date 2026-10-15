import { describe, expect, it, vi } from "vitest";
import { MARKET_INSTRUMENTS } from "@pastx/shared";
import { MarketDataError, TwelveDataAdapter } from "./index";

const instrument = MARKET_INSTRUMENTS[0];

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  })) as unknown as typeof fetch;
}

describe("TwelveDataAdapter", () => {
  it("does not make requests without a server-side API key", async () => {
    const fetcher = vi.fn();
    const adapter = new TwelveDataAdapter(undefined, fetcher as unknown as typeof fetch);
    await expect(adapter.getQuote(instrument)).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("normalizes quote fields and marks delay status as unknown", async () => {
    const adapter = new TwelveDataAdapter("test-key", fakeFetch({
      symbol: "AAPL", close: "247.96", change: "3.04", percent_change: "1.24",
      currency: "USD", timestamp: 1792033200
    }));
    const quote = await adapter.getQuote(instrument);
    expect(quote).toMatchObject({ symbol: "AAPL", price: 247.96, change: 3.04, changePercent: 1.24, currency: "USD", source: "twelve_data", delayed: null });
    expect(Number.isFinite(Date.parse(quote.observedAt))).toBe(true);
  });

  it("caches successful quotes briefly and refreshes after expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T03:00:00.000Z"));
    try {
      const fetcher = fakeFetch({
        symbol: "AAPL", close: "247.96", change: "3.04", percent_change: "1.24",
        currency: "USD", timestamp: 1792033200
      });
      const adapter = new TwelveDataAdapter("test-key", fetcher);
      await adapter.getQuote(instrument);
      await adapter.getQuote(instrument);
      expect(fetcher).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(15_001);
      await adapter.getQuote(instrument);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps rate limiting to a stable error without exposing provider details", async () => {
    const adapter = new TwelveDataAdapter("test-key", fakeFetch({ status: "error", code: 429, message: "private provider text" }, 429));
    await expect(adapter.getQuote(instrument)).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMIT", statusCode: 429 });
  });

  it("rejects malformed quote payloads and out-of-range timestamps", async () => {
    const malformedPrice = new TwelveDataAdapter("test-key", fakeFetch({ symbol: "AAPL", close: "not-a-price" }));
    await expect(malformedPrice.getQuote(instrument)).rejects.toBeInstanceOf(MarketDataError);

    const malformedTimestamp = new TwelveDataAdapter("test-key", fakeFetch({
      symbol: "AAPL", close: "247.96", change: "3.04", percent_change: "1.24",
      currency: "USD", timestamp: 999999999999999999
    }));
    await expect(malformedTimestamp.getQuote(instrument)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("normalizes candle data and rejects invalid OHLC relationships", async () => {
    const adapter = new TwelveDataAdapter("test-key", fakeFetch({ values: [
      { datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }
    ] }));
    await expect(adapter.getCandles(instrument, "1min", 1)).resolves.toMatchObject([
      { open: 10, high: 12, low: 9, close: 11, volume: 50 }
    ]);

    const malformed = new TwelveDataAdapter("test-key", fakeFetch({ values: [
      { datetime: "2026-10-15 10:00:00", open: "10", high: "9", low: "8", close: "11" }
    ] }));
    await expect(malformed.getCandles(instrument, "1min", 1)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });
});
