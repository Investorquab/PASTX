# PASTX V2 Canonical-Source Validation Results

**Validation date:** 25 October 2026  
**Scope:** Local Hardhat tests against a copied snapshot of the V2 canonical contract source  
**Compiler/configuration:** Solidity 0.8.28; Hardhat local environments  
**Chain IDs configured:** BNB testnet 97; Portaldot testnet 420420777  
**Deployment status:** Source-only prototype; no live deployment or real-value transaction was performed

## Executive result

The six canonical-validation test runs completed with **33 passing test executions and 2 expected pending chain-specific cases**. The count represents executions across runs, not 33 distinct tests. Each chain configuration intentionally skips the opposite chain's guarded edge case.

| Run | Result |
|---|---:|
| BNB canonical tests | 3 passing |
| Portaldot canonical tests | 2 passing |
| Edge cases under BNB config | 8 passing, 1 pending |
| Edge cases under Portaldot config | 8 passing, 1 pending |
| Security/accounting under BNB config | 6 passing |
| Security/accounting under Portaldot config | 6 passing |
| **Total** | **33 passing executions, 2 pending** |

## What was exercised

- Market access controls and invalid trade rejection.
- Partial buy/sell accounting and reserve consistency.
- Funded exits while buys are paused or a listing is disabled.
- Protection against changing listing token or price while positions remain open.
- Rejection of zero-value trades, oversells, and unsupported user-to-user transfers in the test stock token.
- Reserve-liquidity protection and relevant owner-only operations.
- BNB gateway source-chain, source-escrow, transaction-hash, deposit-ID, replay, and decimal-boundary checks.
- Portaldot escrow relayer authorization, duplicate release protection, cumulative release limits, and balance checks.

These are local contract tests. They do not prove security against all adversarial contracts, production network behavior, relayer correctness, economic attacks, or legal backing of the synthetic stock tokens.

## Canonical-source comparison boundary

The canonical-validation workspace contains a copied snapshot of the V2 source. The reviewed BNB gateway, Portaldot escrow, and PastxSecurity sources matched their harness counterparts by the comparison performed. The stock mock differed in raw file hash but matched under the whitespace/line-ending-insensitive comparison used.

This is **partial source-alignment evidence**, not a complete provenance or reproducible-build audit. It does not independently establish that every deployed bytecode artifact would derive from these files.

## Historical findings and current interpretation

- **F-01 — disabled-listing exits:** Current tested behavior permits exits when the token remains configured; this was verified in the tested snapshot.
- **F-02 — token/position accounting:** The test stock token blocks ordinary user-to-user transfers. This mitigates the tested scenario but does not prove general ledger/token coupling for every possible ERC-20 implementation.
- **F-03 — pause behavior:** Current tests support blocking buys while allowing eligible, funded exits. This supersedes the older test-plan wording that pause blocks both buys and sells.
- **F-04 — bridge trust:** Remains open. The gateway/escrow trust configured relayer attestations; the contracts do not independently verify Portaldot consensus, inclusion, or finality.
- **F-05 — source denomination:** Remains a deployment blocker. The configured `sourceNativeDecimals` value of 14 is a local fixture, not proof of the actual Portaldot V3 EVM native-amount denomination.
- **F-06 — historical accounting expectation:** The earlier 1.1e18-versus-0.9e18 mismatch was a historical test expectation mismatch. The isolated suite now uses the 0.9e18 expectation and passes. Do not characterize the old assertion alone as a production defect.
- **F-07 — canonical-source alignment:** Partially addressed by the copied-source test runs and comparisons described above. A full provenance/build-input audit remains outstanding.

## Not covered / release blockers

This validation did not complete a full end-to-end bridge lifecycle, test relayer outage and recovery under realistic finality/reorganization conditions, establish the source denomination from authoritative runtime behavior, or provide an independent formal security audit. No mainnet compatibility or deployment readiness is claimed.

## Reproduction

The validation was performed from the local `canonical-validation` workspace using the BNB and Portaldot Hardhat configurations and the BNB, Portaldot, canonical edge-case, and security/accounting test files.

Re-run the chain-specific test commands from the existing harness workspace before relying on this report for a later source revision. A report for this snapshot is not proof that a subsequent working tree or deployment artifact is identical.

## Chain-specific canonical verification

**Verification date:** 2026-10-25  
**Scope:** Local Hardhat tests and compilation only. No public-chain deployment or transactions.

### Forced compilation

| Configuration | Result |
|---|---|
| BNB (`hardhat.bnb.config.js`) | PASS — 7 Solidity files compiled successfully; EVM target: Paris |
| Portaldot (`hardhat.portal.config.js`) | PASS — 7 Solidity files compiled successfully; EVM target: Paris |

### Chain-specific test results

| Suite | Chain ID | Passing | Failing | Pending | Result |
|---|---:|---:|---:|---:|---|
| `test/bnb.test.js` using `hardhat.bnb.config.js` | 97 | 3 | 0 | 0 | PASS |
| `test/portal.test.js` using `hardhat.portal.config.js` | 420420777 | 2 | 0 | 0 | PASS |

BNB tests covered synthetic-share buys and sells, reserved principal, gateway-only minting, decimal scaling, deposit replay protection, and withdrawal amount boundaries.

Portaldot tests covered native-value buys and sells, exit after listing disable, escrow deposit accounting, relayer-restricted release, and duplicate-release protection.

### Combined-suite diagnostic — failures retained

Earlier runs invoked both test files under each chain configuration. The BNB configuration encountered the Portaldot escrow's `WrongDestinationChain()` guard. The Portaldot configuration encountered three BNB gateway `WrongChain()` reverts.

The configurations both use `./test`, which contains both chain-specific test files. Running each test file explicitly with its matching configuration produced the passing results recorded above. The earlier failures are retained as diagnostic evidence and are not represented as passing tests.

### Interpretation and limitations

- The confirmed chain-specific baseline is **5 passing tests across two suites**, with no failures in those isolated runs.
- Forced compilation succeeded for 7 Solidity files under each configuration.
- These results establish only the tested local behaviours; they do not establish production security, source provenance, reproducible-build integrity, bridge finality, or readiness for deployment.
- Existing security and accounting findings remain open unless separately resolved and verified.
- **Deployment decision: NOT READY.** No deployment or public-chain transaction was performed.

