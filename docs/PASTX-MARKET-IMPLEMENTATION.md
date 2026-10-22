# PASTX Market Implementation Notes

## Product and asset semantics

The hackathon contract flow is a Portaldot V3 testnet-only synthetic market. It does not issue company equity or redeemable stablecoin value.

- pUSD is PastxDemoToken, 18 decimals, capped at 1,000,000.
- PastxFaucet grants 1,000 pUSD per wallet every 3,600 seconds after its minter role is authorized.
- PastxStockToken issues transferable synthetic shares; only the linked market can mint or burn them.
- PastxMarket is bound to one pUSD token; every listing uses pUSD. Native tPOTv3 pays gas only.
- Fixed owner-set demo prices: AAPL-TEST 200, NVDA-TEST 180, TSLA-TEST 250, MSFT-TEST 400 pUSD.
- The market supports fixed-price buys and sells, not an order book. A sell requires enough pUSD in reserves.

## Toolchain and validation

Portaldot sources are contracts/cross-chain/contracts/portal/. They use Solidity 0.8.28 with Hardhat, @parity/hardhat-polkadot 0.3.0 and @parity/resolc 1.4.0 for PolkaVM. The portal-unit configuration is a normal local EVM used for semantic tests; compile:portal checks the PolkaVM compiler target. Neither proves live network behavior by itself.

~~~bash
cd contracts/cross-chain
npm install
npm run check
npm test
npm run compile:bnb
npm run compile:portal
npm run preflight:market:portal
~~~

After confirming the official RPC and chain ID 420420777, set a funded, testnet-only PORTALDOT_DEPLOYER_PRIVATE_KEY in local contracts/cross-chain/.env. Never commit it or paste it into chat. Deploy all seven contracts:

~~~bash
npm run deploy:market:portal
~~~

The generated manifest records addresses, configuration, transaction hashes, blocks and gas. It also writes addresses.md, frontend.env and ABI JSONs. Each transaction is recorded as submitted/confirmed so a partial deployment can be investigated without blindly rerunning.

After deployment, connect a wallet, claim pUSD, approve the market, buy a synthetic share, verify position/transaction, approve shares, sell and verify payout/balances. Also test insufficient allowance and an underfunded sell. Run npm run verify:market:portal and preserve its JSON evidence. Do not call a local test or generated manifest a live deployment without checking receipts.

pUSD is not USDC/USDT; synthetic shares are not equity. The iBridge page remains simulated; the cross-chain prototype is separate and trusts an off-chain relayer.
