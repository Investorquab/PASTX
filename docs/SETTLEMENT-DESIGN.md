# Settlement Design and Verification Gates

**Status: UNRESOLVED — no production settlement route is approved yet.**

This document is a safety gate, not evidence that PASTX has deployed a contract or completed a Portaldot transaction.

## Required outcome

For a trade that exchanges a payment asset for a market asset, the result must be all-or-nothing:
- both expected transfers succeed, or
- neither transfer takes effect.

If the chosen runtime cannot provide that guarantee for the intended participants and assets, do not expose the flow as a real trade.

## Asset and price semantics

- The current AAPL/NVDA/TSLA/MSFT catalogue is external reference data, not tokenized company equity. A trade cannot transfer a reference quote as though it were an owned asset.
- Any demo payment asset (including native tPOTv3/POT) must be verified against the actual target runtime and account balance semantics before it is used in an order flow.
- Do not invent a POT/USD conversion or treat an external stock quote as an executable on-chain price. A quote currency, price oracle, asset backing and settlement asset are separate concerns.
- Every instrument must be labelled as `reference`, `simulated`, or `onchain`; only verified `onchain` instruments can be eligible for a real settlement path.

## Portaldot V3 facts from the published testnet guide

The [Portaldot V3 Testnet Guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide) was updated on 16 October 2026 and says the former `feso-apps.xyz` endpoints are no longer in use. The current documented Substrate WebSocket is `wss://test-node-v3.portaldot.dev`; the current EVM JSON-RPC endpoint is `https://test-evm-rpc-v3.portaldot.dev`; the EVM chain ID remains `420420777`; and the test token is `tPOTv3` with 14 decimals. The guide documents mapping an EVM H160 address to a native `AccountId32`/SS58 address through `reviveApi.accountId` before funding from the native side. It warns that an H160 address derived from a key is not necessarily the same address as that key’s Ethereum address.

These are documented testnet configuration facts, not proof that the endpoint is reachable now or that PASTX has completed an integration test. Earlier CI evidence is recorded in [Project Status](PROJECT-STATUS.md) and must be refreshed before release. The guide’s [FAQ](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide/blob/main/FAQ.md) says native `assets` and `revive` Solidity contracts are distinct models unless an explicit adapter/wrapper exists, and direct cross-calls between WASM/ink! and Solidity are awaiting confirmation. Therefore, do not assume a native Assets token can be transferred inside a Solidity settlement call.

## Questions to resolve against the actual target runtime

1. Is the current documented V3 EVM RPC reachable now, and does it report the expected chain ID and a current block number?
2. Which runtime version and transaction interfaces are active on that endpoint?
3. Is the intended market asset native `assets`, an ERC-20 deployed through `revive`, or another explicitly documented representation?
4. Can the payment and market-asset transfer execute atomically within the same supported execution environment and authorization model?
5. How is the H160-to-SS58 mapping resolved, displayed and funded in the actual wallet flow?
6. Who can initiate, cancel, or redirect settlement?
7. Are replay protection, duplicate submission handling and clear failure states implemented?
8. Can success be verified from receipts/events and resulting balances?
9. Can the same behavior be reproduced on the target V3 environment, not only a local or legacy node?

## Candidate routes

### Native assets route
Potentially appropriate if the actual runtime exposes the needed asset operations and a safe atomic settlement composition. Broad operator approvals are not acceptable without a constrained, tested authorization model.

### Contract route
Potentially appropriate if the target contract environment is confirmed and the payment/asset representations can participate in the same atomic execution. Do not assume Solidity token contracts can transfer native Assets without verified interoperability.

### Custom runtime pallet
Not a default hackathon option: a custom FRAME pallet generally requires runtime integration and chain governance/deployment support. It cannot simply be installed into a public chain as an ordinary dApp.

## Required tests before enabling trades

- Successful buy and successful sell.
- Insufficient payment balance.
- Insufficient asset balance.
- Invalid asset or amount.
- User rejects signature.
- Transaction fails or remains pending.
- Duplicate submission/replay attempt.
- Forced failure of the second transfer proves the first transfer is rolled back.
- Receipt and resulting balances agree.
- Wrong network and RPC disconnect are handled safely.
- Wallet signing is tested on desktop and at least one Android wallet/browser combination.

## Evidence record

For every integration claim, record:
- target network name and chain/runtime version;
- date of test;
- RPC used (never include credentials);
- command or test procedure;
- expected and actual result;
- transaction hash and explorer URL, if a transaction occurred;
- limitations and reproduction steps.

Never fabricate contract addresses, transaction hashes, testnet availability or success status. A local-node test is not proof of target V3 deployment.


## Cross-chain prototype boundary

The separate `contracts/cross-chain` package is a controlled testnet prototype, not an approved production route. The PortalDOT source contract emits a deposit request and locks test EVM native value. A single trusted relayer waits a configurable block depth and checks a source transaction receipt before submitting event fields to the BNB testnet gateway. The gateway recomputes the deposit identifier, checks the configured source chain/escrow, prevents duplicate deposit and source-log processing, and mints a 1:1 raw-unit `wtPOTv3` test representation.

The BNB-side market contains only mock instruments (`AAPL-TEST`, `TSLA-TEST`, `NVDA-TEST`, `MSFT-TEST`) with owner-controlled demo prices and explicitly seeded test liquidity. It is not an official stock-token market, not linked to a live stock oracle, and does not imply ownership of underlying shares. Test BNB pays destination gas; `wtPOTv3` is not native BNB or USDT.

No contract is deployed by compilation or local tests. Before a small real testnet deposit, verify the currently reachable PortalDOT V3 RPC, chain ID, wallet/H160 mapping, actual EVM native-balance/value units and resulting escrow balance. Before any mainnet use, verify an official/supported bridge or build a separately security-reviewed bridge with robust finality/message verification, replay controls, pause/recovery, monitoring and audits. A trusted single relayer is unacceptable for valuable production funds.
