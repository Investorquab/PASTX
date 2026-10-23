# PASTX Smart Contracts

Core target: Portaldot V3 testnet. This package also contains the separate experimental Portaldot-to-BNB prototype.

## Language and compiler target

The market contracts use Solidity 0.8.28 and are compiled to standard EVM bytecode with Hardhat and solc for Portaldot V3's documented EVM execution path. Sources are maintained in the root contract library under `contracts/portaldot-v3/evm/` and `contracts/bnb-testnet/evm/`. Each contract has its own named folder. This directory contains build/deploy tooling and tests, not the source-of-truth copies of those Solidity contracts. A standard EVM build or local EVM test is not proof of successful execution on the live Portaldot testnet.

The Portaldot compile command includes a bytecode-target assertion. It fails for empty or malformed bytecode and for the PolkaVM marker (0x50564d00), because this build intentionally targets standard Solidity EVM bytecode, consistent with the deployed code observed at the two PotKit addresses through Portaldot's official EVM RPC.

## Native Substrate routes and the budget distinction

There are **two different native contract architectures** in this repository. Do not interchange their preflight commands or cost estimates.

- **Budget-constrained native demo (default):** `npm run preflight:native:portal` or `npm run preflight:native:ink` reads the compact ink! artifact in `native-ink/`. It is intended to deploy **one contract** combining whole-unit app-only pUSD credits (not an ERC-20), a 1,000 pUSD claim every hour per account up to a 1,000,000 pUSD global cap, four fixed-price synthetic listings, and a paper-share ledger. Fractional pUSD and external token transfers are intentionally omitted on this budget-constrained native route. Buys convert balance into a fixed-price position; sells convert that position back at the same price without minting new pUSD or relying on a shared reserve. It does not deploy a separate token, faucet, or per-stock token contracts, and it does not custody tPOT.
- **Full four-contract Solang route:** `npm run preflight:native:solang-market` builds and preflights `PastxDemoToken`, `PastxMarket`, `PastxFaucet`, and `PastxStockToken`. The observed WASM-size-based code-deposit estimate for the four unique code blobs was **6,539.46 tPOT**, before instance storage, fees, and reserve. This route is not viable with the previously reported 441 tPOT wallet balance.

**Budget and deployment status:** The current successful bundle workflow produced a **4,918-byte** WASM with a static code-deposit estimate of **295.23 tPOT**. This passes the 300 tPOT code-only target, but does not prove the live total storage deposit or affordability. A previous 383.368 tPOT runtime quote came from the prior paper-ledger artifact and is stale. Run a fresh read-only preflight using all three files from the latest successful artifact before estimating affordability. Do not submit deployment until those checks pass, the `5...` signer is confirmed to match SubWallet, and the RPC genesis hash is independently verified against official Portaldot testnet details. The `/native-demo` frontend path speaks the native contracts pallet and requires the confirmed native contract address plus expected genesis hash. The Rust source of that contract is `contracts/portaldot-v3/native-ink/PastxBudgetMarket/lib.rs`.

Use `npm run deploy:native:portal` only for the compact single-contract route, after you have confirmed the native `5...` signer matches SubWallet, verified the genesis hash against official Portaldot V3 testnet details, pinned both values in the local `.env`, and received a passing live preflight. The alternative full Solang deployment remains explicitly named `npm run deploy:native:solang-market`. Neither path should be represented as deployed until its finalized transaction and on-chain contract address are verified.

## iSwap + iBridge judge demonstration

The EVM market route now includes `PastxISwap`: 1,000 faucet pUSD maps to one configured native-value cap, which should be configured to 0.01 tPOT only after the runtime's raw `msg.value` mapping has been independently tested. pUSD redeemed through iSwap is burned; native-to-pUSD swaps deposit native test value into the pool and mint pUSD. Every native payout is limited by the pool's actual balance and the per-swap cap. The pool is deliberately tiny and can be exhausted; it is not a production liquidity pool, price oracle, or fiat redemption.

The source escrow enforces the same raw per-deposit cap. The BNB gateway mints `wtPOTv3` using the source event amount at 14 display decimals; on the return path it burns only bridge-backed amount and the trusted relayer releases the same raw amount from the source escrow. The intended judge path is: claim 1,000 pUSD → iSwap to 0.01 tPOT → iBridge to 0.01 wtPOTv3 on BNB testnet → bridge back to 0.01 tPOT on Portaldot. Gas is paid separately on each network.

**Deployment gate:** keep `PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED=false` until the on-chain probe reports that the requested raw value, `msg.value`, and the probe contract balance match, then confirms the deposited value was returned. Review its deployment, observe, and return receipts. It returns the probe amount, less gas fees, to the deployer; the deployment and interactions still cost gas. Run `npm run probe:native-value:portal` only after confirming the Portaldot EVM signer has enough balance. The safe default `PASTX_VALUE_PROBE_RAW=1` tests one raw unit and returns it. After that passes and Portaldot's official 14-decimal tPOT metadata is confirmed, an optional second run with `PASTX_VALUE_PROBE_RAW=1000000000000` tests the exact 0.01 tPOT raw amount. The probe caps any test value at that raw amount and attempts a refund even after verification errors. Only after inspecting a successful result should the operator manually set `PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED=true`, then configure matching iSwap/bridge caps. The EVM market deploy and both bridge-contract deploy scripts refuse to proceed until the flag, raw values, and a successful persisted live value-probe report for the exact configured cap are present. The existing native ink! route is a separate Substrate execution model; it does not contain the EVM iSwap or cross-chain bridge.

