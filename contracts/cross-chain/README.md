# PASTX Smart Contracts

Core target: Portaldot V3 testnet. This package also contains the separate experimental Portaldot-to-BNB prototype.

## Language and compiler target

The market contracts use Solidity 0.8.28 and are compiled for Portaldot V3 PolkaVM using Hardhat, @parity/hardhat-polkadot and @parity/resolc. Sources are in contracts/portal/. BNB-only EVM sources are in contracts/bnb/ and are a separate target. A BNB build or local EVM test is not proof of successful Portaldot execution.

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

The PolkaVM compile step and local EVM tests are both required; neither proves live testnet behavior by itself.

## Preflight and deploy

Confirm the current official Portaldot V3 testnet RPC endpoint and expected chain ID 420420777. The default RPC is https://test-evm-rpc-v3.portaldot.dev. Copy .env.example to .env and configure a funded, testnet-only PORTALDOT_DEPLOYER_PRIVATE_KEY locally. Never commit or paste that key into chat.

Run read-only preflight:

~~~bash
npm run preflight:market:portal
~~~

After verifying endpoint identity, deploy with one command:

~~~bash
npm run deploy:market:portal
~~~

The script rejects the wrong Hardhat network name or chain ID, checks the signer and native balance, persists transaction hashes and confirmations as it proceeds, and verifies bytecode, pUSD metadata/cap, faucet roles/settings, four pUSD listings and synthetic-token authorities. It revokes the deployer's direct minter permission after authorizing the faucet.

This is 13 separate blockchain transactions, not one atomic transaction. On a partial failure, inspect deployments/portal-v3-testnet/latest.json before proceeding; do not rerun blindly.

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
