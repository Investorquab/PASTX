# PASTX API

**Implementation status:** the Fastify health and reference-catalogue endpoints are implemented. Quote and candle routes are implemented behind a server-side Twelve Data adapter. Live provider responses require a configured key and successful CI/runtime verification. Portfolio, orders, chain assets and transaction endpoints remain planned.

## Base URL

Local development defaults to `http://localhost:4000`. All routes are prefixed with `/api`.

## Implemented endpoints

| Method | Route | Behavior |
|---|---|---|
| GET | `/api/health` | Health, whether the provider key is configured, and explicit `tradingEnabled: false` |
| GET | `/api/markets` | Supported reference instrument catalogue |
| GET | `/api/markets/:symbol` | Instrument metadata |
| GET | `/api/markets/:symbol/quote` | Normalized quote from Twelve Data |
| GET | `/api/markets/:symbol/candles` | Normalized OHLCV candles from Twelve Data |

Symbols are case-insensitive and limited to the explicit allow-listed catalogue (AAPL, NVDA, TSLA, MSFT). This prevents arbitrary provider proxying and uncontrolled symbol usage.

### Quotes

A successful quote includes:
- `symbol`: PASTX catalogue symbol;
- `price`, `change`, `changePercent`;
- `currency`;
- `observedAt`: ISO-8601 timestamp;
- `source`: `twelve_data`;
- `delayed`: currently `null` because the adapter does not claim delay status it cannot establish.

The provider's API key is sent only by the server. It must never be added to the browser bundle or returned in API payloads.

### Candles

`GET /api/markets/AAPL/candles?interval=1day&outputsize=30`

Supported intervals: `1min`, `5min`, `15min`, `30min`, `1h`, `1day`. `outputsize` must be an integer from 1 through 500. Candles include ISO timestamp, open, high, low, close, and nullable volume. Malformed OHLC relationships are rejected.

## Error contract

Errors use `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.

| Code | Meaning |
|---|---|
| `INVALID_INPUT` | Unsupported interval or invalid bounded query |
| `NOT_FOUND` | Unknown instrument or route |
| `PROVIDER_NOT_CONFIGURED` | `MARKET_DATA_API_KEY` is absent |
| `PROVIDER_RATE_LIMIT` | Provider quota/rate limit reached |
| `PROVIDER_UNAVAILABLE` | Provider request failed or timed out |
| `PROVIDER_INVALID_RESPONSE` | Provider payload cannot be normalized safely |
| `INTERNAL_ERROR` | Unexpected server error |

The API applies a global rate limit of 60 requests per minute per client, security headers, an eight-second provider timeout, and generic provider-facing error messages. Provider-specific payloads and credentials are not returned.

## Planned, not implemented

- `GET /api/assets/onchain`
- `GET /api/portfolio/:address`
- `GET /api/orders/:address`
- `GET /api/transactions/:hash`

These routes must not be represented as operational until a supported Portaldot runtime adapter and chain verification tests exist.

## Wallet and transaction flow

The browser wallet must sign and submit transactions. The server must never sign with a user's private key or request seed phrases. A submitted transaction is not a completed trade; completion requires the selected receipt/event and resulting-state checks. Trading is currently disabled.
