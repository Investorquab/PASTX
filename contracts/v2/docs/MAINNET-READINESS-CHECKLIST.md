# PASTX V2 Mainnet-Readiness Checklist

**Current decision: NOT READY — deployment and settlement must remain disabled.**

This checklist is a release gate, not a statement that the listed controls have been completed. Check an item only after its evidence has been reviewed and retained.

## Source and build integrity

- [ ] Freeze the exact intended release commit and cleanly identify all tracked and untracked changes.
- [ ] Review every V2 contract and deployment script in the release candidate.
- [ ] Establish source provenance and reproducible compiler settings for every artifact.
- [ ] Compile from a clean checkout using pinned dependencies.
- [ ] Run the complete chain-specific suites from a clean checkout.
- [ ] Resolve or explicitly document every skipped, pending, or failing test.
- [ ] Complete static analysis and an independent security review.
- [ ] Reconcile audit findings with the final source and verify remediation evidence.

## Market and accounting safety

- [ ] Test reserve invariants under buys, partial sells, full exits, failed transfers, and repeated transactions.
- [ ] Test malicious/reentrant tokens and recipient callbacks.
- [ ] Prove that all supported token transfer paths preserve market position accounting.
- [ ] Test pause, listing disablement, emergency exits, and owner permissions.
- [ ] Test liquidity withdrawal limits and all rounding/overflow boundaries.
- [ ] Confirm synthetic asset disclosures are explicit and cannot be confused with real equity ownership.

## Bridge and native denomination

- [ ] Independently establish the actual source-chain native-amount denomination and event semantics.
- [ ] Verify decimal conversion against authoritative source-chain evidence; do not assume the local `14`-decimal fixture is correct.
- [ ] Decide whether trusted-relayer attestation is acceptable for the intended risk model.
- [ ] Document relayer key custody, rotation, access controls, outage recovery, and incident response.
- [ ] Test forged attestations, duplicate events, replay, interrupted relaying, and finality/reorganization handling.
- [ ] Complete deposit-to-mint and burn-to-release end-to-end tests on the intended networks.
- [ ] Verify deployed chain IDs, contract addresses, bytecode, configuration, and event ABI.
- [ ] Define monitoring, reconciliation, pausing, and recovery procedures.

## Network and product evidence

- [ ] Verify official target-network endpoints and independently sourced chain fingerprints.
- [ ] Verify the deployed runtime and supported EVM behavior on the actual target network.
- [ ] Verify supported asset identities, decimals, permissions, and state from authoritative evidence.
- [ ] Do not infer stock backing, legal ownership, or executable market behavior from generic assets, NFTs, metadata, or precompile mappings.
- [ ] Complete wallet/account mapping and read-only balance verification before enabling any write path.
- [ ] Test failure behavior and recovery end-to-end without real-value exposure.

## Release controls

- [ ] Obtain written approval for the exact release commit and deployment plan.
- [ ] Review deployment scripts and configuration without exposing private keys or secrets.
- [ ] Confirm testnet rehearsal and rollback/incident procedures.
- [ ] Verify monitoring and operational ownership.
- [ ] Record reviewer sign-off, evidence links, known limitations, and final go/no-go decision.

## Current blockers

1. The bridge trusts relayer-supplied attestations and does not independently prove source-chain consensus or finality.
2. The configured source native denomination has not been independently verified; `sourceNativeDecimals = 14` is a local test fixture.
3. End-to-end bridge lifecycle, interruption, and finality/reorganization testing remain incomplete.
4. Canonical-source comparison is partial; complete provenance and reproducible-build evidence remain outstanding.
5. The package has not received an independent formal security audit.
6. The separate Portaldot V3 runtime audit is time-bounded testnet evidence, not mainnet compatibility evidence.

**Release rule:** Do not deploy to mainnet, enable real-value trading, or enable settlement until every required gate has evidence and the release receives explicit approval.
