# PASTX Project Status and Handoff

**Last updated:** 15 October 2026  
**Repository:** https://github.com/Investorquab/PASTX  
**Default branch:** `main`  
**Project name:** PASTX — Portaldot Asset & Stock Trading Exchange

## Product objective

Build a market-terminal and asset exchange application for Portaldot V3. The intended product includes market discovery, charting, wallet connection, portfolio, order intent, transaction activity and a safe buy/sell flow. External stock prices are reference data only; the app must not claim actual equity ownership or token backing without evidence.

Primary hackathon track: **Ecosystem DApps**. Secondary infrastructure contribution: **Modular Cloud & Middleware**. See [Hackathon Requirements](HACKATHON-REQUIREMENTS.md).

## Stack decisions

- Node.js 22+, pnpm 10.15.0 workspace.
- Frontend: React 19, TypeScript, Vite, Lucide icons.
- API: Fastify 5, TypeScript, Helmet and rate limiting.
- Shared domain contracts: `packages/shared`.
- Market provider boundary: `packages/market-data`, Twelve Data adapter.
- Tests: Vitest.
- CI: GitHub Actions typecheck, tests and build across workspace.
- Wallet signing, balance reads, transaction submission and settlement adapter: deliberately not implemented until actual Portaldot V3 runtime/wallet support is verified. The read-only EVM chain-ID probe exists separately.
- PostgreSQL, Redis, public SDK and contracts: deferred until a real requirement and validated architecture justify them.

## Current implementation

- Initial dark market-terminal UI, currently using explicitly labelled sample/fixture prices and illustrative chart.
- Functional watchlist search.
- Interactive non-executable order preview with buy/sell side, quantity validation and estimated reference notional; submission is disabled and no order/transaction is created.
- Web app calls the API's read-only `/api/chain/status` endpoint and displays RPC identity status; Vite proxies `/api` to the local Fastify API during development.
- Web app requests live quotes/candles only when API health confirms both a provider key and the explicit display flag are enabled; otherwise it stays on labelled fixture values. Provider quote timestamps are displayed.
- Shared instrument catalogue: AAPL, NVDA, TSLA, MSFT all marked `reference`.
- Fastify API source: health, market list, instrument details, quote and candles endpoints.
- Twelve Data adapter: server-side key, eight-second timeout, response validation, normalized timestamps and OHLCV, provider errors mapped to stable codes, bounded 15-second quote/60-second candle in-memory cache. Public quote/candle routes are disabled by default behind `MARKET_DATA_DISPLAY_ENABLED` until provider display rights are confirmed.
- Read-only Portaldot EVM chain adapter: probes configured RPC chain ID against expected ID `420420777`; reports not configured/unreachable/wrong network/verified without exposing RPC URL. This does not establish settlement compatibility.
- API security headers and global rate limit.
- Unit tests for shared contracts, quote validation, provider behavior and API routes.
- Docs: README, API, architecture, settlement design, security, testing, deployment and this handoff.
- No real trades, wallet signing, on-chain balances, order book or Portaldot transaction have been implemented.

## CI / verification policy

Always check the latest [GitHub Actions run](https://github.com/Investorquab/PASTX/actions). The initial web-only build passed before the API workspace was introduced. Workspace-wide CI must finish green before claiming the new API/provider implementation passes. Do not infer green from a queued/in-progress run.

## Environment / human-only gates

- No provider key is present in the repository. Use `.env.example` and a local untracked `.env`; do not commit secrets.
- Confirm Twelve Data plan terms before using live data in a publicly accessible, client-facing application. Basic/free plan terms list internal non-display usage; public display may require an appropriate commercial plan.
- Portaldot V3 testnet/RPC/runtime/wallet compatibility and asset/payment interoperability have not been proven by this repository work. The new chain probe is only an identity/reachability check.
- No chain transaction or deployment evidence exists yet.
- Do not enable real buy/sell before atomic settlement and rollback are proven.
- Local smoke testing on Windows is still required after CI: install dependencies, run check/test/build, start web and API, and test health/catalogue/error behavior. Live provider test requires a user-supplied key set locally, not in chat or Git.

## Next engineering priorities

1. Fix any workspace CI errors until check, tests and build are green.
2. Ensure reproducible dependency installation and commit a generated lockfile if tooling permits.
3. Finish API client integration only after the UI can clearly distinguish provider data from fixtures and a permitted key/config is available.
4. Inspect actual Portaldot V3 testnet guide/runtime and establish a verifiable RPC/wallet read path.
5. Choose and test one settlement path with all-or-nothing semantics.
6. Implement wallet/portfolio/orders/transaction views against verified chain data.
7. Prepare deployment, demo, pitch deck and evidence before the check-in/final deadlines.

## Documents policy

Update `docs/API.md` whenever routes or schemas change, `docs/ARCHITECTURE.md` whenever boundaries or dependencies change, `docs/TESTING.md` whenever test coverage changes, and `docs/PROJECT-STATUS.md` at meaningful implementation milestones. At release, consolidate temporary planning notes only after preserving requirements, security decisions and evidence.
