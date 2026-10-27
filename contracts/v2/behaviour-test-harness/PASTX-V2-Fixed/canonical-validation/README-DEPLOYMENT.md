# PASTX V2 testnet deployment prep

Copy these files into `C:\Users\NEW\Desktop\PASTX\contracts\v2\behaviour-test-harness\PASTX-V2-Fixed\canonical-validation`, preserving the existing `contracts` and `test` folders. Back up the two existing Hardhat configs first.

## Environment root

Configs load `PASTX_ENV_FILE` when set, otherwise `C:\Users\NEW\Desktop\PASTX\.env`.

Recognized values:
- PortalDot RPC: `PORTALDOT_EVM_RPC_URL`, `PASTX_PORTALDOT_EVM_RPC_URL`, `VITE_PASTX_PORTALDOT_EVM_RPC_URL`
- BNB RPC: `BNB_TESTNET_RPC_URL`, `BSC_TESTNET_RPC_URL`, `VITE_PASTX_BSC_TESTNET_RPC_URL`
- Deployer private key: `PASTX_DEPLOYER_PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY`
- Relayer public addresses: `PASTX_BNB_RELAYER_ADDRESS` and `PASTX_PORTAL_RELAYER_ADDRESS`
- Optional BNB explorer key: `BNB_TESTNET_EXPLORER_API_KEY` or `BSCSCAN_API_KEY`

No key or credential is included in this bundle. Do not print `.env` values.

## Why this order

1. `WrappedPot` on BNB testnet (chain ID 97)
2. `PortalDotBridgeEscrow` on PortalDot EVM testnet (chain ID 420420777)
3. `BnbBridgeGateway` on BNB testnet, using both saved addresses
4. Set the wrapped token's gateway address

## Denomination fix

`PortalDotBridgeEscrow.deposit()` emits raw `msg.value`. Since EVM `msg.value` and `WrappedPot` use 18-decimal raw units, gateway constructor arg `sourceNativeDecimals` is set to **18** (1:1 raw-unit conversion). Do not use 14 unless a separately tested conversion adapter transforms the source event amount first. Tests that still expect `sourceNativeDecimals = 14` or multiplication by 10,000 must be updated before the full test suite is considered green.

## Read-only preflight and gas estimates

From PowerShell:
```powershell
$canonical = 'C:\Users\NEW\Desktop\PASTX\contracts\v2\behaviour-test-harness\PASTX-V2-Fixed\canonical-validation'
Set-Location $canonical
# Output contains addresses, balances and gas data only, never env secrets.
npx hardhat --config hardhat.bnb.config.js run scripts/preflight.js --network bnbTestnet
npx hardhat --config hardhat.portal.config.js run scripts/preflight.js --network portalDotTestnet
npx hardhat --config hardhat.bnb.config.js run scripts/estimate-deploy.js --network bnbTestnet
npx hardhat --config hardhat.portal.config.js run scripts/estimate-deploy.js --network portalDotTestnet
```

## Deployment commands (only after preflight + fee review)
```powershell
npx hardhat --config hardhat.bnb.config.js run scripts/deploy-wrapped.js --network bnbTestnet
npx hardhat --config hardhat.portal.config.js run scripts/deploy-portal-escrow.js --network portalDotTestnet
npx hardhat --config hardhat.bnb.config.js run scripts/deploy-bnb-gateway.js --network bnbTestnet
```

Scripts estimate deployment gas, apply a 20% gas-limit margin, assert chain IDs, wait for successful receipts, read back important settings and save address/transaction JSON under `deployments/`. The estimate is not a guarantee of execution success. These scripts do not deploy a relayer or prove cross-chain consensus; this is a trusted-relayer testnet prototype only.

## Current Hardhat configuration variables

The canonical-validation Hardhat configs accept these environment variables:

- **BNB RPC:** `BNB_TESTNET_RPC_URL`, `BSC_TESTNET_RPC_URL`, or `VITE_PASTX_BSC_TESTNET_RPC_URL`.
- **BNB deployer key:** `PASTX_DEPLOYER_PRIVATE_KEY`, `DEPLOYER_PRIVATE_KEY`, or `BNB_TESTNET_DEPLOYER_PRIVATE_KEY`.
- **PortalDot EVM RPC:** `PORTALDOT_EVM_RPC_URL`, `PASTX_PORTALDOT_EVM_RPC_URL`, `VITE_PASTX_PORTALDOT_EVM_RPC_URL`, or `PORTALDOT_V3_EVM_RPC_URL`.
- **PortalDot deployer:** `PASTX_DEPLOYER_PRIVATE_KEY`, `DEPLOYER_PRIVATE_KEY`, or `PORTALDOT_DEPLOYER_PRIVATE_KEY`; alternatively, `PORTALDOT_DEPLOYER_MNEMONIC`.

The BNB config requires both its RPC URL and deployer private key. The PortalDot config requires its RPC URL and either a deployer private key or mnemonic.

Relayer configuration is separate from deployer configuration. The deployment helpers expect `PASTX_BNB_RELAYER_ADDRESS` for the BNB gateway and `PASTX_PORTAL_RELAYER_ADDRESS` for the PortalDot escrow. Configure the corresponding chain-specific relayer private keys securely for relay operation. Never commit `.env`, private keys, or mnemonics.

These contracts use a trusted-relayer prototype model; this is not a trustless bridge. Confirm the intended deployer address and review deployment parameters before sending any transaction.
