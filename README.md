# PASTX

**Portaldot Asset & Stock Trading Exchange** — a market-discovery and trading application designed around the Portaldot ecosystem.

> **Status: early engineering foundation.** PASTX is not yet a functioning exchange. Market, wallet, and settlement integrations must be verified before they are represented as operational.

## Product direction

PASTX aims to provide:
- A searchable market catalogue and asset detail pages.
- Interactive historical price charts and clearly sourced reference quotes.
- Wallet connection and verified on-chain asset/balance reads.
- Buy/sell workflows with explicit review, signing, pending, success, and failure states.
- Portfolio, order history, and verifiable transaction receipts.
- A reusable TypeScript SDK after the core interfaces and transaction path are proven.

Google sign-in, a custom matching engine, and cross-chain settlement are not part of the initial MVP.

## Truth in market data

A stock-market reference quote is not an executable on-chain price. A catalogue entry must be classified as one of:
1. **Reference instrument** — external price data only; not tradable through PASTX.
2. **Simulated instrument** — test/demo behavior, clearly labelled as simulated.
3. **On-chain asset** — a specific, verified asset on a supported network, with its actual transfer and settlement behavior documented.

A token must not be described as legal ownership of company shares unless its rights, backing, and applicable legal arrangements support that claim.

## Proposed stack

- React + TypeScript + Vite
- Tailwind CSS and shadcn/ui
- TradingView Lightweight Charts for rendering
- TanStack Query for server-state management
- Fastify + TypeScript for the server API
- PostgreSQL only when durable application/indexing data is needed
- pnpm workspaces
- Vitest and Playwright for tests
- Portaldot chain adapter selected only after runtime compatibility is verified

The chart renderer and market-data provider are separate. Provider selection depends on licensing, quotas, required instruments, and budget.

## Repository layout

```text
apps/web/                 Web application
apps/api/                 Server-side API
packages/shared/          Shared types and validation
packages/chain-adapter/   Portaldot integration boundary
packages/market-data/     Market-data provider abstraction
packages/sdk/             Future public developer SDK
docs/                     Architecture, security, API and test plans
tests/                    Integration and end-to-end tests
```

Folders will be introduced with their package manifests as implementation begins.

## Local development

The workspace and app packages are being established. Until the first runnable app package and lockfile are committed, there is no working app command to run.

Once the scaffold is implemented, the intended workflow is:

```bash
corepack enable
pnpm install
pnpm dev
pnpm check
pnpm test
```

See [Architecture](docs/ARCHITECTURE.md), [Settlement Design](docs/SETTLEMENT-DESIGN.md), [API](docs/API.md), [Security](docs/SECURITY.md), [Testing](docs/TESTING.md), and [Deployment](docs/DEPLOYMENT.md).

## Engineering gates

1. Establish reproducible tooling and a clean baseline.
2. Build the market-terminal shell with labelled fixture data.
3. Validate market-data provider behavior and chart rendering.
4. Verify Portaldot runtime, wallet, asset, and transaction capabilities.
5. Prove settlement atomicity and failure rollback before enabling real trades.
6. Deploy and publish only evidence that has actually been verified.

## Security

Never commit private keys, seed phrases, API credentials, production environment files, or user secrets. Use `.env.example` for variable names and safe placeholders only. Do not let an API server or language model request or handle users' wallet private keys.

## Project status

This repository is a public hackathon project. Design documents describe intended behavior; they do not imply deployed contracts, a live V3 testnet integration, live market data, or successful on-chain trades. See [Settlement Design](docs/SETTLEMENT-DESIGN.md) for unresolved verification gates.
