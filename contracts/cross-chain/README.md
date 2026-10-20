# PASTX market contracts

Testnet-only synthetic market contracts, separate from the existing trusted-relayer bridge prototype.

- `PastxDemoToken`: capped pUSD demo token; not USDC/USDT and not redeemable.
- `PastxFaucet`: per-wallet cooldown; deployer must authorize the faucet as a token minter.
- `PastxStockToken`: transferable synthetic shares, not equity ownership.
- `PastxMarket`: owner-listed assets, fixed demo prices, and native-token or pUSD market buys/sells.

The current contract is a fixed-price test market, not a live exchange, broker or matching engine. It only supports market buys and sells; it does not provide a live order book. A sell requires sufficient native/pUSD reserves for payout. Native tPOTv3 on Portaldot uses 14 decimals in the current adapter model; native tBNB and pUSD use 18 decimals. Prices are owner-set and are not oracle-driven.

## Local validation
```bash
cd contracts/cross-chain
npm install
npm test
npm run compile:bnb
npm run compile:portal
```

## Deployment scripts (not executed)
After explicit approval and target-runtime verification:
```bash
cd contracts/cross-chain
npm run deploy:market:portal
npm run deploy:market:bnb
```
Portaldot testnet is expected to use chain ID `420420777`; BNB testnet uses `97`. BNB EVM tests do not prove Portaldot PolkaVM compatibility. No deployment or live bridge transfer is part of this change. iBridge is simulation-only until an approved route is integrated and tested.
