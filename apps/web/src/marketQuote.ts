import type { MarketQuote } from "@pastx/shared";

export type { MarketQuote } from "@pastx/shared";
const SYMBOL_PATTERN = /^[A-Z0-9.^_-]{1,20}$/;
const CURRENCY_PATTERN = /^[A-Z]{3,8}$/;

export function isMarketQuote(value: unknown): value is MarketQuote {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const quote = value as Record<string, unknown>;

  return (
    typeof quote.symbol === "string" &&
    SYMBOL_PATTERN.test(quote.symbol) &&
    typeof quote.price === "number" &&
    Number.isFinite(quote.price) &&
    quote.price > 0 &&
    typeof quote.changePercent === "number" &&
    Number.isFinite(quote.changePercent) &&
    typeof quote.change === "number" &&
    Number.isFinite(quote.change) &&
    typeof quote.currency === "string" &&
    CURRENCY_PATTERN.test(quote.currency) &&
    (quote.delayed === null || typeof quote.delayed === "boolean") &&
    typeof quote.observedAt === "string" &&
    quote.observedAt.length > 0 &&
    Number.isFinite(Date.parse(quote.observedAt)) &&
    (quote.source === "fixture" || quote.source === "twelve_data")
  );
}
