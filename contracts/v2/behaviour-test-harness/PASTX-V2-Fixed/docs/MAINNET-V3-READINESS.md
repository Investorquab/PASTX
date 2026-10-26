# PASTX V2 — Portaldot V3 Mainnet Readiness Gate

## Current status: NOT APPROVED FOR MAINNET

The passing local tests are useful but do not certify mainnet suitability. Do not deploy this contract suite to Portaldot V3 mainnet until every gate below is verified with current Portaldot operator documentation and a mainnet RPC.

## Chain compatibility gates

1. Obtain the **official current Portaldot V3 mainnet EVM RPC URL and EVM chain ID** from the Portaldot team. Do not reuse testnet chain ID `420420777` or assume a historical chain ID.
2. Connect to the official endpoint and verify `eth_chainId`, `eth_getBlockByNumber("latest")`, `eth_getBalance`, transaction simulation, and receipt/log support.
3. Confirm the EVM execution environment actually supports Solidity `^0.8.24` bytecode compiled for the selected EVM target, `CALL`, `STATICCALL`, `REVERT`, and the opcodes emitted by the chosen compiler target.
4. Confirm the native denomination used by EVM `msg.value` and `eth_getBalance`. Historical Portaldot developer docs list native POT with 14 decimals, but that is not sufficient evidence for the **V3 EVM value denomination**. `PortalDotNativeMarket` prices are raw EVM value units, and the bridge's `sourceNativeDecimals` must match the actual source amount convention.
5. Confirm gas estimation, fee payment, storage requirements, block gas limit, contract size limits, and verified-source/explorer support.
6. Deploy first to the official V3 testnet with a fresh deployment manifest, then verify deployed bytecode, owner, listings, liquidity, pause state, stock inventory, and events from a second independent RPC/provider.

## Contract-level blockers / risks found in review

- `PortalDotBridgeEscrow` uses a trusted relayer. It does not verify BNB consensus, a BNB burn, or a cryptographic proof. It is not a trustless bridge.
- Escrow release accounting is global (`totalDeposited` / `totalReleased`), not tied to individual deposits or authenticated destination-chain withdrawals. Relayer compromise or error can release pooled funds within the global limit.
- The market has a separate `positions` mapping while stock tokens are transferable ERC-20s. Transferring shares can leave the sender's position ledger intact while the sender no longer holds tokens; the recipient holds tokens but has no sellable market position. This mismatch must be redesigned or transfers must be prevented/reconciled before mainnet.
- `setPaused(true)` blocks sells as well as buys, temporarily trapping exits while paused. Decide and document emergency-pause policy; consider allowing exits if safe and economically consistent.
- Owner can change relayer and configure listings; mainnet deployment needs multisig/timelock or documented governance, monitoring, key rotation, and incident response.
- Market liquidity is fixed-price principal accounting, not a live order book and not oracle pricing. Price fairness, inventory, slippage, and market-making policy must be explicit.
- No on-chain bridge proof/finality verification is present. Do not market the bridge as trustless.

## Required test coverage before deployment

- Fuzz/property tests for reserve invariants and repeated buy/sell sequences.
- Malicious ERC-20/token callback tests, reentrancy tests, failed native payout tests, and edge-case arithmetic tests.
- Gateway tests for wrong source chain, wrong escrow, bad deposit IDs, zero evidence, duplicate IDs, duplicate source logs, unauthorized relayer, and decimal conversion boundaries.
- Escrow tests for wrong chain, global-vs-per-deposit accounting, forced ETH, relayer compromise assumptions, and failed recipient calls.
- Static analysis (Slither or equivalent), manual review, reproducible build, bytecode/source verification, multisig deployment rehearsal, and a testnet incident/upgrade drill.

## Decision

The EVM-native market is syntactically EVM-oriented, but **mainnet V3 compatibility is unverified until the current official mainnet EVM chain ID, endpoint, value denomination, runtime support, and operational limits are confirmed**. This document is a gate checklist, not a deployment approval.
