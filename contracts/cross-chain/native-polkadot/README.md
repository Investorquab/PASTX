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

The native account is an sr25519/Substrate account with a 5... SS58 address. The existing local contracts/cross-chain/.env can provide PORTALDOT_DEPLOYER_MNEMONIC; it must never be copied into source control or pasted into chat. The native deployer is derived using the Substrate keyring, not ethers/Hardhat.

The testnet endpoint is wss://test-node-v3.portaldot.dev. Native RPC validation must verify the chain name and genesis hash and check the native account balance before submitting transactions. The EVM RPC and chain ID 420420777 are not used by this native package.

## Demo and security limits

pUSD is valueless test currency. The share tokens are synthetic and do not represent actual equities. The market is fixed-price, not an order book, and prices are owner-set rather than live exchange quotes. Do not use valuable assets or describe this demo as production settlement infrastructure.

This package keeps contract compilation isolated from deployment. No transaction is submitted by the compile command.
