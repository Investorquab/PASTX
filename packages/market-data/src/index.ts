import {
  type CandleInterval,
  type MarketCandle,
  type MarketInstrument,
  type MarketQuote
} from "@pastx/shared";

const BASE_URL = "https://api.twelvedata.com";

export class MarketDataError extends Error {
  constructor(
    public readonly code: "PROVIDER_NOT_CONFIGURED" | "PROVIDER_RATE_LIMIT" | "PROVIDER_UNAVAILABLE" | "PROVIDER_INVALID_RESPONSE",
    message: string,
    public readonly statusCode = 503
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

type FetchLike = typeof fetch;

type ProviderErrorPayload = {
  status?: string;
  code?: number;
  message?: string;
};

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function providerError(payload: unknown): ProviderErrorPayload | null {
  const record = asRecord(payload);
  if (!record) return null;
  if (record.status !== "error" && typeof record.code !== "number") return null;
  return {
    status: typeof record.status === "string" ? record.status : undefined,
    code: typeof record.code === "number" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined
  };
}

export class TwelveDataAdapter {
  private readonly quoteCache = new Map<string, { expiresAt: number; value: MarketQuote }>();
  private readonly candleCache = new Map<string, { expiresAt: number; value: MarketCandle[] }>();

  private storeCache<T>(
    cache: Map<string, { expiresAt: number; value: T }>,
    key: string,
    value: T,
    ttlMs: number
  ): void {
    if (cache.size >= 128 && !cache.has(key)) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  }

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 8_000
  ) {}

  private async request(path: string, params: Record<string, string>): Promise<unknown> {
    if (!this.apiKey?.trim()) {
      throw new MarketDataError("PROVIDER_NOT_CONFIGURED", "Market data provider is not configured.", 503);
    }

    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("apikey", this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal, headers: { accept: "application/json" } });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned invalid JSON.", 502);
      }

      const error = providerError(payload);
      if (response.status === 429 || error?.code === 429) {
        throw new MarketDataError("PROVIDER_RATE_LIMIT", "Market data provider rate limit reached.", 429);
      }
      if (!response.ok || error) {
        throw new MarketDataError("PROVIDER_UNAVAILABLE", "Market data provider could not fulfil the request.", 502);
      }
      return payload;
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MarketDataError("PROVIDER_UNAVAILABLE", "Market data provider timed out.", 504);
      }
      throw new MarketDataError("PROVIDER_UNAVAILABLE", "Market data provider is unavailable.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getQuote(instrument: MarketInstrument): Promise<MarketQuote> {
    const cacheKey = instrument.symbol;
    const cached = this.quoteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value };
    if (cached) this.quoteCache.delete(cacheKey);

    const payload = asRecord(await this.request("/quote", { symbol: instrument.providerSymbol ?? instrument.symbol }));
    if (!payload) throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned an unexpected quote.", 502);

    const price = parseFiniteNumber(payload.close);
    const change = parseFiniteNumber(payload.change);
    const changePercent = parseFiniteNumber(payload.percent_change);
    const currency = typeof payload.currency === "string" ? payload.currency.toUpperCase() : instrument.currency;
    const rawTimestamp = payload.timestamp;
    let timestamp: string | null = null;
    if (typeof rawTimestamp === "number" || (typeof rawTimestamp === "string" && /^\d+$/.test(rawTimestamp))) {
      const parsedTimestamp = new Date(Number(rawTimestamp) * 1000);
      if (Number.isFinite(parsedTimestamp.getTime())) timestamp = parsedTimestamp.toISOString();
    } else if (typeof payload.datetime === "string" && Number.isFinite(Date.parse(payload.datetime))) {
      timestamp = new Date(payload.datetime).toISOString();
    }

    if (price === null || price <= 0 || change === null || changePercent === null || !timestamp || !/^[A-Z]{3,8}$/.test(currency)) {
      throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider quote was missing required fields.", 502);
    }

    const quote: MarketQuote = {
      symbol: instrument.symbol,
      price,
      change,
      changePercent,
      currency,
      observedAt: timestamp,
      source: "twelve_data",
      delayed: null
    };
    this.storeCache(this.quoteCache, cacheKey, quote, 15_000);
    return { ...quote };
  }

  async getCandles(instrument: MarketInstrument, interval: CandleInterval, outputSize: number): Promise<MarketCandle[]> {
    const cacheKey = `${instrument.symbol}:${interval}:${outputSize}`;
    const cached = this.candleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value.map((candle) => ({ ...candle }));
    if (cached) this.candleCache.delete(cacheKey);

    const payload = asRecord(await this.request("/time_series", {
      symbol: instrument.providerSymbol ?? instrument.symbol,
      interval,
      outputsize: String(outputSize),
      order: "ASC"
    }));
    const values = payload?.values;
    if (!Array.isArray(values)) {
      throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned an unexpected candle series.", 502);
    }

    const candles = values.map((value): MarketCandle => {
      const item = asRecord(value);
      const timestamp = typeof item?.datetime === "string" && Number.isFinite(Date.parse(item.datetime))
        ? new Date(item.datetime).toISOString()
        : null;
      const open = parseFiniteNumber(item?.open);
      const high = parseFiniteNumber(item?.high);
      const low = parseFiniteNumber(item?.low);
      const close = parseFiniteNumber(item?.close);
      const volume = parseFiniteNumber(item?.volume);
      if (!timestamp || open === null || high === null || low === null || close === null || open <= 0 || high <= 0 || low <= 0 || close <= 0 || high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
        throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned a malformed candle.", 502);
      }
      return { timestamp, open, high, low, close, volume };
    });
    this.storeCache(this.candleCache, cacheKey, candles, 60_000);
    return candles.map((candle) => ({ ...candle }));
  }
}
