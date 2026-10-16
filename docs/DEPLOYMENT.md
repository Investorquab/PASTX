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

Set `PORTALDOT_EVM_RPC_URL` to the public RPC endpoint for the intended Portaldot V3 EVM environment. The API route `GET /api/chain/status` performs read-only `eth_chainId` and `eth_blockNumber` checks against `PORTALDOT_EVM_CHAIN_ID` (default `420420777`, the documented testnet ID). An unreachable, malformed, credential-bearing, or wrong-network URL is reported explicitly; only HTTP(S) URLs without embedded credentials are accepted, and the endpoint never submits a transaction or exposes the configured URL. A matching chain ID plus a readable latest block is only a basic RPC smoke test, not proof of canonicality, continued block production, asset interoperability or settlement safety. Check both RPC methods directly when needed:

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

## Verify live RPC block progression

After obtaining the RPC URL from the intended network's authoritative documentation, run this read-only probe from a trusted machine:

```bash
node scripts/check-chain-progress.mjs "https://your-verified-rpc.example" 420420777 5 15000
```

Arguments are RPC URL, expected chain ID, number of samples (2–20), and milliseconds between samples (1,000–300,000). The defaults are chain ID `420420777`, five samples, and 15 seconds between samples. The script calls only `eth_chainId` and `eth_blockNumber`, rejects remote HTTP, credentials, redirects, malformed responses and unexpected chain IDs, and passes only when the observed block height increases. If the network's normal block interval is longer, increase the sampling interval. Do not treat one endpoint's advancing height as proof of canonicality; corroborate it with the network's official explorer or a second trusted endpoint. Never point it at a network unless its identity is independently confirmed.

This script is deliberately not run against a public endpoint in CI: CI must remain deterministic and must not mistake an unverified endpoint for the intended Portaldot network.

## Process lifecycle

The API handles `SIGTERM` and `SIGINT` by closing Fastify cleanly, allowing active requests and server resources to finish closing before the process exits. Deployment process managers should send `SIGTERM` first and allow a reasonable grace period before force-killing the process. The production CI smoke test verifies this shutdown path.

## Quality gate

```bash
pnpm check
pnpm test
pnpm build
```

The committed `pnpm-lock.yaml` is installed with `pnpm install --frozen-lockfile` in CI, followed by the production dependency audit, workspace type checks, unit tests, and builds. CI also starts the bundled API in production mode, checks health/capabilities/chain status and the safe-disabled quote/candle behavior, and verifies graceful shutdown. This is a **bundled-runtime smoke test in CI**, not a deployment smoke test. The API build bundles `apps/api/src/server.ts` and workspace code into `apps/api/dist/server.js` for Node.js 22. Run `pnpm build` before deployment, then start the API from the repository's `apps/api` directory with `pnpm start` (or run the package start command from the deployment process manager). Fastify, its plugins, dotenv and viem remain runtime dependencies, so deploy the API with its production dependency tree. A smoke test against the actual deployment remains a release gate. Check [GitHub Actions](https://github.com/Investorquab/PASTX/actions) for the result tied to the exact commit under review. Green CI does not prove deployment or live external integration.

## Production deployment remains blocked on

- A deployment target and secure server-side secret configuration.
- A green CI run for the release commit and successful local Windows smoke tests.
- A permitted market-data display license/configuration if live prices are publicly shown.
- A working Portaldot V3 runtime/wallet integration.
- Atomic settlement and failure rollback tests before any trade action is enabled.
- A real testnet deployment and recorded contract/transaction evidence.

Never deploy a UI that suggests live trading while the wallet, chain and settlement path are disabled.


## Read-only smoke test for an actual deployment

After deploying the API, run the repository's deployment smoke test against the **API base URL** (not the frontend URL unless the frontend host also proxies all API routes):

```bash
node scripts/smoke-test-deployment.mjs https://your-api.example.com
```

The script uses bounded, read-only GET requests and rejects remote plain-HTTP URLs, redirects, unexpected response shapes, and any capability response that enables wallet connection, order submission, atomic settlement, or trading. It checks the reference catalogue, the chain-probe response contract, and the quote/candle display gate. It accepts the chain probe's explicit non-verified statuses so an unreachable or unconfigured RPC is reported rather than mistaken for a deployment failure; a passed smoke test is **not** evidence that the chain is verified or that trading works. It never sends a transaction and does not print provider credentials.

Run it from a trusted machine and use the exact deployment URL. A successful result establishes only that these public read-only API checks passed at that time. It does not replace TLS/configuration review, provider licensing checks, monitoring, or real chain/asset/settlement verification.
