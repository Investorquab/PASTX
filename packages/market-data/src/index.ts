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
  private readonly quoteInflight = new Map<string, Promise<MarketQuote>>();
  private readonly candleInflight = new Map<string, Promise<MarketCandle[]>>();
  private readonly searchCache = new Map<string, { expiresAt: number; value: MarketInstrument[] }>();
  private readonly searchInflight = new Map<string, Promise<MarketInstrument[]>>();
  private readonly logoCache = new Map<string, { expiresAt: number; value: string | null }>();
  private readonly logoInflight = new Map<string, Promise<string | null>>();

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

  private async singleFlight<T>(
    flights: Map<string, Promise<T>>,
    key: string,
    load: () => Promise<T>
  ): Promise<T> {
    const existing = flights.get(key);
    if (existing) return existing;

    const pending = load();
    flights.set(key, pending);
    try {
      return await pending;
    } finally {
      if (flights.get(key) === pending) flights.delete(key);
    }
  }

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 8_000
  ) {}


  /** Search listed-equity metadata; search results do not prove an on-chain token exists. */
  async searchStocks(query: string, outputSize = 20): Promise<MarketInstrument[]> {
    const q=query.trim();
    if(q.length<2||q.length>80)throw new MarketDataError("PROVIDER_INVALID_RESPONSE","Stock search query must contain between 2 and 80 characters.",400);
    if(!Number.isInteger(outputSize)||outputSize<1||outputSize>20)throw new MarketDataError("PROVIDER_INVALID_RESPONSE","Stock search limit must be between 1 and 20.",400);
    const key=q.toUpperCase()+":"+outputSize;
    const cached=this.searchCache.get(key);
    if(cached&&cached.expiresAt>Date.now())return cached.value.map((item)=>({...item}));
    if(cached)this.searchCache.delete(key);
    return (await this.singleFlight(this.searchInflight,key,async()=>{
      const payload=asRecord(await this.request("/symbol_search",{symbol:q,outputsize:String(outputSize)}));
      if(!Array.isArray(payload?.data))throw new MarketDataError("PROVIDER_INVALID_RESPONSE","Market data provider returned an unexpected stock directory response.",502);
      const types=new Set(["common stock","american depositary receipt","depositary receipt","preferred stock"]);
      const seen=new Set<string>(),items:MarketInstrument[]=[];
      for(const raw of payload.data){
        const row=asRecord(raw);if(!row)continue;
        const symbol=typeof row.symbol==="string"?row.symbol.trim().toUpperCase():"";
        const name=typeof row.instrument_name==="string"?row.instrument_name.trim():"";
        const exchange=typeof row.exchange==="string"?row.exchange.trim():"";
        const micCode=typeof row.mic_code==="string"?row.mic_code.trim().toUpperCase():"";
        const country=typeof row.country==="string"?row.country.trim():"";
        const currency=typeof row.currency==="string"?row.currency.trim().toUpperCase():"";
        const instrumentType=typeof row.instrument_type==="string"?row.instrument_type.trim():"";
        if(!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol)||!name||!exchange||exchange.length>100||!/^[A-Z]{3}$/.test(currency)||!types.has(instrumentType.toLowerCase())||(micCode&&!/^[A-Z0-9]{4}$/.test(micCode)))continue;
        const id=symbol+":"+(micCode||exchange.toUpperCase());if(seen.has(id))continue;seen.add(id);
        items.push({symbol,name,kind:"reference",description:"Listed stock quote data from an external provider; not a Portaldot-issued equity token.",currency,providerSymbol:symbol,exchange,...(micCode?{micCode}:{}),...(country?{country}:{}),instrumentType});
        if(items.length>=outputSize)break;
      }
      this.storeCache(this.searchCache,key,items,60_000);return items;
    })).map((item)=>({...item}));
  }

  /** Return an HTTPS company-logo URL; absence is normal and callers use ticker initials. */
  async getLogo(instrument: MarketInstrument): Promise<string|null> {
    if(instrument.kind!=="reference"||!instrument.providerSymbol?.trim()||!instrument.exchange?.trim())throw new MarketDataError("PROVIDER_INVALID_RESPONSE","Company logos require a listed stock and exchange identity.",400);
    const symbol=instrument.providerSymbol.trim().toUpperCase(),key=symbol+":"+(instrument.micCode?.toUpperCase()??instrument.exchange.toUpperCase())+":"+(instrument.country??"");
    const cached=this.logoCache.get(key);if(cached&&cached.expiresAt>Date.now())return cached.value;if(cached)this.logoCache.delete(key);
    return this.singleFlight(this.logoInflight,key,async()=>{
      const payload=asRecord(await this.request("/logo",{symbol,exchange:instrument.exchange as string,...(instrument.micCode?{mic_code:instrument.micCode}:{}),...(instrument.country?{country:instrument.country}:{})}));
      const meta=asRecord(payload?.meta),returned=typeof meta?.symbol==="string"?meta.symbol.trim().toUpperCase():"";
      const responseExchange=typeof meta?.exchange==="string"?meta.exchange.trim().toUpperCase():"";
      const responseMic=typeof meta?.mic_code==="string"?meta.mic_code.trim().toUpperCase():"";
      const expectedExchange=instrument.exchange?.trim().toUpperCase()??"",expectedMic=instrument.micCode?.trim().toUpperCase()??"";
      const venueMatches=expectedMic&&responseMic?expectedMic===responseMic:responseExchange?expectedExchange.replace(/[^A-Z0-9]/g,"")===responseExchange.replace(/[^A-Z0-9]/g,""):true;
      if(returned!==symbol||!venueMatches)throw new MarketDataError("PROVIDER_INVALID_RESPONSE","Market data provider returned a logo for a different listing.",502);
      const raw=typeof payload?.url==="string"?payload.url.trim():"";let logo:string|null=null;
      if(raw){try{const url=new URL(raw);if(url.protocol!=="https:"||url.username||url.password||!url.hostname||raw.length>2048)throw new Error("unsafe");logo=url.toString();}catch{throw new MarketDataError("PROVIDER_INVALID_RESPONSE","Market data provider returned an unsafe logo URL.",502);}}
      this.storeCache(this.logoCache,key,logo,86_400_000);return logo;
    });
  }

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
    if (instrument.kind !== "reference" || !instrument.providerSymbol?.trim()) {
      throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "External market data is restricted to explicitly mapped reference instruments.", 400);
    }
    const cacheKey=instrument.symbol+":"+instrument.providerSymbol.trim().toUpperCase()+":"+instrument.currency+":"+(instrument.micCode?.toUpperCase()??instrument.exchange?.toUpperCase()??"");
    const cached = this.quoteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value };
    if (cached) this.quoteCache.delete(cacheKey);

    return { ...(await this.singleFlight(this.quoteInflight, cacheKey, async () => {
      const payload=asRecord(await this.request("/quote",{symbol:instrument.providerSymbol??instrument.symbol,...(instrument.exchange?{exchange:instrument.exchange}:{}),...(instrument.micCode?{mic_code:instrument.micCode}:{}),...(instrument.country?{country:instrument.country}:{})}));
      if (!payload) throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned an unexpected quote.", 502);

      const responseSymbol = typeof payload.symbol === "string" ? payload.symbol.trim().toUpperCase() : "";
      const expectedSymbol = (instrument.providerSymbol ?? instrument.symbol).trim().toUpperCase();
      const price = parseFiniteNumber(payload.close);
      const change = parseFiniteNumber(payload.change);
      const changePercent = parseFiniteNumber(payload.percent_change);
      const currency = typeof payload.currency === "string" ? payload.currency.toUpperCase() : "";
      const responseExchange=typeof payload.exchange==="string"?payload.exchange.trim().toUpperCase():"";
      const responseMic=typeof payload.mic_code==="string"?payload.mic_code.trim().toUpperCase():"";
      const expectedExchange=instrument.exchange?.trim().toUpperCase()??"",expectedMic=instrument.micCode?.trim().toUpperCase()??"";
      const venueMatches=expectedMic&&responseMic?expectedMic===responseMic:expectedExchange?Boolean(responseExchange)&&expectedExchange.replace(/[^A-Z0-9]/g,"")===responseExchange.replace(/[^A-Z0-9]/g,""):true;
      const rawTimestamp = payload.timestamp;
      let timestamp: string | null = null;
      if (typeof rawTimestamp === "number" || (typeof rawTimestamp === "string" && /^\d+$/.test(rawTimestamp))) {
        const parsedTimestamp = new Date(Number(rawTimestamp) * 1000);
        if (Number.isFinite(parsedTimestamp.getTime())) timestamp = parsedTimestamp.toISOString();
      } else if (typeof payload.datetime === "string" && Number.isFinite(Date.parse(payload.datetime))) {
        timestamp = new Date(payload.datetime).toISOString();
      }

      if(responseSymbol!==expectedSymbol||!venueMatches||price===null||price<=0||change===null||changePercent===null||!timestamp||currency!==instrument.currency||!/^[A-Z]{3}$/.test(currency)){
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
      return quote;
    })) };
  }

  async getCandles(instrument: MarketInstrument, interval: CandleInterval, outputSize: number): Promise<MarketCandle[]> {
    if (instrument.kind !== "reference" || !instrument.providerSymbol?.trim()) {
      throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "External market data is restricted to explicitly mapped reference instruments.", 400);
    }
    const cacheKey=instrument.symbol+":"+instrument.providerSymbol.trim().toUpperCase()+":"+instrument.currency+":"+(instrument.micCode?.toUpperCase()??instrument.exchange?.toUpperCase()??"")+":"+interval+":"+outputSize;
    const cached = this.candleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value.map((candle) => ({ ...candle }));
    if (cached) this.candleCache.delete(cacheKey);

    return (await this.singleFlight(this.candleInflight, cacheKey, async () => {
      const payload = asRecord(await this.request("/time_series", {
        symbol: instrument.providerSymbol ?? instrument.symbol,
        interval,
        outputsize: String(outputSize),
        order: "ASC",
        timezone: "UTC",
        ...(instrument.exchange?{exchange:instrument.exchange}:{}),
        ...(instrument.micCode?{mic_code:instrument.micCode}:{}),
        ...(instrument.country?{country:instrument.country}:{})
      }));
      const meta = asRecord(payload?.meta);
      const responseSymbol = typeof meta?.symbol === "string" ? meta.symbol.trim().toUpperCase() : "";
      const responseInterval = typeof meta?.interval === "string" ? meta.interval.trim() : "";
      const responseCurrency=typeof meta?.currency==="string"?meta.currency.trim().toUpperCase():"";
      const responseExchange=typeof meta?.exchange==="string"?meta.exchange.trim().toUpperCase():"",responseMic=typeof meta?.mic_code==="string"?meta.mic_code.trim().toUpperCase():"";
      const expectedExchange=instrument.exchange?.trim().toUpperCase()??"",expectedMic=instrument.micCode?.trim().toUpperCase()??"";
      const venueMatches=expectedMic&&responseMic?expectedMic===responseMic:expectedExchange?Boolean(responseExchange)&&expectedExchange.replace(/[^A-Z0-9]/g,"")===responseExchange.replace(/[^A-Z0-9]/g,""):true;
      const expectedSymbol = (instrument.providerSymbol ?? instrument.symbol).trim().toUpperCase();
      const values = payload?.values;
      if (
        responseSymbol !== expectedSymbol ||
        responseInterval !== interval ||
        responseCurrency !== instrument.currency ||
        !venueMatches ||
        !Array.isArray(values)
      ) {
        throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned mismatched or incomplete candle metadata.", 502);
      }

      const candles = values.map((value): MarketCandle => {
        const item = asRecord(value);
        const rawDatetime = typeof item?.datetime === "string" ? item.datetime.trim() : "";
        const datetimeWithZone = !rawDatetime
          ? ""
          : /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(rawDatetime)
            ? rawDatetime
            : /^\d{4}-\d{2}-\d{2}$/.test(rawDatetime)
              ? `${rawDatetime}T00:00:00Z`
              : `${rawDatetime.replace(" ", "T")}Z`;
        const parsedTimestamp = datetimeWithZone ? new Date(datetimeWithZone) : null;
        const timestamp = parsedTimestamp && Number.isFinite(parsedTimestamp.getTime())
          ? parsedTimestamp.toISOString()
          : null;
        const open = parseFiniteNumber(item?.open);
        const high = parseFiniteNumber(item?.high);
        const low = parseFiniteNumber(item?.low);
        const close = parseFiniteNumber(item?.close);
        const volume = parseFiniteNumber(item?.volume);
        if (!timestamp || open === null || high === null || low === null || close === null || open <= 0 || high <= 0 || low <= 0 || close <= 0 || high < Math.max(open, close, low) || low > Math.min(open, close, high) || (item?.volume !== undefined && item.volume !== null && (volume === null || volume < 0))) {
          throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned a malformed candle.", 502);
        }
        return { timestamp, open, high, low, close, volume };
      });
      this.storeCache(this.candleCache, cacheKey, candles, 60_000);
      return candles;
    })).map((candle) => ({ ...candle }));
  }
}
