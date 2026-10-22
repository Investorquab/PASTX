# Compact native PASTX demo market (ink! v5)

This directory contains an experimental, size-optimized native Substrate Contracts market prototype. The existing Solidity/EVM contracts remain separate and unchanged.

## Scope and limitations

- Four synthetic demo listings: pAAPL, pNVDA, pTSLA, pMSFT.
- Maintains paper-share positions per native account.
- Quote values are demo reference prices, not live/oracle-verified market prices.
- Does not custody USDC/tPOT, move funds, or represent real stock ownership.
- The ink! artifact must pass the cargo-contract build, ABI/bundle consistency check, and a read-only Portaldot constructor dry-run before any deployment is considered.

## Build artifact

The GitHub Actions workflow **PASTX Compact Native Market Contract Bundle** runs tests, installs pinned cargo-contract v5.0.3, runs `cargo contract build --release`, validates the generated `.contract` bundle, measures the observed testnet code-deposit estimate, and uploads the generated artifacts for 14 days. This workflow never deploys.

Download the artifact ZIP from the successful run under **Actions**, then extract the files into:

`contracts/cross-chain/native-ink/target/ink/`

Expected files: `pastx_budget_market.contract`, `pastx_budget_market.wasm`, and `pastx_budget_market.json`.

## Read-only preflight

1. Configure the correct native Substrate account mnemonic locally in `contracts/cross-chain/.env` using `PORTALDOT_NATIVE_DEPLOYER_MNEMONIC` or the existing `PORTALDOT_DEPLOYER_MNEMONIC`.
2. Never paste your mnemonic/private key into chat or commit it.
3. Check `PORTALDOT_NATIVE_EXPECTED_ADDRESS` against the native address that actually holds the test tPOT.
4. Run from `contracts/cross-chain`:

```powershell
npm run preflight:native:ink
```

The script checks chain identity, signer balance, code size/deposit constants, bundle integrity, and—only if the balance appears sufficient—a read-only constructor dry-run. It never submits an extrinsic. If the signer has insufficient balance, the script stops and tells you which public native address was selected; do not deploy or top up another account until the address is confirmed.

The observed runtime rate used for estimates was 0.06 tPOT per byte plus 0.15 tPOT per uploaded-code item as of 2026-10-22. Runtime constants can change, and constructor storage plus transaction fees are additional costs.

The compact bundle's static size gate targets a maximum **300 tPOT uploaded-code deposit**, using the last-observed rates of 0.06 tPOT per byte plus 0.15 tPOT per uploaded-code item. The CI-built 4,750-byte artifact estimates to **285.15 tPOT** for code upload. A previous live read-only preflight reported **383.368 tPOT** for the runtime's instantiate-with-code storage-deposit quote; that is a different, broader runtime quote, and it is the value the deployment affordability check must honor. That same run estimated 0.490195 tPOT for the extrinsic and used a 1 tPOT reserve: about 384.858 tPOT required against the then-reported 441 tPOT balance, leaving about 56.142 tPOT. Re-run the live preflight because runtime rates, contract artifact, account balance, storage deposit, and fees can change.

The preflight now verifies that the embedded WASM in the `.contract` bundle matches the standalone `.wasm` file and that the `.json` ABI came from the same build. Always extract all three files from the **same successful workflow artifact**.

**Route warning:** `npm run preflight:native:portal` now selects this compact, single ink! market for the budget-constrained route. The four-contract Solidity/Solang architecture is available separately as `npm run preflight:native:solang-market`; its observed code-deposit estimate was 6,539.46 tPOT and it is not the 300-tPOT code-budget architecture. The compact contract is only a paper-share ledger, not the separate pUSD/faucet/stock-token deployment.
