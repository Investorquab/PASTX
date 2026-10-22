# PASTX Smart Contracts

Core target: Portaldot V3 testnet. This package also contains the separate experimental Portaldot-to-BNB prototype.

## Language and compiler target

The market contracts use Solidity 0.8.28 and are compiled for Portaldot V3 PolkaVM using Hardhat, @parity/hardhat-polkadot and @parity/resolc. Sources are in contracts/portal/. BNB-only EVM sources are in contracts/bnb/ and are a separate target. A BNB build or local EVM test is not proof of Portaldot execution.

The PortalDOT compile command includes a bytecode-target assertion. It must fail unless the required Portaldot contract artifacts begin with the PolkaVM bytecode marker (0x50564d00). This guards against the plugin silently falling back to normal EVM bytecode.

## Seven contracts in the core demo

- PastxDemoToken: capped pUSD, 18 decimals, 1,000,000-token cap.
- PastxMarket: fixed-price market permanently bound to that pUSD token.
- PastxFaucet: 1,000 pUSD per wallet every 3,600 seconds.
- Four PastxStockToken deployments: pAAPL, pNVDA, pTSLA and pMSFT synthetic shares.

All listings use pUSD; native tPOTv3 is needed for gas only. Demo prices are 200, 180, 250 and 400 pUSD. pUSD is valueless test currency, not redeemable. Synthetic shares are not equity. This fixed-price market is not an order book or production brokerage. Sells require sufficient pUSD reserves.

## Install and validate

Requires Node.js 22+. From this folder:

~~~bash
npm install
npm run check
npm test
npm run compile:bnb
npm run compile:portal
~~~

The PolkaVM compile step checks its output prefix as part of the command. Both the PolkaVM build and local EVM tests are required; neither proves live testnet behavior by itself.

## Preflight and deploy

Confirm the current official Portaldot V3 testnet RPC endpoint and expected chain ID 420420777. The default RPC is https://test-evm-rpc-v3.portaldot.dev. Copy .env.example to .env and configure exactly one funded, testnet-only deployer signer locally.

The deployer may be configured using either:
- PORTALDOT_DEPLOYER_PRIVATE_KEY for a raw EVM private key; or
- PORTALDOT_DEPLOYER_MNEMONIC for the recovery phrase of a SubWallet EVM account.

For mnemonic mode, the tool derives the EVM account at m/44'/60'/0'/0/0, matching SubWallet's documented default EVM path. Before any deployment transaction, the preflight compares the derived address with Hardhat's signer and checks the EVM account's on-chain native tPOTv3 balance. Confirm that the printed/public 0x address matches the EVM account shown by SubWallet. A native Portaldot address beginning with 5 is a different address type and is the one requested for the hackathon's native-token distribution; don't assume it is the same as the EVM deployer.

Never paste your seed phrase or private key into chat, source files, or command arguments. The .env file is gitignored and must remain local. Do not put a recovery phrase in .env.example.

Run the read-only preflight first:

~~~bash
npm run preflight:market:portal
~~~

The preflight rejects the wrong Hardhat network name or chain ID, signer mismatch, an unusable RPC, or a deployer EVM account with no native tPOTv3 balance. If it fails, no deployment transaction is sent.

After verifying endpoint identity and the signer, deploy with one command:

~~~bash
npm run deploy:market:portal
~~~

The core market setup is 13 separate blockchain transactions, not one atomic transaction. The script records transaction hashes and confirmations as it proceeds, then verifies bytecode, pUSD metadata/cap, faucet roles/settings, four pUSD listings and synthetic-token authorities. It revokes the deployer's direct minter permission after authorizing the faucet.

On a partial failure, inspect deployments/portal-v3-testnet/latest.json before proceeding; do not rerun blindly.

## Generated outputs

The command writes under deployments/portal-v3-testnet/:
- latest.json and timestamped deployment.json with addresses, configuration, transaction hashes, block numbers and gas used.
- addresses.md with contract addresses and transaction hashes.
- frontend.env containing the public VITE_PASTX_PORTAL_MARKET, VITE_PASTX_PORTAL_TOKEN and VITE_PASTX_PORTAL_FAUCET values.
- abi/*.json files for the four contract types.

Copy those public addresses to apps/web/.env.local and verify the deployment:

~~~bash
npm run verify:market:portal
~~~

The verifier writes verification.json without submitting transactions. Check all addresses and hashes against the target RPC or an official explorer.

The trusted-relayer Portaldot/BNB prototype remains separate and is not connected to the iBridge simulation. Never use demo contracts with valuable assets.
