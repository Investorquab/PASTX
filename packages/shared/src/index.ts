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
  | "RATE_LIMITED"
  | "MARKET_DATA_DISPLAY_DISABLED"
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

/**
 * Shared, non-executable order-preview arithmetic. These functions calculate
 * reference notional only; they do not create an order, reserve funds, or
 * represent a guaranteed execution price.
 */
export const MAX_PREVIEW_QUANTITY = 1_000_000;

export function parsePreviewQuantity(rawQuantity: string): number | null {
  if (!rawQuantity.trim()) return null;
  const quantity = Number(rawQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_PREVIEW_QUANTITY) return null;
  return quantity;
}

export function calculateReferenceNotional(rawQuantity: string, unitPrice: number): number | null {
  const quantity = parsePreviewQuantity(rawQuantity);
  if (quantity === null || !Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  const notional = quantity * unitPrice;
  return Number.isFinite(notional) ? notional : null;
}

export type OrderSide = "buy" | "sell";

export type OrderIntentPreview = {
  side: OrderSide;
  symbol: string;
  quantity: number;
  referencePrice: number;
  referenceNotional: number;
  currency: string;
  executable: false;
};

/** Deterministic reference-only preview. This never creates or executes an order. */
export function buildOrderIntentPreview(
  side: OrderSide,
  rawSymbol: string,
  rawQuantity: string,
  referencePrice: number
): OrderIntentPreview | null {
  if (side !== "buy" && side !== "sell") return null;
  const symbol = rawSymbol.trim().toUpperCase();
  const instrument = MARKET_INSTRUMENTS.find((item) => item.symbol === symbol);
  const quantity = parsePreviewQuantity(rawQuantity);
  const referenceNotional = calculateReferenceNotional(rawQuantity, referencePrice);
  if (!instrument || quantity === null || referenceNotional === null) return null;
  return { side, symbol, quantity, referencePrice, referenceNotional, currency: instrument.currency, executable: false };
}
