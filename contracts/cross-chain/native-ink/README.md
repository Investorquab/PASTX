# Compact native PASTX demo market (ink! v5)

This directory contains a size-optimized, single-contract native Substrate prototype. It combines a capped pUSD demo balance/faucet with a simple synthetic-stock paper market so the budget route does not require separate token, faucet, market, and per-stock token deployments.

## Exact on-chain behavior

- **pUSD:** whole-unit integer accounting (no fractional pUSD) for the budget-constrained native version. This is an app-only demo credit ledger, not an ERC-20 token; it has no real-world value, no redemption, and is not USDC. The separate EVM route retains its 18-decimal ERC-20 design.
- **Initial supply:** 0 pUSD.
- **Global supply cap:** 1,000,000 pUSD (including pUSD held by users and the market reserve).
- **Faucet:** a successful claim mints 1,000 pUSD. The first claim is immediate; the same account can claim again after 3,600,000 milliseconds (one hour), while the global cap still has room.
- **Transfer/allowance interface:** deliberately omitted to keep this native deployment small. This route is an in-app pUSD ledger exposed through the ink! ABI, not a standalone ERC-20 contract; standard ERC-20 wallets and `approve/transferFrom` integrations will not work against it.
- **Synthetic listings:** pAAPL = 200 pUSD, pNVDA = 180 pUSD, pTSLA = 250 pUSD, pMSFT = 400 pUSD per whole demo share. These are fixed demonstration prices, not live market or oracle prices.
- **Buy:** requires enough pUSD, moves pUSD from the user's balance into the market reserve, and records synthetic shares.
- **Sell:** requires enough shares and enough pUSD in the market reserve. It pays from that reserve; it does not mint pUSD. With a new deployment, the reserve starts at zero, so sells can only be paid after buys have funded it.
- **Share positions:** these are paper records, not equity and not separate transferable stock-token contracts.
- **Native tPOT:** still required for transaction fees and any runtime storage deposits. First-time users may also need native balance to pay for their contract-storage growth; the faucet gives demo pUSD, not tPOT.

This is a demo market, not a brokerage, production order book, live stock-price feed, or custody system. The contract has no admin mint method and no owner override; the hard cap, claim amount/cooldown, and demo prices are fixed in code.

## Build artifact and tests

The GitHub Actions workflow **PASTX Compact Native Market Contract Bundle** runs ink! unit tests, installs pinned cargo-contract v5.0.3, builds the release contract, validates the generated `.contract` bundle, measures the code-deposit estimate, and uploads the outputs for 14 days. It never deploys.

Expected output files in `contracts/cross-chain/native-ink/target/ink/`:
- `pastx_budget_market.contract`
- `pastx_budget_market.wasm`
- `pastx_budget_market.json`

Always use all three files from the **same successful workflow artifact**. After source changes, prior artifacts and prior runtime deposit quotes are stale until the new artifact is built and a live read-only preflight is rerun.

## Read-only preflight

1. Configure the native testnet mnemonic locally in `contracts/cross-chain/.env` using `PORTALDOT_NATIVE_DEPLOYER_MNEMONIC` or the existing `PORTALDOT_DEPLOYER_MNEMONIC`. Never share or commit this secret.
2. Set `PORTALDOT_NATIVE_EXPECTED_ADDRESS` to the exact native `5...` address that actually holds the test tPOT.
3. Verify `PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH` against the official Portaldot V3 testnet identity, not merely an RPC's self-reported name.
4. From `contracts/cross-chain`, run:

```powershell
npm run preflight:native:ink
```

This checks network/account pins, free and reserved balance, bundle consistency, runtime storage deposit, estimated transaction fee, and a read-only constructor simulation. It submits no transaction. Do not deploy if the new artifact fails the size gate, the preflight fails, the signer is not the expected wallet, or the network identity is not independently verified.

The old 4,750-byte paper-ledger build and its previous 383.368 tPOT runtime quote described the earlier contract without pUSD/faucet behavior. **Neither number is valid for the combined contract now that the source has changed.** The fresh workflow artifact and fresh live preflight are authoritative.

The explicit budget-constrained entry points are:
```powershell
npm run preflight:native:portal
npm run deploy:native:portal
```
These aliases select the combined compact ink! route. The larger four-contract Solidity/Solang architecture remains separate as `preflight:native:solang-market` / `deploy:native:solang-market` and must not be confused with this route.
