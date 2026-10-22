# Compact native PASTX demo market (ink! v5)

This directory contains a size-optimized, single-contract native Substrate prototype. It combines a capped pUSD demo balance/faucet with a simple synthetic-stock paper market so the budget route does not require separate token, faucet, market, and per-stock token deployments.

## Exact on-chain behavior

- **pUSD:** whole-unit integer accounting (no fractional pUSD) for the budget-constrained native version. This is an app-only demo credit ledger, not an ERC-20 token; it has no real-world value, no redemption, and is not USDC. The separate EVM route retains its 18-decimal ERC-20 design.
- **Initial supply:** 0 pUSD.
- **Global supply cap:** 1,000,000 pUSD total, enforced as exactly 1,000 successful faucet claims of 1,000 pUSD each. There is no admin mint.
- **Faucet:** a successful claim mints 1,000 pUSD. The first claim is immediate; the same account can claim again after 3,600,000 milliseconds (one hour), while the global cap still has room.
- **Transfer/allowance interface:** deliberately omitted to keep this native deployment small. This route is an in-app pUSD ledger exposed through the ink! ABI, not a standalone ERC-20 contract; standard ERC-20 wallets and `approve/transferFrom` integrations will not work against it.
- **Synthetic listings:** pAAPL = 200 pUSD, pNVDA = 180 pUSD, pTSLA = 250 pUSD, pMSFT = 400 pUSD per whole demo share. These are fixed demonstration prices, not live market or oracle prices.
- **Buy:** requires enough pUSD, deducts the fixed price, and records synthetic shares.
- **Sell:** requires enough shares and credits the same fixed price back. Because quotes never change and share positions cannot be transferred, a sale converts the caller's committed pUSD back from the position; it does not mint new pUSD or depend on a shared liquidity pool.
- **Share positions:** these are paper records, not equity and not separate transferable stock-token contracts.
- **Native tPOT:** still required for transaction fees and any runtime storage deposits. First-time users may also need native balance to pay for their contract-storage growth; the faucet gives demo pUSD, not tPOT.

This is a demo market, not a brokerage, production order book, live stock-price feed, or custody system. The contract has no admin mint method and no owner override; the hard cap, claim amount/cooldown, and demo prices are fixed in code.

## Native ABI used by the app

The compact contract exposes one message, `command(action, stock_id, quantity)`, to keep the contract under the static size budget. The frontend encodes the ink! selector and SCALE arguments directly:

- `action = 0`: read the connected account's pUSD balance, selected synthetic share count, and fixed quote using a dry-run only.
- `action = 1`: claim 1,000 pUSD (quantity must be zero).
- `action = 2`: buy whole synthetic shares at the fixed quote.
- `action = 3`: sell whole synthetic shares at the same fixed quote.

The native UI remains separate from the EVM demo because this address is SS58/native Substrate and uses the `contracts` pallet, not EVM `0x` addresses, ERC-20 calls, or `viem`. Each write is simulated first and reviewed with its storage-deposit estimate and transaction fee before wallet signing. A successful build does not prove the app's live RPC and extension behavior; verify those on testnet after the live preflight and before spending deployment funds.

## Build artifact and tests

The GitHub Actions workflow **PASTX Compact Native Market Contract Bundle** runs ink! unit tests, installs pinned cargo-contract v5.0.3, builds the release contract, validates the generated `.contract` bundle, measures the code-deposit estimate, and uploads the outputs for 14 days. It never deploys.

Expected output files in `contracts/cross-chain/native-ink/target/ink/`:
- `pastx_budget_market.contract`
- `pastx_budget_market.wasm`
- `pastx_budget_market.json`

Always use all three files from the **same successful workflow artifact**. After source changes, prior artifacts and prior runtime deposit quotes are stale until the new artifact is built and a live read-only preflight is rerun.

## Read-only preflight

1. Configure the native testnet mnemonic locally in `contracts/cross-chain/.env` using `PORTALDOT_DEPLOYER_MNEMONIC` (or `PORTALDOT_NATIVE_MNEMONIC`). Never share or commit this secret.
2. Set `PORTALDOT_NATIVE_EXPECTED_ADDRESS` to the exact native `5...` address that actually holds the test tPOT.
3. Verify `PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH` against the official Portaldot V3 testnet identity, not merely an RPC's self-reported name.
4. From `contracts/cross-chain`, run:

```powershell
npm run preflight:native:portal
```

This checks network/account pins, free and reserved balance, bundle consistency, runtime storage deposit, estimated transaction fee, and a read-only constructor simulation. It submits no transaction. Do not deploy if the new artifact fails the size gate, the preflight fails, the signer is not the expected wallet, or the network identity is not independently verified.

The latest successful bundle workflow for this contract version produced a **4,918-byte** WASM and a static code-deposit estimate of **295.23 tPOT** using the previously observed rate (0.06 tPOT/byte plus 0.15 tPOT/code item). This is below the 300 tPOT static code target, but is **not** the live total-deposit quote. A prior 383.368 tPOT runtime quote belonged to the earlier paper-only artifact and is stale. Only a fresh read-only preflight against the exact current artifact can decide affordability.

The frontend adapter is available at `/native-demo`. Configure the public `VITE_PASTX_NATIVE_CONTRACT_ADDRESS` and `VITE_PASTX_NATIVE_EXPECTED_GENESIS_HASH` in the app environment only after the finalized contract address and official testnet genesis identity are verified. The page previews storage-deposit growth and fee estimates before asking the extension to sign. A first write for a user may require refundable native tPOT storage deposit; pUSD cannot pay this amount.

The explicit budget-constrained entry points are:
```powershell
npm run preflight:native:portal
npm run deploy:native:portal
```
These aliases select the combined compact ink! route. The larger four-contract Solidity/Solang architecture remains separate as `preflight:native:solang-market` / `deploy:native:solang-market` and must not be confused with this route.
