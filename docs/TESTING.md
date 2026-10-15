# PASTX Testing Strategy

## Current automated coverage

Vitest suites are included for:
- shared instrument classifications and candle interval allow-list;
- read-only chain identity probe for missing RPC configuration, expected chain ID, wrong network, invalid ID and RPC failure;
- browser API client for valid chain status, malformed payloads, HTTP errors and transport failure;
- quote shape validation;
- Twelve Data quote/candle normalization, missing API key, provider rate-limit errors, malformed timestamps/OHLC payloads and quote-cache expiry;
- API health flags, catalogue output, unknown symbols, bounded candle query parameters and safe provider errors.

The CI workflow runs workspace type checks, unit tests and production builds. Refer to the latest [GitHub Actions run](https://github.com/Investorquab/PASTX/actions) for the actual status. A test is not considered passed until the corresponding run is green.

## Remaining test levels

### Component
- loading, empty, stale, delayed and provider-error states;
- market search and instrument detail;
- order form validation;
- disconnected wallet, wrong network and rejected signature;
- pending, successful and failed transaction states.

### Integration
- market provider adapter using fixtures or a controlled test key;
- RPC adapter against a known local/test environment;
- balance/metadata reads;
- receipt/event verification;
- settlement failure and rollback.

### End-to-end
- open market page and inspect an instrument;
- chart loads and labels its source;
- connect supported wallet;
- inspect balance and order details;
- complete a safe test transaction when the target environment is available;
- verify resulting state and activity history.

## Required settlement invariants

1. A pending transaction is never shown as completed.
2. A failed transaction does not create a completed order.
3. A duplicate request cannot create an unintended duplicate trade.
4. A forced second-leg failure leaves no first-leg transfer behind.
5. Portfolio balances are based on verified chain state.
6. External reference quotes are never presented as guaranteed execution prices.

## Human-required verification

CI cannot verify wallet UX, a live Portaldot testnet transaction, explorer evidence, provider account licensing, or deployment configuration. Those remain explicit release gates and must not be described as passed by unit tests.
