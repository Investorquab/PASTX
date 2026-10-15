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
pnpm dev
```

The root command starts the web app and API dev processes in parallel. To start either service independently, use separate terminals:

```bash
pnpm --filter @pastx/web dev
pnpm --filter @pastx/api dev
```

The API listens on `0.0.0.0:4000` by default. The web app uses Vite's local development server and proxies `/api` requests to the Fastify API at `http://127.0.0.1:4000`. The UI reads the API's read-only chain status. It requests provider quotes/candles only if the API health response says the key is configured and `MARKET_DATA_DISPLAY_ENABLED=true`; otherwise it stays on labelled fixture data.

## Configure market data

1. Copy `.env.example` to an untracked local `.env`.
2. Set `MARKET_DATA_API_KEY` in the environment of the API process only. Keep `MARKET_DATA_DISPLAY_ENABLED=false` until the provider account explicitly permits public/client-facing display. The quote and candle routes are blocked by default.
3. Restart the API process.
4. Verify `GET /api/health` reports `marketDataConfigured: true` and `marketDataDisplayEnabled: false`.
5. With display disabled, verify quote/candle endpoints return `MARKET_DATA_DISPLAY_DISABLED`.
6. Only after provider licensing is confirmed, set `MARKET_DATA_DISPLAY_ENABLED=true`, restart the API, and test `GET /api/markets/AAPL/quote` and `GET /api/markets/AAPL/candles?interval=1day&outputsize=30`.

Do not put the key in `VITE_*` variables, browser code, screenshots or commits. Without a key, quote/candle endpoints should return `PROVIDER_NOT_CONFIGURED`, not fabricated market data.

Before public client-facing display, verify the provider account's license and terms. The Twelve Data Basic plan describes internal non-display access; external display is listed under business pricing plans.

## Optional Portaldot RPC probe

Set `PORTALDOT_EVM_RPC_URL` to the public RPC endpoint for the intended Portaldot V3 EVM environment. The API route `GET /api/chain/status` performs a read-only chain-ID check against `420420777`. An unreachable or wrong network is reported explicitly; the endpoint never submits a transaction or exposes the configured URL. A matching chain ID is not proof of asset interoperability or settlement safety. Check the endpoint directly when needed:

```bash
curl --connect-timeout 3 --max-time 8 -sS \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  "$PORTALDOT_EVM_RPC_URL"
```

For chain ID `420420777`, the JSON-RPC result should be `0x190f1ca9`. If the RPC is unreachable or reports a different chain ID, do not connect a wallet or submit transactions.

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
