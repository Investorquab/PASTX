# PASTX API

**Implementation status:** the Fastify health, capability, reference-catalogue and chain-status endpoints are implemented. Quote and candle routes are implemented behind a server-side Twelve Data adapter. Live provider responses require a configured key, explicit display enablement, and confirmation that the provider terms permit the intended use. Portfolio, orders, chain assets and transaction endpoints remain planned.

## Base URL

Local development defaults to `http://localhost:4000`. All routes are prefixed with `/api`.

## Implemented endpoints

| Method | Route | Behavior |
|---|---|---|
| GET | `/api/health` | Liveness, provider configuration/display flags, and explicit `tradingEnabled: false` |
| GET | `/api/capabilities` | Authoritative machine-readable map of implemented, enabled and non-executable features |
| GET | `/api/chain/status` | Read-only EVM chain-ID and latest-block probe with a narrowly scoped verification label |
| GET | `/api/chain/fingerprint` | Compares observed chain ID, genesis hash and a configured trusted checkpoint; remains unconfigured until all anchors are supplied |
| GET | `/api/assets/onchain` | Explicit discovery status; remains unavailable until canonical chain/runtime verification is complete |
| GET | `/api/assets/onchain/registry-status` | Reports whether registry signature, digest pin and metadata checks pass; does not enable discovery |
| GET | `/api/assets/onchain/readiness` | Combines registry integrity, the live trusted-chain fingerprint result, and runtime-adapter readiness into a read-only blocker report |
| GET | `/api/markets` | Four featured reference instruments; not the full stock universe |
| GET | `/api/markets/search?q=...&limit=...` | Bounded provider-backed listed-equity search with exchange/MIC identity |
| GET | `/api/markets/:symbol` | Metadata for a featured or explicitly identified discovered listing |
| GET | `/api/markets/:symbol/logo?exchange=...&mic_code=...&country=...&currency=...` | Validated HTTPS company-logo URL for the selected listing, or `null` for initials fallback |
| GET | `/api/markets/:symbol/quote` | Normalized quote from Twelve Data for a selected listing |
| GET | `/api/markets/:symbol/candles` | Normalized OHLCV candles from Twelve Data for a selected listing |

The four entries returned by `/api/markets` are quick-access defaults, not a cap on stock discovery. `/api/markets/search` accepts a trimmed query of 2–80 characters and a result limit from 1–20 (default 15). It requires the server-side `MARKET_DATA_API_KEY`, calls Twelve Data symbol search with a bounded result count, validates provider fields and equity instrument types, and de-duplicates only repeated listings. A ticker may legitimately appear more than once when its exchange/MIC identity differs. Search returns external listed-stock metadata only and does not imply that a Portaldot token exists or that quote/trading features are enabled. Search is metadata discovery and remains separate from the quote/candle display permission gate.

Quote, candle and logo requests for discovered stocks must carry listing identity using query parameters such as `exchange=NASDAQ&mic_code=XNAS&country=United%20States&currency=USD`. The adapter sends venue identity to Twelve Data and validates provider metadata where returned. External provider access is limited to instruments classified as `reference`; simulated and on-chain instruments cannot be sent to the stock-price provider. Provider keys remain server-side.

## Capability contract

`GET /api/capabilities` gives the frontend and external clients one source of truth for feature gating. Each capability separates `implemented` from `enabled`; a feature may exist in code but remain disabled by configuration or safety gates.

Current capability boundaries:
- Reference catalogue: implemented and enabled.
- Quotes and candles: implemented, enabled only when a provider key is configured and `MARKET_DATA_DISPLAY_ENABLED=true`.
- Chain probe: enabled, with verification scope `chain_id_and_latest_block_read`; this is not canonical network verification.
- Trusted chain fingerprint: implemented but disabled until the RPC URL, expected chain ID, genesis hash, checkpoint block number and checkpoint block hash are configured. The verification scope is `chain_id_genesis_checkpoint_latest_block_read`; this anchors history through the chosen checkpoint but does not prove head finality or ongoing block progression.
- On-chain registry integrity: `onchainAssetRegistryIntegrity` reports `not_configured`, `invalid`, or `verified` after verifying the Ed25519 signature against a trusted public key, checking exact JSON bytes against a configured SHA-256 pin, and validating metadata.
- On-chain readiness diagnostics: `GET /api/assets/onchain/readiness` combines the configured registry-integrity result with a fresh trusted-chain fingerprint probe and reports stable blocker identifiers. It always reports `status: "blocked"` and `discoveryEnabled: false` until the supported runtime adapter is verified; a valid signature and matching fingerprint are not sufficient to enable discovery.
- On-chain asset discovery: remains disabled even when registry integrity is verified. `/api/assets/onchain` returns `status: "unavailable"` and an empty `items` list until canonical chain/runtime verification is independently complete. Missing and invalid registry configuration returns `registry_not_configured` or `registry_integrity_failed`. An empty list is not evidence that the chain has no assets or a wallet has zero balances.
- Order preview: non-executable preview only.
- Wallet connection, on-chain balances, order submission, transaction history and atomic settlement: not implemented and disabled.
- Trading remains disabled regardless of capability response.

