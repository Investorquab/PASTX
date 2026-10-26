# Remediation notes

Changes applied in this candidate package:

1. Added `PastxSecurity.sol`: reentrancy guard and safe low-level ERC-20 transfer helpers (supports standard bool-returning and no-return tokens).
2. Added reentrancy protection around market buy/sell and escrow release external-call paths.
3. Added market reserve accounting. Owner liquidity withdrawals cannot reduce balances below the amount reserved for open recorded positions.
4. Prevented changing a listing's token or price while positions for that symbol remain open.
5. Explicitly reject zero/rounded-to-zero trade amounts and reject zero price listings.
6. Added configurable source-unit-to-18-decimal wtPOT conversion in the BNB gateway; withdrawals must convert exactly back to source units.
7. Updated docs to describe the relayer-trust limitation and deployment gates.

## Not yet verified

The attempted compiler run in the packaging environment timed out before producing a result. Therefore, unlike the user's original source, this remediation package has **not yet been confirmed to compile** in this environment. It has not been unit-tested, fuzzed, formally verified, or independently audited. Compile and run tests from a clean local checkout before treating this as usable. Do not deploy based on this package alone.

## Important design limitation

The relayer remains trusted. The destination gateway cannot prove a source-chain deposit merely by checking a relayer-supplied transaction hash/log index. A production-grade trustless bridge requires a source-chain proof/light client or a separately reviewed threshold-attestation architecture.
