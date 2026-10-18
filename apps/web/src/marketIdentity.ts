export type MarketIdentity = { symbol: string; exchange?: string; micCode?: string };

function normalize(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

/** Stable identity for a listing; ticker symbols alone are not globally unique. */
export function marketIdentityKey(instrument: MarketIdentity): string {
  return normalize(instrument.symbol) + "::" + (normalize(instrument.micCode) || normalize(instrument.exchange));
}

/** Resolve the exact listing when a MIC is known; avoid silently switching venues. */
export function findMarketByIdentity<T extends MarketIdentity>(
  markets: readonly T[],
  identity: MarketIdentity
): T | undefined {
  const symbol = normalize(identity.symbol);
  const micCode = normalize(identity.micCode);
  const exchange = normalize(identity.exchange);
  if (micCode) return markets.find((market) => normalize(market.symbol) === symbol && normalize(market.micCode) === micCode && (!exchange || normalize(market.exchange) === exchange));
  if (exchange) {
    const matches = markets.filter((market) => normalize(market.symbol) === symbol && normalize(market.exchange) === exchange);
    if (matches.length === 1) return matches[0];
    return matches.find((market) => !normalize(market.micCode));
  }
  return markets.find((market) => normalize(market.symbol) === symbol);
}
