# Deployment checklist — testnet only

- [ ] Confirm Portaldot EVM chain ID is `420420777`; confirm BNB testnet chain ID is `97`.
- [ ] Verify native EVM `msg.value` and escrow event amount units from live testnet transactions. Determine `sourceNativeDecimals` from evidence, not wallet UI display.
- [ ] Run compiler, all unit tests, static analysis, and independent source review from a clean checkout.
- [ ] Create dedicated testnet deployer and relayer keys; keep secrets outside the repository and logs.
- [ ] Deploy stock tokens, market contracts, escrow, WrappedPot, and gateway with verified addresses.
- [ ] Set WrappedPot gateway to the deployed BNB gateway; verify `gateway()` on-chain.
- [ ] Verify relayer address, source chain ID, source escrow address, destination chain ID, and source decimals.
- [ ] Seed stock inventory and market liquidity; verify reserved liquidity accounting.
- [ ] Test full bridge round trip and both market flows with tiny test amounts.
- [ ] Test replay, unauthorized relayer, paused market, failed payout, and liquidity-withdrawal cases.
- [ ] Record chain IDs, addresses, compiler version, source commit, constructor args, and transaction hashes.
- [ ] Do not claim trustless bridge behavior; do not use mainnet funds.
