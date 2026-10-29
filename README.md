<div align="center">

# PASTX — Portaldot Asset & Stock Trading Exchange

**On-chain synthetic-equity trading, settled on Portaldot — with a live cross-chain bridge to BNB.**

Buy and sell synthetic stocks (pAAPL, pNVDA) on the **Portaldot V3** testnet, bridge liquidity to **BNB Smart Chain**, and watch every transaction confirm on-chain with a one-click explorer link.

![Status](https://img.shields.io/badge/status-testnet%20live-00a879)
![Portaldot](https://img.shields.io/badge/Portaldot%20V3-chain%20420420777-13241f)
![BNB](https://img.shields.io/badge/BNB%20testnet-chain%2097-f3ba2f)
![Stack](https://img.shields.io/badge/React%2019%20·%20Vite%207%20·%20viem%20·%20polkadot--api-informational)

</div>

---

## What is PASTX?

PASTX is a **decentralized exchange for synthetic equities** built for the Portaldot ecosystem. It brings a familiar stock-trading experience — a portfolio, a market table, a buy/sell ticket — to a **Polkadot-SDK chain running `pallet-revive`** (EVM-compatible), and extends it across chains with a working bridge.

Two markets run the same assets:

- **Portaldot V3** — a fixed-price synthetic-stock market settled in the chain's native token **tPOT**.
- **BNB Smart Chain testnet** — a mirrored market settled in **wtPOT** (wrapped tPOT), minted by the cross-chain bridge.

> ⚠️ **These are synthetic test assets on a testnet — not real equities, securities, or financial instruments, and they carry no monetary value.** PASTX is a research/hackathon prototype.

## Key features

| | |
|---|---|
| 📈 **Synthetic equity trading** | Buy/sell `pAAPL` & `pNVDA` against a fixed-price on-chain market. |
| 🔗 **Dual-wallet model** | Trade with an **EVM wallet** (MetaMask · Rabby · OKX); fund and sign native transfers with a **Substrate wallet** (Polkadot.js · Talisman · SubWallet). |
| 💰 **Substrate → EVM funding** | Top up your EVM trading account directly from your Substrate `5…` balance via Portaldot's address mapping. |
| 🌉 **Cross-chain bridge** | Lock tPOT in the Portaldot escrow; a relayer mints 1:1 **wtPOT** on BNB so you can trade the mirrored market. |
| 🧾 **Transaction receipts** | Every trade, transfer, approval, top-up and bridge action surfaces its **tx hash + a clickable block-explorer link**. |
| 📱 **Responsive UI** | Works from wide desktop down to mobile. |

## How it works

```
 Substrate wallet (5…)                 EVM wallet (0x…)
        │  transfer tPOT to mapped addr        │
        ▼                                       ▼
 ┌──────────────────── Portaldot V3 (pallet-revive EVM) ────────────────────┐
 │  PortalDotNativeMarket  ── buy/sell pAAPL, pNVDA, settled in tPOT         │
 │  PortalDotBridgeEscrow  ── lock tPOT  ──►  emits DepositInitiated         │
 └───────────────────────────────────────────┬──────────────────────────────┘
                                              │  trusted relayer
                                              ▼
 ┌──────────────────────────── BNB Smart Chain testnet ──────────────────────┐
 │  BnbBridgeGateway  ── completeDeposit  ──►  mints wtPOT (1:1)              │
 │  BnbWrappedPotMarket  ── buy/sell bAAPL, bNVDA, settled in wtPOT          │
 └───────────────────────────────────────────────────────────────────────────┘
```

The bridge is an **explicitly trusted, single-relayer prototype** — not a trustless bridge. It demonstrates the cross-chain flow; hardening it is on the roadmap below.

## Architecture

pnpm monorepo:

```
apps/web            React 19 + Vite 7 SPA (the trading app) — viem + @polkadot/api
services/relayer    Node watcher: Portaldot escrow → BNB gateway (mints wtPOT)
contracts/          Solidity contracts, deploy scripts & on-chain validation
packages/shared     Shared market types/helpers
```

**Frontend** talks directly to each chain's RPC via `viem` (EVM) and `@polkadot/api` (Substrate) — no custom backend is required for trading, transfers or top-ups. The only server-side component is the bridge **relayer**.

## Deployed contracts (testnet)

**Portaldot V3** — chain `420420777`, EVM RPC `https://test-evm-rpc-v3.portaldot.dev`, explorer `https://scanner-testnet-v3.portaldot.dev`

| Contract | Address |
|---|---|
| PortalDotNativeMarket | `0x2f85A292316f0B3385F0B5499b3490d33E958407` |
| pAAPL (synthetic Apple) | `0x2eE620904288455e79be88cd6cf383b6685dd652` |
| pNVDA (synthetic Nvidia) | `0x4B4535eD1825ef147c32aa58d9848e624C33C2E3` |
| PortalDotBridgeEscrow | `0x024b77EBbF04f48a0d921094f7000b18063bdD69` |

**BNB Smart Chain testnet** — chain `97`, explorer `https://testnet.bscscan.com`

| Contract | Address |
|---|---|
| BnbBridgeGateway | `0xd81133c76289Df27105E8aF15579631fE305F9E1` |
| WrappedPot (wtPOT) | `0xda7C743A57b2478b801Ab12cDB1f0245b7817Fb9` |
| BnbWrappedPotMarket | `0x39f98C838273F29E1095440Eb4411AfeFC2C546c` |
| bAAPL / bNVDA | `0xa4722Db67CD3C83798396aa2Ba360c0963c327a7` / `0x7592Ba534c0937061f29ec73b950bF619F8Dca41` |

## Quickstart

**Prerequisites:** Node ≥ 22, `pnpm`, an EVM wallet (e.g. MetaMask) and a Substrate wallet (e.g. Polkadot.js) browser extension, plus some testnet tPOT.

```bash
pnpm install

# run the trading app (http://localhost:5173 — dashboard at /demo)
pnpm --filter @pastx/web dev

# (optional) run the bridge relayer — needed only for the cross-chain Bridge tab
#   set PASTX_BNB_RELAYER_PRIVATE_KEY in a root .env first (see .env.example)
node services/relayer/index.mjs
```

Open **`/demo`**, connect your wallet, and trade. Chain RPCs, contract addresses and explorer URLs ship as defaults and can be overridden with `VITE_PASTX_*` environment variables (see `.env.example`).

## Deployment

The app is a static SPA and deploys to **Vercel** (or any static host) with zero backend:

- `vercel.json` (included) builds `apps/web` from the monorepo root and rewrites all routes to `index.html` for client-side routing.
- **No server is needed for trading, transfers, or top-ups.**
- The **bridge relayer is the only backend** and must run as an always-on process (Railway, Render, Fly.io, a VPS, or locally during a demo) because it continuously watches for deposit events and holds a signing key. It must **not** be deployed to Vercel's serverless runtime, and its private key must never be exposed to the frontend.

## Roadmap — the future of PASTX

- **Trust-minimized bridge** — replace the single relayer with a multi-sig / light-client / proof-based attestation path.
- **Dynamic pricing** — move from fixed-price listings to an order book or AMM-style curve.
- **More assets & markets** — expand the synthetic-equity universe and add more settlement chains.
- **Mainnet** — graduate from the V3 testnet to Portaldot mainnet (`scanner-live-v3.portaldot.dev`).
- **Performance** — route-level code-splitting to shrink the initial bundle.
- **Mobile wallet** — deeper integration with the Portaldot mobile wallet.

## Tech stack

`React 19` · `Vite 7` · `TypeScript` · `viem` · `@polkadot/api` · `pnpm workspaces` · `Solidity` · `pallet-revive (PolkaVM)` · `BNB Smart Chain`

---

<div align="center">
<sub>Built for the Portaldot ecosystem. Synthetic test assets only — not investment advice, not real securities.</sub>
</div>
