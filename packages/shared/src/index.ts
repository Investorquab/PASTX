export type InstrumentKind = "reference" | "simulated" | "onchain";

export type MarketInstrument = {
  symbol: string;
  name: string;
  kind: InstrumentKind;
  description: string;
  currency: string;
  providerSymbol?: string;
};

export type QuoteSource = "fixture" | "twelve_data";

export type MarketQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  observedAt: string;
  source: QuoteSource;
  delayed: boolean | null;
};

export type CandleInterval = "1min" | "5min" | "15min" | "30min" | "1h" | "1day";

export type MarketCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_INVALID_RESPONSE"
  | "INTERNAL_ERROR";

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
};

export const MARKET_INSTRUMENTS: readonly MarketInstrument[] = [
  { symbol: "AAPL", name: "Apple Inc.", kind: "reference", description: "External stock-price reference only; not an on-chain equity token.", currency: "USD", providerSymbol: "AAPL" },
  { symbol: "NVDA", name: "NVIDIA Corporation", kind: "reference", description: "External stock-price reference only; not an on-chain equity token.", currency: "USD", providerSymbol: "NVDA" },
  { symbol: "TSLA", name: "Tesla, Inc.", kind: "reference", description: "External stock-price reference only; not an on-chain equity token.", currency: "USD", providerSymbol: "TSLA" },
  { symbol: "MSFT", name: "Microsoft Corporation", kind: "reference", description: "External stock-price reference only; not an on-chain equity token.", currency: "USD", providerSymbol: "MSFT" }
] as const;

export function isCandleInterval(value: string): value is CandleInterval {
  return ["1min", "5min", "15min", "30min", "1h", "1day"].includes(value);
}
