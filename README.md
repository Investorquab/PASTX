# PASTX — Portaldot Asset & Stock Exchange

**A Portaldot-first stock-market application, starting with a synthetic testnet MVP and designed to grow toward a broader tokenized-asset marketplace.**

## Product today

- A product landing page explaining the current testnet scope and the longer-term direction.
- A stock directory of synthetic demo listings and a single buy/sell market ticket.
- Portfolio views for the connected Portaldot wallet, supported PASTX demo token, and known synthetic stock positions.
- Transaction activity with explorer links for confirmed transactions recorded in the current browser session.
- Transfers for supported native test tokens and pUSD when contracts are deployed and configured.
- An iBridge route-preview experience. It is a local simulation; no cross-chain transaction is submitted.
- The earlier external reference-market terminal remains separate at `/research`. Reference stock quotes are not PASTX execution prices.

## Product roadmap

After Portaldot mainnet deployment and runtime validation, the roadmap is to enable verified market contracts and asset listings, stronger source-aware market data, and persistent transaction indexing. iSwap and iBridge are planned modules: iSwap for supported asset swaps where pools and liquidity exist; iBridge for approved cross-network routes with clear source/destination assets, amounts, fees and transaction status. These are future goals, not live capabilities of the current demo.

## Product truth and safety

- pUSD is a test-only PASTX demo token, not USDC/USDT and not redeemable.
- pAAPL/pNVDA/pTSLA/pMSFT are synthetic test assets and do not confer equity ownership.
- Prices are owner-set demo prices, not live stock quotes, exchange prices or oracle prices.
- The current market contract is a fixed-price test market, not a live brokerage or full exchange order book.
- Portaldot is the core product network. BNB-side compiler/test sources are auxiliary development coverage, not evidence of a live Portaldot–BNB bridge.
- Contract addresses must be configured after a human-approved deployment. This change does not deploy contracts.

## Local development

Requirements: Node.js 22+ and pnpm 10.15.0.

```bash
pnpm install
pnpm dev
```

Landing page: `http://localhost:5173`; demo workspace: `http://localhost:5173/demo`; reference terminal: `http://localhost:5173/research`; API: `http://localhost:4000`.

## Checks

```bash
pnpm check
pnpm test
pnpm build
cd contracts/cross-chain
npm install
npm test
npm run compile:bnb
npm run compile:portal
```

BNB EVM tests do not prove Portaldot PolkaVM compatibility. Verify native-token semantics and the actual target runtime before deployment. No mainnet deployment or live bridge transfer is part of this branch.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Settlement](docs/SETTLEMENT-DESIGN.md) · [Hackathon requirements](docs/HACKATHON-REQUIREMENTS.md) · [Project status](docs/PROJECT-STATUS.md) · [Human validation](docs/HUMAN-VALIDATION-CHECKLIST.md) · [Market implementation](docs/PASTX-MARKET-IMPLEMENTATION.md) · [Contract package](contracts/cross-chain/README.md)
