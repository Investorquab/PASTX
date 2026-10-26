# PASTX V2 local behaviour test harness

This package includes a local Hardhat test harness. It does not deploy to a public chain, use private keys, or move real funds.

## Run on Windows PowerShell

From this package directory:

```powershell
npm install --no-audit --no-fund
npm test
```

`npm test` runs two isolated local EVM networks:
- BNB testnet-like chain ID 97: market buy/sell, reserve protection, gateway-only minting, decimal conversion, replay/duplicate-event protection, relayer access control, and withdrawal burn behaviour.
- Portaldot V3 testnet-like chain ID 420420777: native-value market buy/sell, disabled-listing exit, reserved-liquidity protection, and escrow deposit/release access controls.

The market tests intentionally assert that disabling a listing prevents new buys but does **not** block existing holders from selling. The `sell()` guard has been adjusted accordingly in both market contracts. Existing listing price/token immutability while positions remain is retained.

## Important limits

These are behaviour tests, not a security audit. The gateway tests demonstrate the trusted-relayer model; they do not prove source-chain finality or validate a BNB burn on Portaldot. The escrow has no BNB consensus proof verifier. The test's `sourceNativeDecimals=14` is only a fixture to exercise conversion and is **not** a recommendation for the real Portaldot deployment. Confirm the actual source EVM value denomination first.
