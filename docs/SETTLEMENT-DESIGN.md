# Settlement Design and Verification Gates

**Status: UNRESOLVED — no production settlement route is approved yet.**

This document is a safety gate, not evidence that PASTX has deployed a contract or completed a Portaldot transaction.

## Required outcome

For a trade that exchanges a payment asset for a market asset, the result must be all-or-nothing:
- both expected transfers succeed, or
- neither transfer takes effect.

If the chosen runtime cannot provide that guarantee for the intended participants and assets, do not expose the flow as a real trade.

## Questions to resolve against the actual target runtime

1. Is the intended V3 RPC reachable and the network identity confirmed?
2. Which runtime version and transaction interfaces are active?
3. Are native assets and the chosen contract environment interoperable? Do not infer this from general Polkadot capabilities.
4. Can the payment and asset transfer execute atomically under the intended authorization model?
5. Who can initiate, cancel, or redirect settlement?
6. Are replay protection, duplicate submission handling and clear failure states implemented?
7. Can success be verified from receipts/events and resulting balances?
8. Can the same behavior be reproduced on the target V3 environment, not only a local or legacy node?

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
