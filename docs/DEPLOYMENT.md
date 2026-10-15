# PASTX Deployment and Local Runbook

**Status:** local development instructions only. No production or Portaldot testnet deployment is claimed.

## Prerequisites

- Node.js 22+
- pnpm 10.15.0
- A Twelve Data API key for live provider calls (optional for API startup and catalogue endpoints)

## Install and run locally

From the repository root:

```bash
pnpm install
```

Start the web app and API in separate terminals:

```bash
pnpm --filter @pastx/web dev
```

```bash
pnpm --filter @pastx/api dev
```

The API listens on `0.0.0.0:4000` by default. The web app uses Vite's local development server. The current UI remains a fixture preview and does not claim to be connected to the API.

## Configure market data

1. Copy `.env.example` to an untracked local `.env`.
2. Set `MARKET_DATA_API_KEY` in the environment of the API process only.
3. Restart the API process.
4. Verify `GET /api/health` reports `marketDataConfigured: true`.
5. Test `GET /api/markets/AAPL/quote` and `GET /api/markets/AAPL/candles?interval=1day&outputsize=30`.

Do not put the key in `VITE_*` variables, browser code, screenshots or commits. Without a key, quote/candle endpoints should return `PROVIDER_NOT_CONFIGURED`, not fabricated market data.

Before public client-facing display, verify the provider account's license and terms. The Twelve Data Basic plan describes internal non-display access; external display is listed under business pricing plans.

## Quality gate

```bash
pnpm check
pnpm test
pnpm build
```

Use [GitHub Actions](https://github.com/Investorquab/PASTX/actions) to verify the pushed commit.

## Production deployment remains blocked on

- A deployment target and secure server-side secret configuration.
- A generated and committed lockfile for reproducible dependency installation.
- Green workspace CI and local Windows smoke tests.
- A permitted market-data display license/configuration if live prices are publicly shown.
- A working Portaldot V3 runtime/wallet integration.
- Atomic settlement and failure rollback tests before any trade action is enabled.
- A real testnet deployment and recorded contract/transaction evidence.

Never deploy a UI that suggests live trading while the wallet, chain and settlement path are disabled.
