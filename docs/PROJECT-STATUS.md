# PASTX Project Status and Handoff

**Last updated:** 16 October 2026  
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
- CI workflow was updated in commit `5f0cde1` to install with `pnpm install --frozen-lockfile`, so CI will fail rather than silently rewrite an out-of-sync lockfile. The subsequent project-status documentation update records this change. The lockfile/frozen-install workflow passed, and the capability-contract engineering CI run [#144](https://github.com/Investorquab/PASTX/actions/runs/38690844224) passed workspace type checks, unit tests and builds after the API capability-discovery change.

- Initial dark market-terminal UI, currently using explicitly labelled sample/fixture prices and illustrative chart.
- Functional watchlist search.
- Interactive non-executable order preview with buy/sell side, quantity validation and estimated reference notional; arithmetic is centralized in `packages/shared`, submission is disabled and no order/transaction is created.
- Web app calls the API's read-only `/api/chain/status` endpoint and displays RPC identity status; Vite proxies `/api` to the local Fastify API during development.
- Web app requests live quotes/candles only when API health confirms both a provider key and the explicit display flag are enabled; otherwise it stays on labelled fixture values. Provider quote timestamps are displayed. The frontend now tolerates per-symbol quote failures independently, allows candle loading to fail separately, and labels each fixture-backed row and chart source rather than treating the entire market panel as all-live or all-sample. The header calls successful responses a provider-data snapshot, not live streaming; automatic polling/refresh is not implemented.
- Shared instrument catalogue: AAPL, NVDA, TSLA, MSFT all marked `reference`.
- Fastify API source: health, machine-readable capability discovery, market list, instrument details, quote and candles endpoints. The capability document separates implemented features from currently enabled features and explicitly reports wallet, balance, order-submission, transaction-history and atomic-settlement support as unavailable.
- Twelve Data adapter: server-side key, eight-second timeout, response validation, normalized timestamps and OHLCV, provider errors mapped to stable codes, bounded 15-second quote/60-second candle in-memory cache. Public quote/candle routes are disabled by default behind `MARKET_DATA_DISPLAY_ENABLED` until provider display rights are confirmed.
- Read-only Portaldot EVM chain adapter: probes configured RPC chain ID against expected ID `420420777`; reports not configured/unreachable/wrong network/verified and emits `verificationScope: "chain_id_only"`. The published [Portaldot V3 testnet guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide) documents EVM RPC `https://testnetv3-eth-rpc.feso-apps.xyz`, Solidity execution through `revive`, and H160-to-SS58 mapping through `reviveApi.accountId`. PASTX has not yet verified live RPC reachability, block reads, wallet mapping, balances or transactions. Native Assets and Solidity contract assets are distinct until an explicit supported interoperability path is proven.
- API security headers and global rate limit; rate-limit failures now share the normalized API error envelope and include a request ID when available. Automated API coverage includes capability-contract boundaries and security-header assertions.
- Unit tests for shared contracts, quote validation, provider behavior and API routes.
- Latest provider-hardening audit: the Twelve Data adapter now rejects a quote if the response symbol does not exactly match the requested instrument's provider symbol or if the returned currency differs from the catalogue currency. Regression tests cover both mismatches; latest CI status is tracked in the GitHub Actions link below.
- Docs: README, API, architecture, settlement design, security, testing, deployment and this handoff.
- No real trades, wallet signing, on-chain balances, order book or Portaldot transaction have been implemented.

## CI / verification policy

Always check the latest [GitHub Actions run](https://github.com/Investorquab/PASTX/actions). Workspace CI must finish green before claiming the latest API/provider implementation or frozen-lockfile workflow passes. Do not infer green from a queued/in-progress run. The frozen-lockfile change was committed after the lockfile was added, so its first CI run is the important reproducibility check. The capability-discovery API, its tests, and the associated API/architecture documentation passed CI run #144.

## Environment / human-only gates

- No provider key is present in the repository. Use `.env.example` and a local untracked `.env`; do not commit secrets.
- Confirm Twelve Data plan terms before using live data in a publicly accessible, client-facing application. Basic/free plan terms list internal non-display usage; public display may require an appropriate commercial plan.
- Portaldot V3 testnet/RPC/runtime/wallet compatibility and asset/payment interoperability have not been proven by this repository work. The chain probe is only an identity/reachability check.
- No chain transaction or deployment evidence exists yet.
- Do not enable real buy/sell before atomic settlement and rollback are proven.
- Local smoke testing on Windows has passed for install, check, tests, build, combined development startup and API health. A fresh clean install with the committed lockfile should still be verified with `pnpm install --frozen-lockfile`. Live provider test requires a user-supplied key set locally, not in chat or Git.

## External dependency status

- Portaldot's official X announcement states that **Portaldot Mainnet V3.0 launches on 16 October 2026**. This is an announcement, not proof that the network is already live or that any previously published endpoint is correct for the new mainnet. Keep current chain integration read-only and disabled for writes until official V3.0 endpoint/runtime details are verified.
- Portaldot V3 testnet RPC investigation is parked for now, per the engineering priority decision. On 15 October 2026, both documented hostnames (`testnetv3-eth-rpc.feso-apps.xyz` and `testnetv3-node.feso-apps.xyz`) returned DNS name does not exist through both Cloudflare DNS (1.1.1.1) and Google DNS (8.8.8.8). This blocks live-chain verification but does not block local/API/domain engineering. Do not repeatedly retry these endpoints as a substitute for continuing the project.
- No live block, wallet mapping, balance, transaction or settlement evidence has been established. Keep all on-chain and trading capabilities disabled until the external endpoint/runtime is available and validated.

## Next engineering priorities

1. Continue API/domain engineering and automated coverage without depending on live RPC availability.
2. Complete API capability discovery, security/error contract coverage, market-data normalization edge cases, and deterministic order-intent domain foundations while preserving the non-executable trading boundary.
3. Keep API, architecture, testing and project-status docs aligned with implementation and CI results.
4. When a valid Portaldot endpoint becomes available, resume read-only runtime verification (block number, H160-to-SS58 mapping and balance access); do not treat chain-ID matching alone as integration proof.
5. Choose and test a settlement path with all-or-nothing semantics only after runtime and asset interoperability are established.
6. Prepare deployment, demo, pitch deck and evidence before the check-in/final deadlines.

## Documents policy

Update `docs/API.md` whenever routes or schemas change, `docs/ARCHITECTURE.md` whenever boundaries or dependencies change, `docs/TESTING.md` whenever test coverage changes, and `docs/PROJECT-STATUS.md` at meaningful implementation milestones. At release, consolidate temporary planning notes only after preserving requirements, security decisions and evidence.


## Engineering milestone — provider resilience tests

- Added regression coverage that callers cannot mutate cached candle data through returned arrays/objects.
- Added coverage for generic transport failures and timeout/abort normalization, asserting safe messages and stable error codes.
- CI run [#162](https://github.com/Investorquab/PASTX/actions/runs/38691768142) passed workspace checks, tests and build for commit `3c6f4ce` before this new test-only change. The current revision must pass its own CI before being called green.

## Engineering milestone — order intent domain

- Shared deterministic order-preview validation now covers known catalogue symbols, buy/sell side, bounded positive quantity and positive finite reference price.
- Preview output is marked `executable: false`; no order is submitted and no balance or token ownership is implied.
- The web app uses the shared implementation; API, architecture and testing docs were updated.
- RPC remains parked. Check CI before calling the current revision green.


## Engineering audit — candle query validation

- A source audit found that the candle `outputsize` digit-check regex was over-escaped, so ordinary numeric strings could be rejected before range validation.
- Corrected the regex and expanded API regression coverage for non-numeric, fractional, negative, zero, out-of-range and valid numeric values. Invalid requests must be rejected before the provider adapter is called.
- Updated API/testing documentation to match the contract. This correction is not considered verified until the CI run for the resulting `main` revision succeeds.

- Provider payload audit: candle rows now reject a present but non-numeric volume field instead of silently normalizing malformed provider data to `null`; missing or explicitly null volume remains supported. A regression test covers malformed volume values.

- Browser API client audit: chain-status payloads now require positive safe-integer chain IDs and internally consistent state fields (for example, `verified` must match the expected chain ID). Added regression coverage for a contradictory `verified` payload. This is input-contract validation, not proof of a live chain connection.

- Browser market API audit: the client now rejects a quote response whose symbol differs from the requested instrument and validates candle intervals at runtime before sending a request. Regression tests cover both cases. This reduces the risk of displaying a structurally valid but mismatched provider response.

- Chain identity client hardening: the browser client now pins the expected Portaldot V3 EVM chain ID to `420420777` instead of trusting a server-supplied expected ID. A regression test rejects a self-consistent response that attempts to redefine the expected network. A matching ID still verifies identity only, not runtime, wallet, asset or settlement compatibility.


## Engineering audit — frontend candle response identity

- The browser API client now verifies that a candle response identifies the exact normalized symbol and requested interval before accepting the series. Previously, a structurally valid series returned for a different instrument or interval could be displayed under the selected instrument.
- Unsupported symbols are rejected before the request is sent. Regression tests cover mismatched response symbols and intervals.
- Automated CI must pass for the resulting commit before this change is considered verified. This remains reference data only; it does not enable trading or prove on-chain market integration.

- CI follow-up: the first run for the candle identity guard exposed an existing test fixture that omitted the API's required `symbol` and `interval` response fields. Updated the fixture to reflect the documented API contract; no production validation was weakened. Re-run CI before treating this batch as verified.
