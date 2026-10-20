# PASTX Market Implementation Notes

PASTX is a Portaldot-first ecosystem dApp with synthetic stock tokens and a capped faucet-funded pUSD token. These assets do not represent real equity or redeemable stablecoin value.

- `PastxDemoToken`: capped demo token with owner-managed minters.
- `PastxFaucet`: fixed claim amount and cooldown; the deployer authorizes the faucet as a minter.
- `PastxStockToken`: transferable synthetic shares with market-only mint/burn.
- `PastxMarket`: owner-set demo prices; market buys/sells collect native token or the listing's payment token. Sells require reserve liquidity.

This is a fixed-price test market, not a brokerage or full order-matching exchange. It supports market buys and sells only. Prices are not oracle-driven. The deployment script uses 14-decimal raw units for native tPOTv3 listings on Portaldot and 18 decimals for BNB native units and pUSD. Empty UI addresses mean not deployed. iBridge remains simulation-only; the existing trusted-relayer bridge prototype is separate. BNB tests do not prove Portaldot PolkaVM compatibility.

Before a demo, run tests and both compile targets; verify Portaldot chain identity, native-token semantics and wallet compatibility; obtain explicit approval before deployment; verify addresses and explorer transactions; and test faucet cooldown, approvals, buy/sell and reserve liquidity using only valueless test assets.
