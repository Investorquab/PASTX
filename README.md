# PASTX — Portaldot Asset & Stock Trading Exchange

**A testnet-first synthetic stock-market experience for Portaldot, designed toward cross-chain asset access.**

## Product
- Product landing page and Open Demo workspace.
- Wallet connection, Portaldot V3 / BNB testnet switching, native balances, configured pUSD balance and synthetic listings.
- Test market contracts for native-token and pUSD market buys/sells, escrowed limit orders, and cooldown faucet.
- iBridge route simulator for Portaldot ↔ BNB journeys. It never submits cross-chain transactions.
- Optional Fastify market-data API remains separate; external quotes are not required for demo-market prices.

> **Truthful status:** pUSD is a PASTX demo token, not USDC/USDT, and has no monetary value. pAAPL/pNVDA/pTSLA/pMSFT are synthetic test assets and do not confer equity ownership. Prices are owner-set demo prices, not live quotes. Contract addresses must be configured after a human-approved deployment; this change does not deploy contracts. The existing bridge relay is separate and is not called by iBridge.

## Local development
Requirements: Node.js 22+ and pnpm 10.15.0.
```bash
pnpm install
pnpm dev
```
Landing page: `http://localhost:5173`; click **Open demo**. The earlier reference-market terminal remains at `/research`; API defaults to `http://localhost:4000`.

## Contract configuration
After an explicitly approved deployment, create `apps/.env` (do not commit it):
```dotenv
VITE_PASTX_PORTAL_MARKET=
VITE_PASTX_PORTAL_TOKEN=
VITE_PASTX_PORTAL_FAUCET=
VITE_PASTX_BNB_MARKET=
VITE_PASTX_BNB_TOKEN=
VITE_PASTX_BNB_FAUCET=
```
Empty addresses mean not configured. Never put private keys or server API keys in `VITE_*` variables. BNB deployment remains subject to organizer approval; Portaldot is the required core target.

## Checks
```bash
pnpm --filter pastx-cross-chain-testnet-prototype test
pnpm --filter pastx-cross-chain-testnet-prototype compile:bnb
pnpm --filter pastx-cross-chain-testnet-prototype compile:portal
pnpm check
pnpm test
pnpm build
```
BNB EVM tests do not prove PolkaVM compatibility. Deploy only after the Portaldot target compiler/runtime and native-token semantics have been validated.

## Documentation
[Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Settlement](docs/SETTLEMENT-DESIGN.md) · [Hackathon requirements](docs/HACKATHON-REQUIREMENTS.md) · [Project status](docs/PROJECT-STATUS.md) · [Human validation](docs/HUMAN-VALIDATION-CHECKLIST.md) · [Market implementation](docs/PASTX-MARKET-IMPLEMENTATION.md) · [Cross-chain prototype](contracts/cross-chain/README.md)
