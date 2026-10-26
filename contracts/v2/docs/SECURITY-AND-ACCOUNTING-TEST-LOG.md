# PASTX V2 --- Security, Accounting & Mainnet Readiness Log

**Working engineering record**\
**Last updated:** 24 October 2026\
**Repository:** https://github.com/Investorquab/PASTX

## 1. Purpose

This is the working record of PASTX V2 contract behaviour tests,
confirmed findings, unresolved risks, and Portaldot V3 mainnet-readiness
gates. Keep updating it as testing and remediation progress. Use it as
source material when preparing repository documentation and the final
README for judges.

**Evidence boundary:** Reported tests were run in the isolated local
Hardhat harness at `contracts/v2/behaviour-test-harness/PASTX-V2-Fixed`.
Passing tests do not prove that the main V2 source tree contains the
same fixes, that the contracts are secure, or that they are ready for
deployment.

## 2. Scope and environment

-   Local project root: `C:\Users\NEW\Desktop\PASTX`
-   Isolated harness:
    `contracts\v2\behaviour-test-harness\PASTX-V2-Fixed`
-   Compiler output reported: Solidity files compiled successfully, EVM
    target Paris.
-   BNB local test configuration: chain ID `97`.
-   Portaldot local test configuration: chain ID `420420777`.
-   No public-chain deployment or real-value transaction was performed.

## 3. Test history and current results

### Baseline behaviour tests

After fixes in the isolated harness: - **BNB suite: 3/3 passing** -
**Portaldot suite: 2/2 passing**

The initial run exposed a disabled-listing exit bug in both markets. The
harness copies were patched so `sell()` requires a configured stock
token but does not require the listing to remain enabled. The BNB test
fixture was also corrected to use the configured source escrow.

### Expanded security/accounting tests --- latest run

  -------------------------------------------------------------------------
  Suite                 Baseline tests       Expanded tests Outcome
  --------------- -------------------- -------------------- ---------------
  BNB (chain ID               3 passed   5 passed, 1 failed Not green
  97)                                                       

  Portaldot                   2 passed   5 passed, 1 failed Not green
  (chain ID                                                 
  420420777)                                                
  -------------------------------------------------------------------------

Both expanded suites fail at the same assertion in
`test/security-accounting.test.js:109`: - Actual value:
`900000000000000000` (`0.9e18`) - Expected value: `1100000000000000000`
(`1.1e18`)

Because the same shared test fails on both chains, inspect the operation
sequence and expected reserve/position accounting before concluding the
contract is wrong. It may be a test expectation issue or an accounting
defect; current evidence does not yet establish which. Do not simply
change the expected value to force a green run.

Expanded checks that passed: - Unauthorized administration and invalid
trade inputs. - Listing token/price cannot change while positions remain
open. - Pause blocks sells as well as buys. -
Transferable-stock/non-transferable-position mismatch is reproduced. -
Zero-liquidity withdrawals and zero-value liquidity deposits are
rejected.

## 4. Findings and design risks

### F-01 --- Disabled listing previously blocked exits

**Status: Confirmed in tested harness.**

The original `sell()` check rejected `!item.enabled`, so disabling a
listing prevented existing holders from selling. The isolated harness
now allows sells while the listing is disabled, provided a stock token
remains configured. Port the fix into the canonical V2 source and rerun
tests against that source before calling the main tree fixed.

### F-02 --- Transferable stock token vs separate position ledger

**Status: Reproduced by test.**

Stock tokens can be transferred without updating the market's
`positions` mapping. The ledger can therefore say the original buyer has
a position after tokens have moved, while the recipient may hold tokens
but lack a market position. Decide whether shares should be
non-transferable, positions should track token ownership, or the market
should use a different claim model. Add tests for the selected rule.

### F-03 --- Pause blocks sells as well as buys

**Status: Behaviour documented; policy decision required.**

The expanded test confirms pause blocks exits as well as new purchases.
This may be intentional emergency behaviour, but it creates exit-lock
risk. Define emergency policy, document it in UI/docs, and consider
whether a pause should stop buys while permitting risk-reducing sells
where safe.

### F-04 --- Bridge uses trusted-relayer attestation

**Status: Design limitation.**

`BnbBridgeGateway.completeDeposit` accepts source-event details from an
authorized relayer and does not independently verify Portaldot consensus
or an on-chain proof. Replay protection prevents duplicate
identifiers/events but does not make the bridge trustless.

### F-05 --- Native-token decimal configuration unverified for V3 EVM

**Status: Deployment blocker.**

The local gateway tests use `sourceNativeDecimals = 14` as a fixture.
This is not proof that Portaldot V3 EVM `msg.value` uses 14 decimals.
Confirm the current official V3 EVM mainnet native denomination and
chain configuration before setting constructor parameters.

### F-06 --- Expanded accounting assertion fails

**Status: Open.**

The shared test expects `1.1e18` but reads `0.9e18` at line 109. Inspect
the buy/sell sequence and state after each operation:
`reservedNativeLiquidity` / `reservedWrappedLiquidity`,
`totalPositionShares`, `positions[user][symbol]`, market token balance,
and payout math. Do not change the expectation without understanding the
discrepancy.

### F-07 --- Main V2 source may differ from harness copy

**Status: Open.**

The disabled-listing patch was made in the isolated harness. The main
`contracts/v2` files have not yet been confirmed to contain the same
fix. Do not describe the canonical source as fixed until the change is
applied and tested there.

