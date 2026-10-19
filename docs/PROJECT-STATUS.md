# PASTX Project Status and Handoff

**Last updated:** 19 October 2026  
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
- The official Portaldot Mainnet Substrate WebSocket endpoint was manually checked from a developer machine: it reported `Portaldot Mainnet`, 13 peers, `isSyncing: false`, and both best and finalized block heights advanced by one during a roughly 32-second sample window. This is point-in-time endpoint evidence only. A reproducible read-only checker lives at `scripts/check-substrate-progress.mjs`; it records the Substrate runtime spec name/version, transaction version, and SHA-256 fingerprint of the returned runtime metadata alongside block progression. The manual GitHub Actions workflow `Portaldot Substrate Runtime Evidence` preserves console output and the exact returned metadata bytes (hex-encoded) as a 14-day artifact. The metadata artifact is for offline decoding and review; it is not itself evidence of EVM support or safe asset semantics. Run it manually from Actions when fresh evidence is needed; it does not perform writes. This fingerprint helps detect runtime changes but does not prove EVM RPC support, asset enumeration semantics, wallet mapping, or settlement compatibility. The separate mainnet EVM RPC endpoint and chain ID remain unverified. CI includes frozen-lockfile install, production dependency audit, workspace type checks, unit tests, and builds. The API bundles to `apps/api/dist/server.js` for Node.js 22; CI starts that artifact in production mode and smoke-tests health, capability flags, read-only chain status, disabled market-data routes, and graceful shutdown. This verifies the bundled runtime in CI, not a deployed environment. No production deployment or live external integration is established. Check the [GitHub Actions page](https://github.com/Investorquab/PASTX/actions) for results tied to the exact current `main` commit.

## Portaldot V3 testnet evidence

The announced V3 testnet endpoints are Substrate WebSocket `wss://test-node-v3.portaldot.dev`, EVM JSON-RPC `https://test-evm-rpc-v3.portaldot.dev`, and EVM chain ID `420420777`. These are testnet-only configuration facts and must not be used to infer mainnet identity. The read-only EVM probe observed chain ID `420420777` and block progression from `68453` to `68455` across three samples ([run](https://github.com/Investorquab/PASTX/actions/runs/38996055820)). A Substrate runtime probe reported `PortaldotV3 Test`, node version `3.0.0-dev-fddd43141f2`, spec `portaldot-v3` version `3002`, transaction version `2`, one peer, `isSyncing: false`, and progressing best/finalized heads ([run](https://github.com/Investorquab/PASTX/actions/runs/38996055799)).

### Successful bounded asset/precompile snapshot — 17 October 2026

The automatic [Portaldot V3 Testnet Asset State Evidence run](https://github.com/Investorquab/PASTX/actions/runs/39061172178) passed against commit `f23a336b8b79cc853e85a8585836dd2af671288b`. Its evidence artifact is available for 14 days at [artifact 12111426560](https://github.com/Investorquab/PASTX/actions/runs/39061172178/artifacts/12111426560).

The read-only snapshot was taken at finalized block `78248`, hash `0x2e5b0dd5db35dd6f8156a392f21c9bbf83a413c1559565ebe077b8a5a3341dca`. Node-reported chain was `PortaldotV3 Test`; runtime was `portaldot-v3` spec version `3002`, transaction version `2`. Raw/API metadata bytes matched at 561,916 bytes with raw SHA-256 `08448367f7ca945170dcadfa416894e199fd11df43fe4811b723c0aada193857`; two further sessions returned the same bytes. The audited normalized metadata SHA-256 was `fec08cb5d8b6edc591fb7ee1d3c2af369185befb3c0d13bde6c5d23e020e3bf1` (details below).

Observed public storage values:

- `Assets.Asset` contained two entries. Asset ID `1` had metadata name `example asset for testnet`, symbol `TST`, decimals `18`, and raw supply `0`. Asset ID `2` had metadata name `test asset`, symbol `TEST`, decimals `18`, and raw supply `15,000,000,000,000,000,000`.
- `PoolAssets.Asset`, `PoolAssets.Metadata`, and `AssetConversion.Pools` returned no entries. The two `NextAssetId` storage reads returned no value in this snapshot.
- `AssetsPrecompiles.AssetIndexToForeignAssetId` mapped index `0 -> 1` and `1 -> 2`; `ForeignAssetIdToAssetIndex` returned the inverse mappings `1 -> 0` and `2 -> 1`.

Each storage map query was capped at 25 entries and used the same finalized snapshot. The workflow did not read per-account balances, access a wallet, sign, submit an extrinsic, or write storage. The sample contains only generic test assets (`TST` and `TEST`); it did **not** establish that AAPL, NVDA, TSLA, MSFT, or any other listed equity is tokenized on Portaldot. The UI catalogue’s stock symbols remain external reference instruments. This testnet evidence does not prove mainnet identity, asset backing/ownership rights, address mapping, executable prices, trading or settlement safety.

### Metadata fingerprint gate

Across six archived metadata captures, the metadata is 561,916 bytes and all bytes match except offsets `549822` and `549823`. Those adjacent bytes map to indices `34` and `35` of `Revive.EthBlockBuilderIR`’s storage-entry fallback/default-value bytes, outside the selected `Assets`, `PoolAssets`, `AssetConversion`, and `AssetsPrecompiles` storage descriptions. Observed byte pairs were `(0x97, 0xa4)`, `(0x5b, 0xa4)`, `(0x56, 0xa4)`, `(0x51, 0xa4)`, `(0xa0, 0xa0)`, and `(0x9b, 0xa0)`. Zeroing only those two offsets yields normalized SHA-256 `fec08cb5d8b6edc591fb7ee1d3c2af369185befb3c0d13bde6c5d23e020e3bf1` across all six captures.

The checker still validates chain label, runtime versions, fixed metadata length, same-connection raw/API equality, three identical reads at one finalized block, and the structural location of both bytes. The normalized hash pins every other metadata byte; any additional change or moved field fails closed. The original raw fingerprint remains in the workflow artifact. The `Revive.EthBlockBuilderIR` entry itself is not queried.

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


## Cross-chain prototype status — 19 October 2026

The current feature branch now carries a separate `contracts/cross-chain` prototype for a PortalDOT V3 source escrow, BNB testnet gateway with `wtPOTv3` test representation and mock stock market, local unit tests, trusted relayer, testnet deployment scripts, and EVM/PVM compile workflow.

**No contracts have been deployed and no cross-chain relay has executed.** The existing main web application remains read-only for chain activity and does not submit trades. The prototype has an explicit single-relayer trust assumption, process-memory scan cursors, mock owner-controlled prices, simulated liquidity, and an unresolved native tPOTv3 EVM amount/decimal validation gate. Do not use valuable funds.

The official PortalDOT V3-to-BNB iBridge route for tPOTv3 and an official bStocks BNB-testnet market remain unverified in the public material reviewed. The prototype therefore models source-event relay and destination mint using a test representation; it does not prove official bridge support or real stock execution. Deployment requires manual operator validation and explicit testnet-only keys/addresses in the package's untracked `.env`.

Before claiming progress, record the exact branch commit, local test/check/compile results and, only after actual testnet interactions, both chains' deployment/transaction evidence. A green local or CI compile/test is not live-network evidence.
