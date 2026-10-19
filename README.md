# PASTX

**Portaldot Asset & Stock Trading Exchange** — a market-discovery application designed around the Portaldot ecosystem.

> **Status: early engineering foundation.** The Overview features four quick-access stock listings, while the Fastify API supports bounded, provider-backed stock discovery through Twelve Data when a server-side key is configured. Quote/candle display is disabled by default and additionally requires explicit permission configuration. The UI does not invent prices or synthetic chart series when provider data is unavailable. PASTX is not yet a functioning exchange; wallet, verified on-chain asset, order submission, and settlement integrations are not enabled.

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
- `apps/api`: Fastify HTTP API with security headers, rate limiting and stable error responses. The API is bundled to `apps/api/dist/server.js` for Node.js 22; workspace code is bundled while Fastify and selected runtime dependencies remain external.
- `packages/shared`: domain types and supported instrument catalogue.
- `packages/market-data`: Twelve Data adapter; provider credentials remain server-side.
- `packages/chain-adapter`: read-only Portaldot EVM RPC chain-and-latest-block probe; no transaction writes.
- `docs/`: architecture, API, settlement, security, tests and deployment notes.

See [Architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [Settlement Design](docs/SETTLEMENT-DESIGN.md), [Hackathon Requirements](docs/HACKATHON-REQUIREMENTS.md), [Project Status](docs/PROJECT-STATUS.md), the [Human Validation Checklist](docs/HUMAN-VALIDATION-CHECKLIST.md), and the [Cross-Chain Prototype Guide](contracts/cross-chain/README.md).

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
curl "http://localhost:4000/api/markets/search?q=Microsoft&limit=15"
curl http://localhost:4000/api/markets/AAPL
curl http://localhost:4000/api/markets/AAPL/quote
curl "http://localhost:4000/api/markets/AAPL/candles?interval=1day&outputsize=30"
```

The quote and candles routes require a valid provider key and provider access for the requested symbols. Current Twelve Data Basic terms describe free access as internal/non-display; verify licensing before exposing live data in a public client-facing app. See [Twelve Data business pricing](https://twelvedata.com/pricing-business).

## Cross-chain prototype checks

The isolated cross-chain package contains test-only PortalDOT V3 and BNB testnet contracts, a trusted relayer, local contract tests, and separate EVM/PVM compile targets. It has not been deployed. Do not enable trades in the main application based on these local tests.

From `contracts/cross-chain`:

```bash
npm install
npm run check
npm test
npm run compile:bnb
npm run compile:portal
```

See the [prototype guide](contracts/cross-chain/README.md) for the deployment safety gates, dry-run relay and evidence checklist. Local EVM tests and PVM compilation are not proof of a live PortalDOT transaction.

## Quality checks

```bash
pnpm check
pnpm test
pnpm build
```

CI status: [GitHub Actions](https://github.com/Investorquab/PASTX/actions).

## Portaldot integration and release gates

The repository deliberately does not enable wallet connection or trade submission yet. The Portaldot V3 testnet/runtime, supported wallet path, asset/payment interoperability, and atomic settlement must be verified before implementation is represented as complete. See [Settlement Design](docs/SETTLEMENT-DESIGN.md) and [Security](docs/SECURITY.md).

## Cross-chain feasibility and implementation plan

### Decision

PASTX remains the product: a tokenized-stock/RWA access dApp. Cross-chain infrastructure is a core technical capability that would allow a PortalDOT user to access a supported stock-linked market on another chain. The current evidence supports a **testnet proof of concept**, not a claim that the complete production route already exists.

As of 19 October 2026, PortalDOT's public site advertises iBridge for cross-chain transfers and iSwap for spot trading, liquidity pools, and RWA markets:
- [PortalDOT products and infrastructure](https://portaldot.world/)
- [PortalDOT Cross-chain Layer](https://portaldot.world/protocol/modules/cross-chain)
- [PortalDOT developer documentation](https://portaldot-dev.readthedocs.io/en/latest/)

The public pages describe intended capabilities, but the documentation reviewed does not establish a usable PortalDOT V3 testnet-to-BNB testnet iBridge route for tPOTv3, the supported token mapping, bridge contract addresses, or an integration API for iBridge/iSwap. Website claims must therefore not be treated as proof that this exact route is live.

### Proposed testnet proof of concept

The proposed demonstration uses PortalDOT V3 testnet as the source and BNB Smart Chain testnet as the destination:

1. **Source deposit:** the user initiates a tPOT testnet deposit through a supported PortalDOT V3 contract or native transaction path. The precise path is a release gate: PASTX's existing chain adapter is read-only, and it has not yet established that tPOT can be locked or represented through the chosen contract interface.
2. **Finality-aware relay:** a testnet relayer observes and verifies the source transaction, waits for the configured confirmation/finality condition, and records a unique message ID. Duplicate deposits and replayed messages must be rejected.
3. **Destination representation:** an allow-listed BNB testnet contract issues a clearly labelled PASTX test representation only after an authorized relayer submits a verified message. This is a test bridge model, not a claim that native tPOT has been converted into native tBNB.
4. **Test market:** the user spends the test representation to buy and sell explicitly labelled mock stock tokens, such as AAPL-TEST or TSLA-TEST, through a test market contract. These tokens do not represent real shares or live stock-market liquidity.
5. **Reverse flow:** after a mock stock sale, the user can burn the destination test representation and request release of the corresponding locked test asset through the source-side process. Both chain transaction hashes and the order/relay status should be shown in the UI.
6. **Failure handling:** the demo should show pending, completed, failed, and retried states, with source and destination transaction links where available. The same source message must never mint twice.

This model is technically plausible as a **controlled, trusted-relayer testnet prototype**, subject to verifying the PortalDOT V3 source asset/contract model and deploying contracts on both networks. A single relayer is a trust assumption; it is not a production-secure decentralized bridge. The prototype must not accept valuable mainnet assets.

### What testnet can and cannot prove

- BNB Chain documents a [BSC testnet faucet](https://www.bnbchain.org/en/testnet-faucet) and [testnet RPC endpoints](https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/). Test BNB is for gas and has no financial value.
- The public [bStocks documentation](https://docs.bstocker.finance/docs/introduction) and [BNB Chain overview](https://www.bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody) describe stock-linked tokens on BNB Smart Chain. No official bStocks BSC-testnet contract and test liquidity were identified in the public sources reviewed for this plan. Until a supported test market is identified, use mock stock tokens and a test market contract.
- Existing PASTX V3 evidence records only generic test assets (TST and TEST), not tokenized equities. Stock quotes from external data APIs remain reference prices and do not establish an executable token market.

A successful two-testnet demo would demonstrate source-event verification, cross-chain message handling, destination-side execution, duplicate protection, and a mock buy/sell lifecycle. It would **not** prove a permissionless/production bridge, a real POT-to-BNB conversion rate, official stock-token liquidity on testnet, or real stock ownership.

### Intended production route and unresolved dependencies

The target mainnet journey is: PortalDOT POT deposit → a supported and security-reviewed bridge route to BNB Smart Chain → a supported swap/liquidity route into the asset accepted by the stock market (for example, a supported stablecoin) → purchase/sale of an eligible existing tokenized-stock asset → optional conversion and bridge back to PortalDOT.

This is a target architecture, not a verified live route. Before enabling real trading, the following must be confirmed:

- PortalDOT confirms a supported V3-to-BNB route, including source/destination networks, tPOT/POT asset identity, and current iBridge integration instructions or deployed addresses.
- A supported swap route and sufficient destination liquidity exist; bridging an asset does not itself convert it into BNB or USDT.
- The target stock-linked tokens and market contracts are live on the destination network, accessible to the intended users, and compatible with the integration. Tokenized-stock eligibility and legal terms must be respected; for example, bStocks describe an interest in underlying securities, not direct ownership of the listed company's shares.
- Production bridge verification, finality handling, replay protection, rate limits, monitoring, pause/recovery, reconciliation, and independent security review are completed before any valuable assets are accepted.
- Wallet signing and resulting chain state are independently verified. A submitted transaction or UI success message alone is not proof of completed settlement.

If PortalDOT iBridge/iSwap becomes available with a documented route and supported liquidity, PASTX can add an adapter for that infrastructure. The current public information does not justify promising that switching the route alone will make mainnet trading work.

### Hackathon positioning and evidence

- **Product:** Ecosystem DApp / RWA-tokenization user experience.
- **Technical contribution:** Multi-Chain & Cross-Chain Infrastructure used to support that product. Whether the project may compete for more than one track award must be confirmed with the organizers.
- **V3 requirement:** deploy and verify the PortalDOT-side core flow on V3 testnet; preserve the contract address, transaction hash, and explorer link when available.
- **Demo integrity:** show the real PortalDOT testnet interaction and clearly label any BNB-side mock market, test representations, trusted relayer, and simulated production route. Never describe a mock stock or simulated bridge as an official live stock market.
- **Public submission:** the hackathon listing requires a publicly accessible GitHub repository and reproducible deployment/demo instructions for submission. The repository's current visibility is private; visibility must be handled separately and only with the owner's authorization.

Primary event requirements: [PortalDOT Hacker House 2026 on DoraHacks](https://dorahacks.io/hackathon/portaldot-hacker-house-2026).

---

## Hackathon fit

PASTX is primarily an **Ecosystem DApp**: a consumer-facing market/asset application. The API and provider-normalization layer also contributes to **Modular Cloud & Middleware**. The final submission must demonstrate actual Portaldot V3 usage, deployment evidence, and at least one verifiable core flow; a UI-only preview is not sufficient.

## License

No license has been declared yet. Confirm project licensing before accepting external contributions or redistributing code.
