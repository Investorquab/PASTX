# PASTX Project Status and Handoff

**Last updated:** 17 October 2026  
**Repository:** https://github.com/Investorquab/PASTX  
**Default branch:** `main`

## Product status

PASTX is an early engineering foundation for Portaldot ecosystem market discovery, not a functioning exchange. AAPL, NVDA, TSLA and MSFT are external reference instruments, not tokenized equities or executable on-chain assets. A competitive hackathon submission requires a verifiable Portaldot V3 flow and evidence; a UI preview alone is insufficient.

## Architecture and implemented boundaries

- React 19 + TypeScript + Vite frontend; Fastify 5 API; shared domain contracts; Twelve Data adapter; read-only EVM chain-and-latest-block adapter.
- API uses Helmet, a global 60-requests/minute rate limit, request IDs, normalized error responses, and a machine-readable capability contract.
- Provider keys remain server-side. Quote/candle routes require a nonblank key and explicit `MARKET_DATA_DISPLAY_ENABLED=true`; live display remains disabled until licensing is confirmed.
- Quote/candle payloads are normalized and validated; candle series must match the requested provider symbol, interval and currency, and each candle must satisfy OHLC relationships and bounded input rules. The frontend checks quote symbol/currency and candle symbol/interval and keeps partial failures isolated.
- Order preview is deterministic arithmetic only and always `executable: false`. Wallet connection, balances, order submission, transaction history and atomic settlement are not implemented. Trading remains disabled.
- The official Portaldot Mainnet Substrate WebSocket endpoint was manually checked from a developer machine: it reported `Portaldot Mainnet`, 13 peers, `isSyncing: false`, and both best and finalized block heights advanced by one during a roughly 32-second sample window. This is point-in-time endpoint evidence only. A reproducible read-only checker lives at `scripts/check-substrate-progress.mjs`; it records the Substrate runtime spec name/version, transaction version, and SHA-256 fingerprint of the returned runtime metadata alongside block progression. The manual GitHub Actions workflow `Portaldot Substrate Runtime Evidence` preserves console output and the exact returned metadata bytes (hex-encoded) as a 14-day artifact. The metadata artifact is for offline decoding and review; it is not itself evidence of EVM support or safe asset semantics. Run it manually from Actions when fresh evidence is needed; it does not perform writes. This fingerprint helps detect runtime changes but does not prove EVM RPC support, asset enumeration semantics, wallet mapping, or settlement compatibility. The separate EVM RPC endpoint and chain ID remain unverified. CI includes frozen-lockfile install, production dependency audit, workspace type checks, unit tests, and builds. The API bundles to `apps/api/dist/server.js` for Node.js 22; CI starts that artifact in production mode and smoke-tests health, capability flags, read-only chain status, disabled market-data routes, and graceful shutdown. This verifies the bundled runtime in CI, not a deployed environment. No production deployment or live external integration is established. Check the [GitHub Actions page](https://github.com/Investorquab/PASTX/actions) for results tied to the exact current `main` commit.

## Portaldot V3 testnet evidence

The Portaldot team announced the following V3 testnet endpoints: Substrate WebSocket `wss://test-node-v3.portaldot.dev`, EVM JSON-RPC `https://test-evm-rpc-v3.portaldot.dev`, and EVM chain ID `420420777`. The standalone `scripts/check-portaldot-v3-testnet.mjs` probe verifies the EVM chain ID and block-height progression using read-only JSON-RPC calls. The manual `Portaldot V3 Testnet EVM Evidence` workflow preserves its output as a 14-day artifact. Run the workflow manually to collect fresh evidence.

This is explicitly testnet-scoped. It must not be used to infer or configure mainnet chain identity. Substrate runtime version and metadata should be captured separately from the official testnet WebSocket before making claims about runtime pallets, asset representation, or supported operations. A successful endpoint probe alone does not prove asset interoperability, wallet mapping, trading, or settlement.

## Chain configuration warning

The expected EVM chain ID `420420777` is from a published **Portaldot V3 testnet** guide. It must not be assumed to be the mainnet ID. The read-only chain-and-latest-block probe is configurable through `PORTALDOT_EVM_CHAIN_ID`; the default remains the documented testnet value. Configure another value only after independently verifying the official chain ID for the intended network. A matching chain ID and successful latest-block read do not prove the RPC is canonical, that blocks continue advancing, wallet address mapping works, assets interoperate, or settlement is safe. No live Portaldot transaction or settlement evidence is established.

## Secrets and safe configuration

- `.env.example` contains placeholders; never commit API keys, wallet secrets, or credential-bearing RPC URLs.
- `MARKET_DATA_API_KEY` is server-only.
- `MARKET_DATA_DISPLAY_ENABLED=false` is the safe default pending provider permission.
- `PORTALDOT_EVM_RPC_URL` is optional and read-only.
- `PORTALDOT_EVM_CHAIN_ID` defaults to testnet ID `420420777`; mainnet must be explicitly configured only after official verification.
- Do not claim secret scanning, dependency advisories, production deployment, or external network integration are clean/complete unless results have been observed.

## Human-required release gates

1. Verify Twelve Data licensing before client-facing market-data display.
2. Obtain official Portaldot V3 mainnet RPC, chain ID and runtime documentation if targeting mainnet.
3. Configure deployment secrets through the platform secret manager.
4. Demonstrate wallet connection, account mapping, supported asset representation and read-only balance access on the target network.
5. Prove receipt/event and resulting-state checks plus all-or-nothing settlement and rollback before enabling real trades.
6. Run a smoke test against the actual deployed environment and preserve reproducible demo evidence; the CI bundled-runtime smoke test is not a substitute.
7. Declare a suitable repository license before inviting contributions or redistributing.

## Handoff rule

Continue security, API, frontend, documentation and release-readiness work as a consolidated engineering pass, not a sequence of tiny feature/CI batches. Push one coherent revision once the changes are ready, then verify CI on that exact commit. Do not report green before that run passes.