The capability endpoint does not perform network probes or expose provider credentials, RPC URLs, wallet data, registry contents, registry digest pins or environment values. Do not treat `implemented: true` as evidence of production readiness or successful external integration.

## Quotes

For a discovered listing, request its full venue identity, for example:

```text
GET /api/markets/AMD/quote?exchange=NASDAQ&mic_code=XNAS&country=United%20States&currency=USD
```

A successful quote includes:
- `symbol`: PASTX catalogue symbol;
- `price`, `change`, `changePercent`;
- `currency`;
- `observedAt`: ISO-8601 timestamp;
- `source`: `twelve_data`;
- `delayed`: currently `null` because the adapter does not claim delay status it cannot establish.

The provider's API key is sent only by the server. It must never be added to the browser bundle or returned in API payloads. The adapter rejects provider responses whose symbol, available venue metadata, or currency does not match the requested listing identity.

## Candles

`GET /api/markets/AAPL/candles?interval=1day&outputsize=30`

Supported intervals: `1min`, `5min`, `15min`, `30min`, `1h`, `1day`. `outputsize` must contain decimal digits only and represent an integer from 1 through 500; values such as `abc`, `1.5`, negative values, zero and values above 500 are rejected before the provider is called. Candles include ISO timestamp, open, high, low, close, and nullable volume. Provider metadata must match the requested symbol, interval and catalogue currency before values are accepted. Requests normalize timestamps in UTC, and malformed OHLC relationships are rejected.

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

Live quote and candle endpoints return `MARKET_DATA_DISPLAY_DISABLED` unless `MARKET_DATA_DISPLAY_ENABLED=true` is explicitly configured after confirming the provider license permits client-facing display. The flag defaults to false. The API applies a global rate limit of 60 requests per minute per client; rate-limit failures use the same normalized error envelope with code `RATE_LIMITED` and a request ID. Security headers and an eight-second provider timeout are also applied. Successful normalized quotes are cached in memory for 15 seconds and candle series for 60 seconds, with a maximum of 128 cache keys per cache. Identical concurrent quote/candle cache misses are coalesced into one provider request for the same instrument mapping (and candle interval/output size). Failed requests are not cached and in-flight entries are cleared after completion. Cache entries are process-local and are not durable or shared across replicas. Provider-facing errors remain generic. Provider-specific payloads and credentials are not returned.

## Chain status semantics

`GET /api/chain/status` reports `not_configured`, `unreachable`, `wrong_network`, or `verified` and includes `verificationScope: "chain_id_and_latest_block_read"` in every result. The response includes the observed `chainId` and `blockNumber` when the RPC responds. The expected EVM chain ID is `420420777`, based on the [Portaldot V3 testnet guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide). The `verified` label means only that the configured RPC returned the expected chain ID and a readable latest block at probe time. It does **not** prove the endpoint is the intended canonical network, that the block is advancing, wallet compatibility, runtime pallet behavior, asset interoperability, transaction execution, or safe settlement. The explicit scope field prevents consumers from interpreting this probe as full integration verification.

## Planned, not implemented

- `GET /api/portfolio/:address`
- `GET /api/orders/:address`
- `GET /api/transactions/:hash`

These routes must not be represented as operational until a supported Portaldot runtime adapter and chain verification tests exist.

## Wallet and transaction flow

The browser wallet must sign and submit transactions. The server must never sign with a user's private key or request seed phrases. A submitted transaction is not a completed trade; completion requires the selected receipt/event and resulting-state checks. Trading is currently disabled.


## Reference-only order intent preview

The shared domain exports `buildOrderIntentPreview(side, symbol, rawQuantity, referencePrice)`. It accepts only a buy/sell side, a known catalogue symbol, a finite positive quantity within the preview bound, and a finite positive reference price. It returns normalized symbol, quantity, reference price, reference notional, currency and `executable: false`, or `null` for invalid input.

This is deterministic preview arithmetic only. It does not create an exchange order, guarantee a quote, reserve funds, check balances, authorize a transaction, or represent tokenized equity ownership. The preview must not be submitted to the chain or presented as a filled order.
