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
  it("refuses to fetch quotes or candles for non-reference instruments", async () => {
    const fetcher = vi.fn();
    const adapter = new TwelveDataAdapter("test-key", fetcher as unknown as typeof fetch);
    const simulated = { ...instrument, kind: "simulated" as const };
    const onchain = { ...instrument, kind: "onchain" as const };
    const missingMapping = { ...instrument, providerSymbol: undefined };

    await expect(adapter.getQuote(simulated)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE", statusCode: 400 });
    await expect(adapter.getCandles(simulated, "1day", 30)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE", statusCode: 400 });
    await expect(adapter.getQuote(onchain)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE", statusCode: 400 });
    await expect(adapter.getCandles(onchain, "1day", 30)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE", statusCode: 400 });
    await expect(adapter.getQuote(missingMapping)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE", statusCode: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });

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

  it("rejects provider quotes for a different symbol or currency", async () => {
    const wrongSymbol = new TwelveDataAdapter("test-key", fakeFetch({
      symbol: "NVDA", close: "247.96", change: "3.04", percent_change: "1.24",
      currency: "USD", timestamp: 1792033200
    }));
    await expect(wrongSymbol.getQuote(instrument)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });

    const wrongCurrency = new TwelveDataAdapter("test-key", fakeFetch({
      symbol: "AAPL", close: "247.96", change: "3.04", percent_change: "1.24",
      currency: "EUR", timestamp: 1792033200
    }));
    await expect(wrongCurrency.getQuote(instrument)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
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

  it("coalesces concurrent quote requests for the same mapped instrument", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;
    const adapter = new TwelveDataAdapter("test-key", fetcher);

    const firstRequest = adapter.getQuote(instrument);
    const secondRequest = adapter.getQuote(instrument);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch(new Response(JSON.stringify({
      symbol: "AAPL", close: "247.96", change: "3.04", percent_change: "1.24",
      currency: "USD", timestamp: 1792033200
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    first.price = -999;
    expect(second.price).toBe(247.96);
  });

  it("coalesces concurrent candle requests and returns independent arrays", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;
    const adapter = new TwelveDataAdapter("test-key", fetcher);

    const firstRequest = adapter.getCandles(instrument, "1min", 1);
    const secondRequest = adapter.getCandles(instrument, "1min", 1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch(new Response(JSON.stringify({
      meta: { symbol: "AAPL", interval: "1min", currency: "USD" },
      values: [{ datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    first[0].close = -999;
    first.push({ timestamp: "invalid", open: 1, high: 1, low: 1, close: 1, volume: null });
    expect(second).toHaveLength(1);
    expect(second[0].close).toBe(11);
  });

  it("coalesces concurrent quote requests for the same mapped instrument", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;
    const adapter = new TwelveDataAdapter("test-key", fetcher);

    const firstRequest = adapter.getQuote(instrument);
    const secondRequest = adapter.getQuote(instrument);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch(new Response(JSON.stringify({
      symbol: "AAPL", close: "247.96", change: "3.04", percent_change: "1.24",
      currency: "USD", timestamp: 1792033200
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    first.price = -999;
    expect(second.price).toBe(247.96);
  });

  it("coalesces concurrent candle requests and returns independent arrays", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;
    const adapter = new TwelveDataAdapter("test-key", fetcher);

    const firstRequest = adapter.getCandles(instrument, "1min", 1);
    const secondRequest = adapter.getCandles(instrument, "1min", 1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch(new Response(JSON.stringify({
      meta: { symbol: "AAPL", interval: "1min", currency: "USD" },
      values: [{ datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    first[0].close = -999;
    first.push({ timestamp: "invalid", open: 1, high: 1, low: 1, close: 1, volume: null });
    expect(second).toHaveLength(1);
    expect(second[0].close).toBe(11);
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

  it("rejects candle series with mismatched or missing provider metadata", async () => {
    const wrongSymbol = new TwelveDataAdapter("test-key", fakeFetch({
      meta: { symbol: "NVDA", interval: "1min", currency: "USD" },
      values: [{ datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
    }));
    await expect(wrongSymbol.getCandles(instrument, "1min", 1)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });

    const wrongInterval = new TwelveDataAdapter("test-key", fakeFetch({
      meta: { symbol: "AAPL", interval: "5min", currency: "USD" },
      values: [{ datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
    }));
    await expect(wrongInterval.getCandles(instrument, "1min", 1)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });

    const wrongCurrency = new TwelveDataAdapter("test-key", fakeFetch({
      meta: { symbol: "AAPL", interval: "1min", currency: "EUR" },
      values: [{ datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
    }));
    await expect(wrongCurrency.getCandles(instrument, "1min", 1)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });

    const missingMetadata = new TwelveDataAdapter("test-key", fakeFetch({
      values: [{ datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
    }));
    await expect(missingMetadata.getCandles(instrument, "1min", 1)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("normalizes provider candle timestamps as UTC independent of server timezone", async () => {
    const requestedUrls: URL[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      requestedUrls.push(new URL(String(input)));
      return new Response(JSON.stringify({
        meta: { symbol: "AAPL", interval: "1min", currency: "USD" },
        values: [{ datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const adapter = new TwelveDataAdapter("test-key", fetcher);
    const candles = await adapter.getCandles(instrument, "1min", 1);
    expect(requestedUrls[0]?.searchParams.get("timezone")).toBe("UTC");
    expect(candles[0].timestamp).toBe("2026-10-15T10:00:00.000Z");
  });

  it("preserves explicit offsets and normalizes date-only candles to UTC midnight", async () => {
    const withOffset = new TwelveDataAdapter("test-key", fakeFetch({
      meta: { symbol: "AAPL", interval: "1min", currency: "USD" },
      values: [{ datetime: "2026-10-15T10:00:00-04:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
    }));
    await expect(withOffset.getCandles(instrument, "1min", 1)).resolves.toMatchObject([
      { timestamp: "2026-10-15T14:00:00.000Z" }
    ]);

    const dateOnly = new TwelveDataAdapter("test-key", fakeFetch({
      meta: { symbol: "AAPL", interval: "1day", currency: "USD" },
      values: [{ datetime: "2026-10-15", open: "10", high: "12", low: "9", close: "11", volume: "50" }]
    }));
    await expect(dateOnly.getCandles(instrument, "1day", 1)).resolves.toMatchObject([
      { timestamp: "2026-10-15T00:00:00.000Z" }
    ]);
  });

  it("normalizes candle data and rejects invalid OHLC relationships", async () => {
    const adapter = new TwelveDataAdapter("test-key", fakeFetch({ meta: { symbol: "AAPL", interval: "1min", currency: "USD" }, values: [
      { datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }
    ] }));
    await expect(adapter.getCandles(instrument, "1min", 1)).resolves.toMatchObject([
      { open: 10, high: 12, low: 9, close: 11, volume: 50 }
    ]);

    const malformed = new TwelveDataAdapter("test-key", fakeFetch({ meta: { symbol: "AAPL", interval: "1min", currency: "USD" }, values: [
      { datetime: "2026-10-15 10:00:00", open: "10", high: "9", low: "8", close: "11" }
    ] }));
    await expect(malformed.getCandles(instrument, "1min", 1)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });

    const negativeVolume = new TwelveDataAdapter("test-key", fakeFetch({ meta: { symbol: "AAPL", interval: "1min", currency: "USD" }, values: [
      { datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "-1" }
    ] }));
    await expect(negativeVolume.getCandles(instrument, "1min", 1)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });

    const malformedVolume = new TwelveDataAdapter("test-key", fakeFetch({ meta: { symbol: "AAPL", interval: "1min", currency: "USD" }, values: [
      { datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "not-a-volume" }
    ] }));
    await expect(malformedVolume.getCandles(instrument, "1min", 1)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("returns defensive copies so callers cannot mutate cached quotes", async () => {
    const adapter = new TwelveDataAdapter("test-key", fakeFetch({
      symbol: "AAPL", close: "247.96", change: "3.04", percent_change: "1.24",
      currency: "USD", timestamp: 1792033200
    }));
    const first = await adapter.getQuote(instrument);
    first.price = -999;
    expect((await adapter.getQuote(instrument)).price).toBe(247.96);
  });

  it("maps invalid JSON and upstream failures to safe normalized errors", async () => {
    const invalidJson = new TwelveDataAdapter(
      "test-key",
      vi.fn(async () => new Response("upstream stack trace", { status: 200 })) as unknown as typeof fetch
    );
    await expect(invalidJson.getQuote(instrument)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });

    const providerFailure = new TwelveDataAdapter(
      "test-key",
      fakeFetch({ status: "error", code: 500, message: "private provider text" }, 500)
    );
    await expect(providerFailure.getQuote(instrument)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });


  it("returns defensive copies of cached candle arrays and entries", async () => {
    const adapter = new TwelveDataAdapter("test-key", fakeFetch({ meta: { symbol: "AAPL", interval: "1min", currency: "USD" }, values: [
      { datetime: "2026-10-15 10:00:00", open: "10", high: "12", low: "9", close: "11", volume: "50" }
    ] }));
    const first = await adapter.getCandles(instrument, "1min", 1);
    first[0].close = -999;
    first.push({ timestamp: "invalid", open: 1, high: 1, low: 1, close: 1, volume: null });
    const second = await adapter.getCandles(instrument, "1min", 1);
    expect(second).toHaveLength(1);
    expect(second[0].close).toBe(11);
  });

  it("normalizes transport failures and aborts to safe provider errors", async () => {
    const transportFailure = new TwelveDataAdapter(
      "test-key",
      vi.fn(async () => { throw new TypeError("private transport details"); }) as unknown as typeof fetch
    );
    await expect(transportFailure.getQuote(instrument)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE", statusCode: 502, message: "Market data provider is unavailable."
    });

    const abortError = Object.assign(new Error("private abort details"), { name: "AbortError" });
    const timedOut = new TwelveDataAdapter(
      "test-key",
      vi.fn(async () => { throw abortError; }) as unknown as typeof fetch
    );
    await expect(timedOut.getQuote(instrument)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE", statusCode: 504, message: "Market data provider timed out."
    });
  });
});