## Seven contracts in the core demo

- PastxDemoToken: capped pUSD, 18 decimals, 1,000,000-token cap.
- PastxMarket: fixed-price market permanently bound to that pUSD token.
- PastxFaucet: 1,000 pUSD per wallet every 3,600 seconds.
- Four PastxStockToken deployments: pAAPL, pNVDA, pTSLA and pMSFT synthetic shares.

All listings use pUSD; native tPOTv3 is needed for gas only. Demo prices are 200, 180, 250 and 400 pUSD. pUSD is valueless test currency, not redeemable. Synthetic shares are not equity. This fixed-price market is not an order book or production brokerage. Sells require sufficient pUSD reserves.

## Install and validate

Requires Node.js 22+. From this folder:

~~~bash
npm install
npm run check
npm test
npm run compile:bnb
npm run compile:portal
~~~

The standard EVM compile step checks that the generated contract artifacts are EVM bytecode. Local EVM tests are also required; neither proves live testnet behavior by itself.

## Preflight and deploy

Confirm the current official Portaldot V3 EVM RPC endpoint and expected chain ID 420420777. The default RPC is https://test-evm-rpc-v3.portaldot.dev. Copy .env.example to .env and configure exactly one funded, testnet-only EVM deployer signer locally.

The deployer may be configured using either:
- PORTALDOT_DEPLOYER_PRIVATE_KEY for a raw EVM private key; or
- PORTALDOT_DEPLOYER_MNEMONIC for the recovery phrase of a SubWallet EVM account.

For mnemonic mode, the tool derives the EVM account at m/44'/60'/0'/0/0, matching SubWallet's documented default EVM path. Before any deployment transaction, the preflight compares the derived address with Hardhat's signer and checks the EVM account's on-chain native tPOTv3 balance. Confirm that the printed/public 0x address matches the EVM account shown by SubWallet. A native Portaldot address beginning with 5 is a different address type and is the one requested for the hackathon's native-token distribution; don't assume it is the same as the EVM deployer.

Never paste your seed phrase or private key into chat, source files, or command arguments. The .env file is gitignored and must remain local. Do not put a recovery phrase in .env.example.

Run the read-only preflight first:

~~~bash
npm run preflight:market:portal
npm run preflight:bnb
~~~

The preflight rejects the wrong Hardhat network name or chain ID, signer mismatch, an unusable RPC, or a deployer EVM account with no native tPOTv3 balance. If it fails, no deployment transaction is sent.

After the Portaldot EVM wallet and relayer accounts are funded, configure the local `.env` from the verified probe result. For the judge’s 0.01 tPOT demo, the configured cap and probe amount must both be `1000000000000` raw units only after the runtime mapping and 14-decimal metadata are confirmed. Then run the combined read-only preflight:

~~~bash
npm run preflight:all:testnet
~~~

If both chains and the evidence are ready, deploy the primary EVM market + iSwap + source escrow + BNB gateway sequentially with one guarded command:

~~~bash
npm run deploy:all:testnet
~~~

The master deployment runner first runs read-only checks on both EVM networks, then requires the interactive phrase `DEPLOY PASTX TESTNET`. It deploys the core market and iSwap, source escrow, and BNB gateway sequentially. The core market setup is 13 separate blockchain transactions, not one atomic transaction. The script records transaction hashes and confirmations as it proceeds, then verifies bytecode, pUSD metadata/cap, faucet roles/settings, four pUSD listings and synthetic-token authorities. It revokes the deployer's direct minter permission after authorizing the faucet.

On a partial failure, inspect deployments/portal-v3-testnet/latest.json before proceeding; do not rerun blindly.

## Generated outputs

The master command writes a unified `latest.json`, `addresses.md`, `portal-escrow.json`, and `bnb-gateway.json` under `contracts/cross-chain/deployments/all-testnet/`. Its `portal-market/` subfolder contains the market-specific manifest, ABIs, and public frontend environment file. The files record each completed deployment transaction; they are not a claim of a completed bridge round trip.

Copy those public addresses to apps/web/.env.local and verify the deployment:

~~~bash
npm run verify:market:portal
~~~

The verifier writes verification.json without submitting transactions. Check all addresses and hashes against the target RPC or an official explorer.

The trusted-relayer Portaldot/BNB prototype remains testnet-only. The combined deployment command does not start the relayer or claim that a round trip has succeeded; judges should run the relayer in dry-run mode, check its configured contract addresses and signer roles, then test each bridge leg. Root contract inventory and file map: `contracts/README.md` and `contracts/manifest.json`. No on-chain light-client proof is verified; never use these contracts with valuable assets.
