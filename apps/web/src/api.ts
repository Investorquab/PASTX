import type { MarketCandle, MarketQuote, CandleInterval } from "@pastx/shared";
import { isMarketQuote } from "./marketQuote";

export type ApiHealth = {
  status: "ok";
  service: string;
  marketDataConfigured: boolean;
  marketDataDisplayEnabled: boolean;
  tradingEnabled: false;
};

export type ChainStatus = {
  configured: boolean;
  reachable: boolean;
  networkMatches: boolean;
  expectedChainId: number;
  chainId: number | null;
  status: "not_configured" | "unreachable" | "verified" | "wrong_network";
  verificationScope: "chain_id_only";
};

export class ApiClientError extends Error {
  constructor(message: string, public readonly statusCode: number | null = null) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function getChainStatus(fetchImpl: typeof fetch = fetch): Promise<ChainStatus> {
  let response: Response;
  try {
    response = await fetchImpl("/api/chain/status", { headers: { accept: "application/json" } });
  } catch {
    throw new ApiClientError("PASTX API is unavailable.");
  }

  if (!response.ok) throw new ApiClientError("PASTX API could not return chain status.", response.status);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError("PASTX API returned an invalid response.", response.status);
  }

  if (typeof payload !== "object" || payload === null || !("item" in payload)) {
    throw new ApiClientError("PASTX API returned an invalid chain status.");
  }

  const item = (payload as { item?: unknown }).item;
  if (typeof item !== "object" || item === null) throw new ApiClientError("PASTX API returned an invalid chain status.");
  const status = item as Record<string, unknown>;
  const allowed = ["not_configured", "unreachable", "verified", "wrong_network"];
  if (
    typeof status.configured !== "boolean" ||
    typeof status.reachable !== "boolean" ||
    typeof status.networkMatches !== "boolean" ||
    typeof status.expectedChainId !== "number" ||
    !Number.isSafeInteger(status.expectedChainId) ||
    status.expectedChainId <= 0 ||
    !(status.chainId === null || (typeof status.chainId === "number" && Number.isSafeInteger(status.chainId) && status.chainId > 0)) ||
    typeof status.status !== "string" ||
    !allowed.includes(status.status) ||
    status.verificationScope !== "chain_id_only"
  ) {
    throw new ApiClientError("PASTX API returned an invalid chain status.");
  }

  const stateIsConsistent = status.status === "not_configured"
    ? status.configured === false && status.reachable === false && status.networkMatches === false && status.chainId === null
    : status.status === "unreachable"
      ? status.configured === true && status.reachable === false && status.networkMatches === false && status.chainId === null
      : status.status === "verified"
        ? status.configured === true && status.reachable === true && status.networkMatches === true && status.chainId === status.expectedChainId
        : status.configured === true && status.reachable === true && status.networkMatches === false && status.chainId !== null && status.chainId !== status.expectedChainId;

  if (!stateIsConsistent) throw new ApiClientError("PASTX API returned an inconsistent chain status.");
  return status as unknown as ChainStatus;
}

export async function getApiHealth(fetchImpl: typeof fetch = fetch): Promise<ApiHealth> {
  const payload = await fetchJson(fetchImpl, "/api/health");
  if (typeof payload !== "object" || payload === null) throw new ApiClientError("PASTX API returned invalid health status.");
  const health = payload as Record<string, unknown>;
  if (
    health.status !== "ok" ||
    typeof health.service !== "string" ||
    typeof health.marketDataConfigured !== "boolean" ||
    typeof health.marketDataDisplayEnabled !== "boolean" ||
    health.tradingEnabled !== false
  ) throw new ApiClientError("PASTX API returned invalid health status.");
  return health as unknown as ApiHealth;
}

export async function getMarketQuote(symbol: string, fetchImpl: typeof fetch = fetch): Promise<MarketQuote> {
  const payload = await fetchJson(fetchImpl, `/api/markets/${encodeURIComponent(symbol)}/quote`);
  if (typeof payload !== "object" || payload === null || !("item" in payload)) {
    throw new ApiClientError("PASTX API returned an invalid market quote.");
  }
  const item = (payload as { item?: unknown }).item;
  if (!isMarketQuote(item) || item.source !== "twelve_data") {
    throw new ApiClientError("PASTX API returned an invalid market quote.");
  }
  return item;
}

export async function getMarketCandles(
  symbol: string,
  interval: CandleInterval = "1day",
  outputsize = 30,
  fetchImpl: typeof fetch = fetch
): Promise<MarketCandle[]> {
  if (!Number.isInteger(outputsize) || outputsize < 1 || outputsize > 500) {
    throw new ApiClientError("Candle output size must be an integer between 1 and 500.");
  }
  const payload = await fetchJson(fetchImpl, `/api/markets/${encodeURIComponent(symbol)}/candles?interval=${encodeURIComponent(interval)}&outputsize=${outputsize}`);
  if (typeof payload !== "object" || payload === null || !("items" in payload) || !Array.isArray((payload as { items?: unknown }).items)) {
    throw new ApiClientError("PASTX API returned invalid candle data.");
  }
  const items = (payload as { items: unknown[] }).items;
  const candles = items.map((item): MarketCandle | null => {
    if (typeof item !== "object" || item === null) return null;
    const candle = item as Record<string, unknown>;
    const validDate = typeof candle.timestamp === "string" && Number.isFinite(Date.parse(candle.timestamp));
    const nums = [candle.open, candle.high, candle.low, candle.close];
    if (!validDate || !nums.every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) return null;
    const open = candle.open as number;
    const high = candle.high as number;
    const low = candle.low as number;
    const close = candle.close as number;
    const volume = candle.volume;
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) return null;
    if (!(volume === null || (typeof volume === "number" && Number.isFinite(volume) && volume >= 0))) return null;
    return { timestamp: candle.timestamp as string, open, high, low, close, volume };
  });
  if (candles.some((item) => item === null)) throw new ApiClientError("PASTX API returned malformed candle data.");
  return candles as MarketCandle[];
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { accept: "application/json" } });
  } catch {
    throw new ApiClientError("PASTX API is unavailable.");
  }
  if (!response.ok) throw new ApiClientError("PASTX API request failed.", response.status);
  try {
    return await response.json();
  } catch {
    throw new ApiClientError("PASTX API returned an invalid response.", response.status);
  }
}
