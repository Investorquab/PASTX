# PASTX Market Implementation Notes

PASTX is a Portaldot-first Ecosystem dApp with synthetic stock tokens and a capped faucet-funded pUSD token. These assets do not represent real equity or redeemable stablecoin value.

- `PastxDemoToken`: capped demo token with owner-managed minters.
- `PastxFaucet`: fixed claim amount and cooldown; the deployer authorizes the faucet as a minter.
- `PastxStockToken`: transferable synthetic shares with market-only mint/burn.
- `PastxMarket`: owner-set prices; market buys/sells collect native token or the listing's payment token. Sells require reserve liquidity. Limit buys escrow payment; limit sells escrow shares. Anyone can execute an eligible order; only the order owner can cancel it.

Prices are not oracle-driven. This is a fixed-price test market, not a brokerage or order book. Limit orders need a later execution transaction. Empty UI addresses mean not deployed. iBridge remains simulation-only; the existing trusted-relayer bridge prototype is separate. BNB tests do not prove Portaldot PolkaVM compatibility.

Before demo: run tests and both compile targets; verify Portaldot chain identity, native-token semantics and wallet compatibility; obtain explicit approval before deployment; verify addresses and explorer transactions; test faucet cooldown, approvals, buy/sell, limit execution and cancellation; fund sell reserves only with valueless test assets; confirm BNB deployment rules with organizers.
