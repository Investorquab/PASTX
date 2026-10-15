# PASTX Architecture

**Status:** proposed architecture; integrations are not yet verified.

## Goals

- Deliver a usable market-discovery and trading experience.
- Isolate external market-data vendors from the UI.
- Isolate Portaldot runtime details behind a typed chain adapter.
- Keep wallet signing under the user's wallet.
- Make order status auditable from transaction evidence.
- Keep the MVP small enough to deliver and test within the hackathon.

## System boundaries

```text
React web app
  ├── Market API ──> PASTX API ──> Market-data provider
  │                         └──> cache / optional PostgreSQL
  └── Wallet adapter ──> Portaldot chain adapter ──> configured RPC
                                                └──> receipts/events/state

Future SDK ──> public, typed interfaces from shared packages
```

The browser may read public chain state and request signatures, but it must not contain provider secrets. The API must never request or store a user's wallet seed phrase or private key.

## Proposed workspace

- `apps/web`: routes, market UI, wallet connection, order ticket, portfolio.
- `apps/api`: HTTP routes, input validation, provider credentials, caching and application services.
- `packages/shared`: shared types, schemas, error shapes and domain enums.
- `packages/market-data`: vendor-neutral interface and normalized quote/candle types.
- `packages/chain-adapter`: network checks, metadata/balance reads, transaction submission and receipt verification.
- `packages/sdk`: future public SDK built from proven interfaces.
- `contracts/`: only if a contract-based route is validated and needed.
- `docs/`: decisions, operational instructions and verification evidence.

## Data ownership

| Data | Authority |
|---|---|
| External stock reference price and candles | Named market-data provider, with source and timestamp |
| On-chain asset metadata and balances | Verified Portaldot runtime state |
| Settlement result | Transaction receipt/events plus resulting state |
| Watchlist/preferences | App persistence, if enabled |
| Convenient activity index | Derived from verified chain evidence; never the settlement authority |

## Market-data interface

A provider adapter should support instrument lookup, quote retrieval and historical OHLCV candles. Streaming can be added when needed. Normalize timestamps, currency, interval and missing-data behavior at the provider boundary.

The UI must distinguish delayed, historical, unavailable and live data. Do not invent a quote or imply external stock prices are executable on-chain prices.

## Chain-adapter interface

Proposed operations:
- `getNetworkInfo()`
- `getAssetMetadata(assetId)`
- `getBalance(account, assetId)`
- `prepareOrder(intent)`
- `submitOrder(preparedOrder, wallet)`
- `getSettlementStatus(txHash)`
- `getTransactionReceipt(txHash)`

These are app-level abstractions, not verified names of Portaldot RPC methods. Implementations must be backed by runtime inspection and integration tests.

## Settlement boundary

The MVP must not assume that native Assets, Solidity contracts, wallets, or runtime pallets interoperate. Choose one verified asset/payment path. A completed trade must meet explicit on-chain success conditions; submitted or included transactions alone are not enough if the required state transition failed.

See [Settlement Design](SETTLEMENT-DESIGN.md).

## Architectural decisions

- Start as a modular monolith, not microservices.
- Use a server-side market-data adapter to protect keys and normalize provider responses.
- Use PostgreSQL only when there is a concrete need for durable records or indexed chain history.
- Add Redis only if measured caching, rate limiting or job coordination needs justify it.
- Defer cross-chain bridges, matching engines and authentication expansion until the core flow works.
