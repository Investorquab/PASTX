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

Set `PORTALDOT_EVM_RPC_URL` to the public RPC endpoint for the intended Portaldot V3 EVM environment. The API route `GET /api/chain/status` performs read-only `eth_chainId` and `eth_blockNumber` checks against `PORTALDOT_EVM_CHAIN_ID` (default `420420777`, the documented testnet ID). An unreachable or wrong network is reported explicitly; the endpoint never submits a transaction or exposes the configured URL. A matching chain ID plus a readable latest block is only a basic RPC smoke test, not proof of canonicality, continued block production, asset interoperability or settlement safety. Check both RPC methods directly when needed:

```bash
curl --connect-timeout 3 --max-time 8 -sS \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  "$PORTALDOT_EVM_RPC_URL"

curl --connect-timeout 3 --max-time 8 -sS \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":2}' \
  "$PORTALDOT_EVM_RPC_URL"
```

For chain ID `420420777`, the `eth_chainId` result should be `0x190f1ca9`; `eth_blockNumber` should return a valid hexadecimal block number. This smoke test does not establish block progression or chain canonicality. If either RPC method fails or the chain ID differs, do not connect a wallet or submit transactions.

## Process lifecycle

The API handles `SIGTERM` and `SIGINT` by closing Fastify cleanly, allowing active requests and server resources to finish closing before the process exits. Deployment process managers should send `SIGTERM` first and allow a reasonable grace period before force-killing the process. The production CI smoke test verifies this shutdown path.

## Quality gate

```bash
pnpm check
pnpm test
pnpm build
```

The committed `pnpm-lock.yaml` is installed with `pnpm install --frozen-lockfile` in CI, followed by workspace type checks, unit tests and the web production build. The API build bundles `apps/api/src/server.ts` and workspace code into `apps/api/dist/server.js` for Node.js 22. Run `pnpm build` before deployment, then start the API from the repository's `apps/api` directory with `pnpm start` (or run the package start command from the deployment process manager). Fastify, its plugins, dotenv and viem remain runtime dependencies, so deploy the API with its production dependency tree. A production deployment smoke test remains a release gate. Check [GitHub Actions](https://github.com/Investorquab/PASTX/actions) for the result tied to the exact commit under review. A green CI run does not prove deployment or live external integration.

## Production deployment remains blocked on

- A deployment target and secure server-side secret configuration.
- A green CI run for the release commit and successful local Windows smoke tests.
- A permitted market-data display license/configuration if live prices are publicly shown.
- A working Portaldot V3 runtime/wallet integration.
- Atomic settlement and failure rollback tests before any trade action is enabled.
- A real testnet deployment and recorded contract/transaction evidence.

Never deploy a UI that suggests live trading while the wallet, chain and settlement path are disabled.
