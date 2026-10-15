# PASTX API Contract

**Status:** proposed routes; no claim that these endpoints are implemented.

## Design rules

- Validate all path, query and body inputs at the server boundary.
- Return stable error codes and avoid leaking secrets or provider internals.
- Include source and timestamp for market reference data.
- Apply provider quotas, bounded timeouts and caching.
- Never treat a client-provided price or portfolio total as authoritative.
- Do not expose a server endpoint that signs transactions with a user key.

## Proposed endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Process health and non-sensitive dependency status |
| GET | `/api/markets` | Search/list supported market entries |
| GET | `/api/markets/:symbol` | Instrument details and classification |
| GET | `/api/markets/:symbol/quote` | Latest provider quote, source and timestamp |
| GET | `/api/markets/:symbol/candles` | Historical OHLCV candles |
| GET | `/api/assets/onchain` | Verified on-chain assets on a supported network |
| GET | `/api/portfolio/:address` | Portfolio derived from verified balances and disclosed valuation sources |
| GET | `/api/orders/:address` | Indexed order/activity history, if implemented |
| GET | `/api/transactions/:hash` | Transaction status and verification evidence |

## Candle query

The candles endpoint should eventually accept bounded parameters such as interval, start/end time and limit. Allowed intervals and maximum lookback must be defined by the selected provider and validated server-side.

Each candle uses a consistent normalized shape:
- timestamp (UTC epoch or ISO format, chosen consistently);
- open, high, low, close;
- volume if supplied by the provider;
- provider/source and any missing/delayed-data indicators.

## Instrument classification

Every market response must identify one of:
- `reference`: external price data only;
- `simulated`: demo-only behavior;
- `onchain`: verified chain asset with network and asset identifier.

Do not mix reference-market quote fields with executable on-chain prices.

## Errors

Use stable machine-readable codes for invalid input, unsupported network, provider rate limit, provider unavailable, stale data, not found, RPC unavailable, transaction pending, and transaction failed. Client messages should be useful without exposing credentials or stack traces.

## Wallet and transaction flow

The client requests the wallet to sign and submit. The server may help read chain state or index evidence, but must not hold user private keys. A transaction is complete only after the selected verification rules pass.
