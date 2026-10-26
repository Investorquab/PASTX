# Threat model and known limits

- **Relayer trust:** `BnbBridgeGateway.completeDeposit` accepts a relayer-supplied attestation. The EVM contract validates consistency and replay keys, but does not verify Portaldot consensus, inclusion, or finality. A compromised relayer can mint unbacked wtPOT. Escrow release has the corresponding trusted-relayer assumption.
- **Decimal configuration:** wrong `sourceNativeDecimals` can create a unit mismatch. Verify source event amount semantics independently before deployment.
- **Market solvency:** open recorded positions reserve payout liquidity. Listing repricing is blocked while positions exist. Admins can still pause and control listings; the product is a testnet demo.
- **Token semantics:** markets assume stock tokens behave as standard ERC-20-like tokens. Adversarial token behavior must be covered by tests.
- **Synthetic assets:** test stock tokens do not represent shares in real companies and provide no equity, dividends, or legal ownership.
- **Not audited:** this package has not received an independent formal audit. Do not use mainnet assets.
