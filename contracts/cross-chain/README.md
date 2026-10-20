# PASTX market contracts

Testnet-only synthetic market contracts, separate from the existing trusted-relayer bridge prototype.

- `PastxDemoToken`: capped pUSD demo token; not USDC/USDT and not redeemable.
- `PastxFaucet`: per-wallet cooldown; deployer must authorize the faucet as a token minter.
- `PastxStockToken`: transferable synthetic shares, not equity ownership.
- `PastxMarket`: owner-listed assets, fixed demo prices, native-token or pUSD market buys/sells, escrowed limit buys/sells, permissionless execution when the price condition is met, and owner-only cancellation.

Sell orders require enough native/pUSD reserves. Prices are owner-set, not oracle-driven. This is a fixed-price test market, not a brokerage or order book. Limit orders need a later execution transaction.

## Local validation
```bash
pnpm --filter pastx-cross-chain-testnet-prototype test
pnpm --filter pastx-cross-chain-testnet-prototype compile:bnb
pnpm --filter pastx-cross-chain-testnet-prototype compile:portal
```

## Deployment scripts (not executed)
After explicit approval and target-runtime verification:
```bash
pnpm --filter pastx-cross-chain-testnet-prototype deploy:market:portal
pnpm --filter pastx-cross-chain-testnet-prototype deploy:market:bnb
```
Portaldot testnet is expected to use chain ID `420420777`; BNB testnet uses `97`. BNB EVM tests do not prove Portaldot PolkaVM compatibility. No deployment or live bridge transfer is part of this change. iBridge is simulation-only until an approved route is integrated and tested.
