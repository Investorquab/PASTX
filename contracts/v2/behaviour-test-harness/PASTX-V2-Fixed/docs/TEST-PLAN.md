# Required V2 automated tests

This remediation ZIP does not claim a complete passing test suite. Add tests in a pinned Hardhat/Foundry environment and make all of these mandatory before deployment.

## Markets
- buy requires exact native payment / sufficient wtPOT allowance and balance
- zero shares and rounded-to-zero payments revert
- insufficient stock inventory reverts atomically
- seller must have a recorded position and approve the market to transfer stock back
- successful sell reduces position, total position shares, and reserved liquidity exactly
- owner cannot withdraw reserved liquidity, but can withdraw surplus
- owner cannot change token or price while positions are outstanding
- pause blocks buys and sells; only owner can change pause/listings
- malicious/reentrant token and recipient callbacks cannot re-enter protected functions
- extreme values revert safely on checked arithmetic

## Wrapped token
- only gateway can mint/burn; zero address/zero amount rejected
- allowance, transfer, transferFrom and total supply invariants
- gateway change only owner; deployment sequence locks correct gateway before use

## Bridge
- only configured relayer can attest deposits/release withdrawals
- wrong chain, source chain, escrow, recipient, zero tx hash, invalid deposit ID rejected
- duplicate deposit ID and duplicate source event rejected
- replayed withdrawal ID rejected; escrow balance and cumulative releases cannot be exceeded
- source-to-wrapped conversion tested for decimals 18, 14, 0; round trip exact
- nonrepresentable wtPOT withdrawal amount rejected when source decimals < 18
- event fields and deposit-ID hashing match the actual source event ABI exactly
- simulated forged attestation demonstrates documented trust limitation; no test should claim on-chain source proof

## End-to-end
- deploy Portaldot escrow, WrappedPot, gateway, markets, stock tokens in documented order
- configure relayer/gateway addresses; check chain IDs and decimals from deployed bytecode/state
- deposit -> relayer observes finalized event -> mint; buy -> sell; burn -> relayer validates burn -> escrow release
- simulate relayer outage, duplicate events, reorg before finality, and interrupted relaying

## Release criteria
No deployment until tests are automated, passing from a clean checkout, and independently reviewed. Source compilation alone is not sufficient.
