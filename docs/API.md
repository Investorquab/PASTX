# PASTX API

**Implementation status:** the Fastify health, capability, reference-catalogue and chain-status endpoints are implemented. Quote and candle routes are implemented behind a server-side Twelve Data adapter. Live provider responses require a configured key, explicit display enablement, and confirmation that the provider terms permit the intended use. Portfolio, orders, chain assets and transaction endpoints remain planned.

## Base URL

Local development defaults to `http://localhost:4000`. All routes are prefixed with `/api`.

## Implemented endpoints

| Method | Route | Behavior |
|---|---|---|
| GET | `/api/health` | Liveness, provider configuration/display flags, and explicit `tradingEnabled: false` |
| GET | `/api/capabilities` | Authoritative machine-readable map of implemented, enabled and non-executable features |
| GET | `/api/chain/status` | Read-only EVM chain-ID probe with a narrowly scoped verification label |
| GET | `/api/markets` | Supported reference instrument catalogue |
| GET | `/api/markets/:symbol` | Instrument metadata |
| GET | `/api/markets/:symbol/quote` | Normalized quote from Twelve Data |
| GET | `/api/markets/:symbol/candles` | Normalized OHLCV candles from Twelve Data |

Symbols are case-insensitive and limited to the explicit allow-listed catalogue (AAPL, NVDA, TSLA, MSFT). This prevents arbitrary provider proxying and uncontrolled symbol usage.

## Capability contract

`GET /api/capabilities` gives the frontend and external clients one source of truth for feature gating. Each capability separates `implemented` from `enabled`; a feature may exist in code but remain disabled by configuration or safety gates.

Current capability boundaries:
- Reference catalogue: implemented and enabled.
- Quotes and candles: implemented, enabled only when a provider key is configured and `MARKET_DATA_DISPLAY_ENABLED=true`.
- Chain identity probe: enabled, but verification scope is `chain_id_only`.
- Order preview: non-executable preview only.
- Wallet connection, on-chain balances, order submission, transaction history and atomic settlement: not implemented and disabled.
- Trading remains disabled regardless of capability response.

The capability endpoint does not perform network probes or expose provider credentials, RPC URLs, wallet data or environment values. Do not treat `implemented: true` as evidence of production readiness or successful external integration.

## Quotes

A successful quote includes:
- `symbol`: PASTX catalogue symbol;
- `price`, `change`, `changePercent`;
- `currency`;
- `observedAt`: ISO-8601 timestamp;
- `source`: `twelve_data`;
- `delayed`: currently `null` because the adapter does not claim delay status it cannot establish.

The provider's API key is sent only by the server. It must never be added to the browser bundle or returned in API payloads.

## Candles

`GET /api/markets/AAPL/candles?interval=1day&outputsize=30`

Supported intervals: `1min`, `5min`, `15min`, `30min`, `1h`, `1day`. `outputsize` must contain decimal digits only and represent an integer from 1 through 500; values such as `abc`, `1.5`, negative values, zero and values above 500 are rejected before the provider is called. Candles include ISO timestamp, open, high, low, close, and nullable volume. Malformed OHLC relationships are rejected.

## Error contract

Errors use `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.

| Code | Meaning |
|---|---|
| `INVALID_INPUT` | Unsupported interval or invalid bounded query |
| `NOT_FOUND` | Unknown instrument or route |
| `RATE_LIMITED` | API request limit exceeded; includes the standard request ID when available |
| `MARKET_DATA_DISPLAY_DISABLED` | Public quote/candle display is disabled until provider terms are verified |
| `PROVIDER_NOT_CONFIGURED` | `MARKET_DATA_API_KEY` is absent |
| `PROVIDER_RATE_LIMIT` | Provider quota/rate limit reached |
| `PROVIDER_UNAVAILABLE` | Provider request failed or timed out |
| `PROVIDER_INVALID_RESPONSE` | Provider payload cannot be normalized safely |
| `INTERNAL_ERROR` | Unexpected server error |

Live quote and candle endpoints return `MARKET_DATA_DISPLAY_DISABLED` unless `MARKET_DATA_DISPLAY_ENABLED=true` is explicitly configured after confirming the provider license permits client-facing display. The flag defaults to false. The API applies a global rate limit of 60 requests per minute per client; rate-limit failures use the same normalized error envelope with code `RATE_LIMITED` and a request ID. Security headers and an eight-second provider timeout are also applied. Successful normalized quotes are cached in memory for 15 seconds and candle series for 60 seconds, with a maximum of 128 cache keys per cache. Cache entries are process-local and are not durable or shared across replicas. Provider-facing errors remain generic. Provider-specific payloads and credentials are not returned.

## Chain status semantics

`GET /api/chain/status` reports `not_configured`, `unreachable`, `wrong_network`, or `verified` and includes `verificationScope: "chain_id_only"` in every result. The expected EVM chain ID is `420420777`, based on the [Portaldot V3 testnet guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide). The `verified` label means only that the configured RPC reported the expected chain ID at probe time. It does **not** prove the endpoint is the intended canonical network, wallet compatibility, runtime pallet behavior, asset interoperability, transaction execution, or safe settlement. The explicit scope field is intended to prevent consumers from interpreting chain-ID matching as full integration verification.

## Planned, not implemented

- `GET /api/assets/onchain`
- `GET /api/portfolio/:address`
- `GET /api/orders/:address`
- `GET /api/transactions/:hash`

These routes must not be represented as operational until a supported Portaldot runtime adapter and chain verification tests exist.

## Wallet and transaction flow

The browser wallet must sign and submit transactions. The server must never sign with a user's private key or request seed phrases. A submitted transaction is not a completed trade; completion requires the selected receipt/event and resulting-state checks. Trading is currently disabled.


## Reference-only order intent preview

The shared domain exports `buildOrderIntentPreview(side, symbol, rawQuantity, referencePrice)`. It accepts only a buy/sell side, a known catalogue symbol, a finite positive quantity within the preview bound, and a finite positive reference price. It returns normalized symbol, quantity, reference price, reference notional, currency and `executable: false`, or `null` for invalid input.

This is deterministic preview arithmetic only. It does not create an exchange order, guarantee a quote, reserve funds, check balances, authorize a transaction, or represent tokenized equity ownership. The preview must not be submitted to the chain or presented as a filled order.
