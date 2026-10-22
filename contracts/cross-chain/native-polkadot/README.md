# PASTX Native Portaldot V3 Contracts

This is a separate native Substrate contracts target. It does not overwrite the existing EVM-targeted Solidity sources under contracts/portal/.

## Why there are separate sources

The first native-target compile of the EVM sources failed because those files use block.chainid and address.code.length. The current native compiler/runtime combination rejects those expressions. Native contracts use 32-byte Substrate account addresses and SCALE encoding rather than the EVM's 20-byte addresses and Ethereum ABI encoding. Network identity is therefore enforced by the deployment tooling using the native endpoint, chain name, and genesis hash—not by block.chainid inside the contract.

The native target currently contains the four core market contract types:
- PastxDemoToken: capped, valueless pUSD test currency.
- PastxMarket: owner-managed fixed-price buy/sell market.
- PastxFaucet: cooldown-limited pUSD faucet.
- PastxStockToken: transferable synthetic shares.

The optional PortalDotTestnetEscrow under the EVM source directory is intentionally not part of this native market target. Its EVM-chain-ID assumptions and payable-transfer semantics require a separate design review rather than a silent mechanical port.

## Compile

Prerequisite: Solang v0.3.5 or compatible, with its executable available on PATH or set through SOLANG_PATH.

From contracts/cross-chain:

    npm run compile:native:portal

On Windows, the compile helper also checks the temporary location used by the current smoke test:
%TEMP%\pastx-solang-smoke\solang.exe

The compiler output is written to contracts/cross-chain/artifacts/native-polkadot/. Each required contract must produce both a .wasm file and a .contract metadata bundle. The build checks the WebAssembly magic header and required metadata.

## Native wallet and funding

The native account is an sr25519/Substrate account with a 5... SS58 address. The local contracts/cross-chain/.env can provide PORTALDOT_DEPLOYER_MNEMONIC; the native tool derives it using the Substrate keyring, not ethers/Hardhat. Never paste or commit the mnemonic. PORTALDOT_NATIVE_EXPECTED_ADDRESS can optionally pin the expected native account address.

The testnet endpoint is wss://test-node-v3.portaldot.dev. Every command checks the chain name, records the genesis hash, checks for the contracts pallet and verifies the native account balance. The EVM RPC and chain ID 420420777 are not used by this native package. Compare the printed genesis hash with the official Portaldot V3 Testnet network details before deploying.

## Demo and security limits

pUSD is valueless test currency. The share tokens are synthetic and do not represent actual equities. The market is fixed-price, not an order book, and prices are owner-set rather than live exchange quotes. Do not use valuable assets or describe this demo as production settlement infrastructure.

## Preflight and deployment

Run these from contracts/cross-chain:

    npm run compile:native:portal
    npm run preflight:native:portal

Preflight is read-only. It dry-runs the pUSD constructor, estimates its native extrinsic fee and storage deposit, confirms the signer and chain identity, and protects a default 1 tPOT reserve. It does not predict the full cost of all later contracts: later constructors depend on addresses created during deployment and each operation is dry-run and budget-checked immediately before it is submitted.

The complete deployment command is:

    npm run deploy:native:portal

It requires an interactive confirmation by typing DEPLOY PASTX. It submits seven contract instantiations plus six setup/listing calls (13 transactions total), waiting for finalization and recording each transaction, address and block in deployments/native-polkadot/. Multiple transactions are not atomic; if the command reports a partial failure, inspect latest.json and do not rerun blindly. Each step must preserve PORTALDOT_NATIVE_KEEP_RESERVE (default 1 native token). If a step cannot be safely funded or its dry-run fails, that step is not submitted.

After a successful deployment:

    npm run verify:native:portal

Verification is read-only and rechecks contract storage and the four listings through the native Contracts pallet. Public addresses and metadata are saved under the ignored deployments directory. This package does not yet switch the existing EVM frontend to the native adapter; the generated frontend.env documents native addresses for that later integration.

The compile command submits no transactions.
