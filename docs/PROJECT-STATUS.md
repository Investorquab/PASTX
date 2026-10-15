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
- CI: GitHub Actions typecheck, tests and build across workspace; dependency installation now uses `pnpm install --frozen-lockfile`.
- `pnpm-lock.yaml` is committed to pin the resolved workspace dependency graph and integrity metadata.
- Wallet signing, balance reads, transaction submission and settlement adapter: deliberately not implemented until actual Portaldot V3 runtime/wallet support is verified. The read-only EVM chain-ID probe exists separately.
- PostgreSQL, Redis, public SDK and contracts: deferred until a real requirement and validated architecture justify them.

## Current implementation

- Local Windows smoke test on 15 October 2026: user cloned the repository, installed dependencies, and ran `pnpm check`, `pnpm test` (40 tests passed), and `pnpm build` successfully. The web preview rendered and the API started on port 4000; `/api/health` and `/api/chain/status` returned HTTP 200 in API logs. A manual request to `/health` returned 404 because the correct health route is `/api/health`.
- Root `pnpm dev` was fixed to `pnpm --parallel --recursive --if-present dev`; the user subsequently confirmed that both the web and API processes started together and the API health route returned 200.
- On 15 October 2026, the user generated `pnpm-lock.yaml` with pnpm 10.15.0 and pushed commit `559be0b` to `main`.
- CI workflow was updated in commit `5f0cde1` to install with `pnpm install --frozen-lockfile`, so CI will fail rather than silently rewrite an out-of-sync lockfile. The subsequent project-status documentation update records this change. The latest run for the status-documentation commit is green: [GitHub Actions run 38687568448](https://github.com/Investorquab/PASTX/actions/runs/38687568448). The immediately preceding frozen-lockfile run was cancelled by the newer push, not failed; the green latest run executes the current workflow with the committed lockfile.

- Initial dark market-terminal UI, currently using explicitly labelled sample/fixture prices and illustrative chart.
- Functional watchlist search.
- Interactive non-executable order preview with buy/sell side, quantity validation and estimated reference notional; submission is disabled and no order/transaction is created.
- Web app calls the API's read-only `/api/chain/status` endpoint and displays RPC identity status; Vite proxies `/api` to the local Fastify API during development.
- Web app requests live quotes/candles only when API health confirms both a provider key and the explicit display flag are enabled; otherwise it stays on labelled fixture values. Provider quote timestamps are displayed.
- Shared instrument catalogue: AAPL, NVDA, TSLA, MSFT all marked `reference`.
- Fastify API source: health, market list, instrument details, quote and candles endpoints.
- Twelve Data adapter: server-side key, eight-second timeout, response validation, normalized timestamps and OHLCV, provider errors mapped to stable codes, bounded 15-second quote/60-second candle in-memory cache. Public quote/candle routes are disabled by default behind `MARKET_DATA_DISPLAY_ENABLED` until provider display rights are confirmed.
- Read-only Portaldot EVM chain adapter: probes configured RPC chain ID against expected ID `420420777`; reports not configured/unreachable/wrong network/verified and emits `verificationScope: "chain_id_only"`. This does not establish canonical network identity, wallet compatibility, runtime behavior or settlement compatibility.
- API security headers and global rate limit; rate-limit failures now share the normalized API error envelope and include a request ID when available.
- Unit tests for shared contracts, quote validation, provider behavior and API routes.
- Docs: README, API, architecture, settlement design, security, testing, deployment and this handoff.
- No real trades, wallet signing, on-chain balances, order book or Portaldot transaction have been implemented.

## CI / verification policy

Always check the latest [GitHub Actions run](https://github.com/Investorquab/PASTX/actions). Workspace CI must finish green before claiming the latest API/provider implementation or frozen-lockfile workflow passes. Do not infer green from a queued/in-progress run. The frozen-lockfile change was committed after the lockfile was added, so its first CI run is the important reproducibility check.

## Environment / human-only gates

- No provider key is present in the repository. Use `.env.example` and a local untracked `.env`; do not commit secrets.
- Confirm Twelve Data plan terms before using live data in a publicly accessible, client-facing application. Basic/free plan terms list internal non-display usage; public display may require an appropriate commercial plan.
- Portaldot V3 testnet/RPC/runtime/wallet compatibility and asset/payment interoperability have not been proven by this repository work. The chain probe is only an identity/reachability check.
- No chain transaction or deployment evidence exists yet.
- Do not enable real buy/sell before atomic settlement and rollback are proven.
- Local smoke testing on Windows has passed for install, check, tests, build, combined development startup and API health. A fresh clean install with the committed lockfile should still be verified with `pnpm install --frozen-lockfile`. Live provider test requires a user-supplied key set locally, not in chat or Git.

## Next engineering priorities

1. Validate the latest chain-status scope change through CI; preserve the explicit boundary between chain-ID matching and actual runtime compatibility.
2. Inspect the actual Portaldot V3 guide/runtime and establish a verifiable RPC/wallet read path without assuming chain-ID compatibility proves EVM behavior.
3. Continue the API/security audit with focused automated tests for security headers, request IDs and provider failure paths; rate-limit response normalization and its 429 test are implemented.
4. Choose and test one settlement path with all-or-nothing semantics only after runtime and asset interoperability are established.
5. Implement wallet/portfolio/orders/transaction views against verified chain data only after the chain gates pass.
6. Prepare deployment, demo, pitch deck and evidence before the check-in/final deadlines.

## Documents policy

Update `docs/API.md` whenever routes or schemas change, `docs/ARCHITECTURE.md` whenever boundaries or dependencies change, `docs/TESTING.md` whenever test coverage changes, and `docs/PROJECT-STATUS.md` at meaningful implementation milestones. At release, consolidate temporary planning notes only after preserving requirements, security decisions and evidence.
