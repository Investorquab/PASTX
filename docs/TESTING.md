# PASTX Testing Strategy

## Current automated coverage

Vitest suites are included for:
- shared instrument classifications and candle interval allow-list;
- read-only chain identity probe for missing RPC configuration, expected chain ID, wrong network, invalid ID and RPC failure;
- browser API client for valid and internally consistent chain status, canonical expected-chain ID enforcement, malformed payloads, HTTP errors and transport failure;
- quote/candle client validation, requested-symbol and catalogue-currency matching, candle response symbol/interval matching, runtime candle-interval validation, and the rule that fixture quotes cannot be accepted as provider data;
- frontend partial-provider-failure behavior: successful symbol quotes can render without waiting for every other quote to succeed, candle-source labeling is independent of quote availability, and failed quote rows remain explicitly labelled sample values;
- shared order-preview quantity and reference-notional arithmetic consumed by the web app, including invalid input and overflow;
- quote shape validation;
- Twelve Data quote/candle normalization, missing API key, provider rate-limit errors, mismatched quote symbols/currencies, malformed timestamps/OHLC and provided-volume payloads, quote-cache expiry, defensive cache copies, transport failures and timeout mapping;
- API health flags, machine-readable capability contract, security headers, catalogue output, unknown symbols, bounded candle query parameters (including decimal-digit parsing, range limits and valid values), safe provider errors, and normalized rate-limit responses.

The CI workflow runs frozen-lockfile dependency installation, workspace type checks, unit tests and production builds. The capability-discovery change passed all three quality stages in [CI run #144](https://github.com/Investorquab/PASTX/actions/runs/38690844224). The order-intent/provider regression suite also passed in [CI run #162](https://github.com/Investorquab/PASTX/actions/runs/38691768142). Refer to the latest [GitHub Actions run](https://github.com/Investorquab/PASTX/actions) for the actual status. A test is not considered passed until the corresponding run is green.

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


## Reference-only order intent tests

Shared-domain tests cover normalized buy/sell previews for known catalogue symbols, invalid symbols and quantities, invalid/non-positive prices, overflow, and the invariant that every preview is marked `executable: false`. These checks validate calculation only; they do not prove wallet, balance, order submission or settlement behavior.