## 5. Portaldot V3 mainnet compatibility gates

**Mainnet suitability is not established.** A local Hardhat chain
configured with chain ID `420420777` is a simulation; it does not
demonstrate compatibility with Portaldot V3 mainnet.

Before mainnet deployment:

1.  Obtain the current official Portaldot V3 EVM mainnet RPC endpoint
    and chain ID from Portaldot documentation or the team.
2.  Verify EVM runtime, Solidity/EVM opcode support, compiler target,
    deployment bytecode limits, and contract creation behaviour on V3.
3.  Verify native asset name, symbol, decimals/denomination used by EVM
    `msg.value`, transaction fees, and minimum balance/storage rules
    where applicable.
4.  Run read-only connectivity and chain-ID checks against the official
    mainnet endpoint; do not deploy or send transactions during this
    check.
5.  Review constructor parameters, relayer/owner addresses, token
    permissions, pause authority, and administration/change controls.
6.  Decide and document bridge trust assumptions. Do not claim trustless
    bridging unless source-chain proofs/finality are independently
    verified.
7.  Complete accounting invariants, fuzz/property tests, negative tests,
    static analysis, and ideally an independent audit.
8.  Perform a reproducible deployment dry run with recorded bytecode
    hashes/compiler settings, then test on V3 testnet first.
9.  Keep mainnet deployment gated behind explicit approval and a
    reviewed deployment checklist.

## 6. Remediation and test plan

1.  Inspect `test/security-accounting.test.js` around line 109 and
    calculate expected reserve values after every operation. Assert
    state after each buy/sell.
2.  Add explicit assertions for reserves, total position shares,
    per-user positions, market token balances, and payout balances.
3.  Resolve the transferable-token/position-ledger design rather than
    treating the reproduced mismatch as acceptable by default.
4.  Review pause semantics and add tests for owner pause/unpause access
    and exit behaviour.
5.  Expand gateway negative tests: wrong chain/source escrow/source
    chain, zero tx hash, wrong deposit ID, duplicate source event with a
    different deposit ID, unauthorized relayer, zero amount, decimal
    boundary/rounding, and relayer rotation.
6.  Expand escrow tests: cumulative release ceiling, balance exhaustion,
    invalid recipient/amount, unauthorized release, duplicate withdrawal
    ID, and chain guard.
7.  Port reviewed fixes from the harness into canonical `contracts/v2`;
    compile and run the suite from canonical source.
8.  Run static analysis and review warnings. Record test commands and
    tool versions.
9.  Complete Portaldot V3 mainnet verification gates before deployment.

## 7. Suggested repository record layout

Recommended location (proposed; not yet created):

``` text
contracts/v2/docs/
  SECURITY-AND-ACCOUNTING-TEST-LOG.md
  MAINNET-READINESS-CHECKLIST.md
  TEST-RESULTS/
    2026-10-24-expanded-local-tests.md
```

For judges, publish concise, evidence-based summaries, test commands,
coverage, known limitations, and links to reproducible tests. Do not
claim an independent audit, mainnet readiness, or trustless bridging
unless substantiated.

## 8. Update log

  -----------------------------------------------------------------------
  Date                    Update                  Status
  ----------------------- ----------------------- -----------------------
  2026-10-24              Baseline local Hardhat  Recorded
                          tests passed: BNB 3/3;  
                          Portaldot 2/2.          

  2026-10-24              Fixed disabled-listing  Harness only; canonical
                          sell behaviour in       source pending
                          isolated harness;       
                          corrected BNB fixture   
                          escrow address.         

  2026-10-24              Expanded tests exposed  Open
                          shared accounting       
                          assertion mismatch:     
                          actual `0.9e18` vs      
                          expected `1.1e18`.      

  2026-10-24              Mainnet V3              Deployment blocker
                          compatibility and       
                          native denomination     
                          remain unverified.      
  -----------------------------------------------------------------------

**Next update:** record the resolution of the line-109 accounting
assertion, the selected token/position accounting model, results of
expanded bridge/escrow tests, and official Portaldot V3 mainnet
configuration evidence.


## Canonical-validation status addendum — 25 October 2026

This addendum preserves the earlier F-01 through F-07 entries as historical findings. It records newer test evidence without retroactively rewriting the original observations.

- Canonical-validation workspace: six local Hardhat runs completed with 33 passing test executions and two expected pending opposite-chain cases.
- F-01: exit after listing disablement was verified in the tested source snapshot, provided the token remains configured and the normal liquidity/position checks pass.
- F-02: the test stock token blocks user-to-user transfers, but general token/position-ledger coupling is not proven for arbitrary token implementations.
- F-03: current tested behavior blocks buys while allowing eligible funded exits; this supersedes the older pause-blocks-sells wording.
- F-04 remains open: bridge attestations rely on a trusted relayer and do not independently prove source-chain consensus, inclusion, or finality.
- F-05 remains a deployment blocker: source native denomination has not been independently established; the `14`-decimal setting is a local fixture.
- F-06 is treated as a historical test-expectation mismatch: the isolated suite now expects `0.9e18` and passes. This is not, by itself, evidence of a production defect.
- F-07 is only partially resolved: source snapshot tests and limited source comparisons were completed, not a full provenance/reproducible-build audit.

Detailed run-by-run results: `docs/TEST-RESULTS/2026-10-25-canonical-validation.md`.

No live deployment, mainnet test, or real-value transaction was performed by these test runs.
