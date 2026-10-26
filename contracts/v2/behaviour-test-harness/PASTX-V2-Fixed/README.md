# PASTX V2 revised testnet contract package

This is a **candidate remediation build**, not an audited or deployment-approved release. It keeps the six original contract roles and adds `contracts/common/PastxSecurity.sol` for reentrancy protection and safe ERC-20 calls.

## Scope and trust model
- `PortalDotNativeMarket`: fixed-price synthetic test stock paid with native Portaldot EVM value.
- `PortalDotBridgeEscrow` + `BnbBridgeGateway`: relayer-attested testnet bridge. This is **not trustless** and does not verify BNB consensus or source-chain finality on-chain.
- `WrappedPot`: 18-decimal wtPOT, gateway-controlled mint/burn.
- `BnbWrappedPotMarket`: fixed-price synthetic test stock paid with wtPOT.
- `PastxTestStock`: owner-mintable synthetic test stock; no equity rights.

## Decimal conversion is a deployment gate
`BnbBridgeGateway` now takes `sourceNativeDecimals` in its constructor and converts source amounts to 18-decimal wtPOT units. Verify the actual source EVM value denomination and event amount semantics first. Do not infer this from wallet display settings. The configured value must be identical to the unit represented by `DepositInitiated.amount` and `WithdrawalReleased.amount`.

For a source amount with `d` decimals (d <= 18): wrapped amount = source amount * 10^(18-d). A withdrawal is accepted only when its wtPOT amount converts exactly back to source units. If the source EVM native value is in 18-decimal wei, use 18; if verified evidence establishes another denomination, use that value. Do not deploy while uncertain.

## Liquidity and positions
Markets reserve liquidity for recorded open positions. Owners may withdraw only the unreserved surplus. Listing token/price changes are blocked while positions are open, preventing retroactive repricing of outstanding positions. Prices remain fixed owner-configured demo prices, not a live order book.

## Build
Solidity compiler version 0.8.28 was used for the source-only compilation check. Compile with remappings/import path support because V2 contracts import `contracts/common/PastxSecurity.sol`.

## Before any deployment
1. Verify Portaldot chain ID, native EVM denomination, and the source event units from live testnet evidence.
2. Add/run the full automated test suite (see `docs/TEST-PLAN.md`).
3. Independently review relayer security, source finality, operator key management, and recovery procedures.
4. Use a fresh testnet deployment, verify constructor addresses and bytecode, then exercise deposit, mint, buy, sell, burn, and release end-to-end with small amounts.
5. Never use production funds or claim that the bridge is trustless.
