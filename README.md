# PASTX

**Portaldot Asset & Stock Trading Exchange** — a market-discovery application designed around the Portaldot ecosystem.

> **Status: early engineering foundation.** The web terminal is a preview using labelled fixture data. The Fastify market API and Twelve Data adapter are implemented in source with automated tests. Live quote/candle routes are disabled by default. Do not enable client-facing display until the provider account terms permit it and CI passes. PASTX is not yet a functioning exchange; wallet, on-chain asset, and settlement integrations are not enabled.

## Product direction

PASTX aims to provide:
- A searchable catalogue with clear distinction between reference instruments, simulated markets and verified on-chain assets.
- Historical charts and market data with source, currency and timestamp.
- A portfolio and activity view derived from verifiable chain state.
- A safe order flow that makes asset/payment, quantity, fees and network explicit before the user's wallet signs.
- Atomic settlement only after Portaldot runtime compatibility is demonstrated.

External stock quotes are references only. They do not represent tokenized equity, ownership rights, backing, or executable PASTX prices.

## Architecture

- `apps/web`: React + TypeScript + Vite market terminal.
- `apps/api`: Fastify HTTP API with security headers, rate limiting and stable error responses. Its current runtime executes TypeScript through `tsx`; the repository does not yet produce a standalone API bundle.
- `packages/shared`: domain types and supported instrument catalogue.
- `packages/market-data`: Twelve Data adapter; provider credentials remain server-side.
- `packages/chain-adapter`: read-only Portaldot EVM RPC chain-and-latest-block probe; no transaction writes.
- `docs/`: architecture, API, settlement, security, tests and deployment notes.

See [Architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [Settlement Design](docs/SETTLEMENT-DESIGN.md), [Hackathon Requirements](docs/HACKATHON-REQUIREMENTS.md), and [Project Status](docs/PROJECT-STATUS.md).

## Requirements

- Node.js 22+
- pnpm 10.15.0 (pinned in the root manifest)

## Local development

```bash
pnpm install
pnpm dev
```

The root `pnpm dev` command starts the web app and API dev servers in parallel. Vite proxies `/api` requests to `http://127.0.0.1:4000`. The web app is normally available at `http://localhost:5173`, and the API at `http://localhost:4000`.

To start them separately, use two terminals:

```bash
pnpm --filter @pastx/web dev
pnpm --filter @pastx/api dev
```

The web app defaults to Vite's local development port; the API defaults to `http://localhost:4000`.

Copy `.env.example` to `.env` for local API configuration. Set `MARKET_DATA_API_KEY` on the API process only. Never add a real key to Git or a `VITE_*` variable. Without a key, the API returns a clear `PROVIDER_NOT_CONFIGURED` error rather than invented quote data. Quote/candle display is also blocked unless `MARKET_DATA_DISPLAY_ENABLED=true`; confirm client-facing display rights before enabling it.

## API examples

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/markets
curl http://localhost:4000/api/markets/AAPL
curl http://localhost:4000/api/markets/AAPL/quote
curl "http://localhost:4000/api/markets/AAPL/candles?interval=1day&outputsize=30"
```

The quote and candles routes require a valid provider key and provider access for the requested symbols. Current Twelve Data Basic terms describe free access as internal/non-display; verify licensing before exposing live data in a public client-facing app. See [Twelve Data business pricing](https://twelvedata.com/pricing-business).

## Quality checks

```bash
pnpm check
pnpm test
pnpm build
```

CI status: [GitHub Actions](https://github.com/Investorquab/PASTX/actions).

## Portaldot integration and release gates

The repository deliberately does not enable wallet connection or trade submission yet. The Portaldot V3 testnet/runtime, supported wallet path, asset/payment interoperability, and atomic settlement must be verified before implementation is represented as complete. See [Settlement Design](docs/SETTLEMENT-DESIGN.md) and [Security](docs/SECURITY.md).

## Hackathon fit

PASTX is primarily an **Ecosystem DApp**: a consumer-facing market/asset application. The API and provider-normalization layer also contributes to **Modular Cloud & Middleware**. The final submission must demonstrate actual Portaldot V3 usage, deployment evidence, and at least one verifiable core flow; a UI-only preview is not sufficient.

## License

No license has been declared yet. Confirm project licensing before accepting external contributions or redistributing code.
