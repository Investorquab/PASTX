# PASTX Testing Strategy

**Status:** test plan. Test suites will be added with the corresponding implementation.

## Test levels

### Unit
- market-data normalization and missing fields;
- input validation and amount precision;
- instrument classification;
- candle timestamp/interval conversion;
- transaction-state mapping;
- error-code mapping.

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

## CI expectations

When package scaffolding exists, CI should run formatting/lint checks, TypeScript checks, unit tests and a production build. Add browser and chain integration tests as those implementations become available. Do not mark a test as passed unless it ran.
