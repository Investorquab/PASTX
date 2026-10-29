<div align="center">

<img src="apps/web/public/favicon.svg" width="76" alt="PASTX logo" />

# PASTX

### Portaldot Asset & Stock Trading Exchange

**Trade synthetic stocks on-chain, settled on Portaldot — with a live cross-chain bridge to BNB and a transaction receipt for every action.**

[![Status](https://img.shields.io/badge/status-testnet%20live-00a879?style=for-the-badge)](#)
[![Portaldot V3](https://img.shields.io/badge/Portaldot%20V3-420420777-13241f?style=for-the-badge)](https://scanner-testnet-v3.portaldot.dev)
[![BNB Testnet](https://img.shields.io/badge/BNB%20Testnet-97-f0b90b?style=for-the-badge)](https://testnet.bscscan.com)

[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646cff)](https://vite.dev)
[![viem](https://img.shields.io/badge/viem-2-ffc517)](https://viem.sh)
[![polkadot-api](https://img.shields.io/badge/@polkadot/api-17-e6007a)](https://polkadot.js.org)
[![License](https://img.shields.io/badge/license-prototype-lightgrey)](#)

</div>

---

> ### ⚡ TL;DR
> PASTX is a **decentralized exchange for synthetic equities** on **Portaldot V3** (a Polkadot-SDK chain running the `pallet-revive` EVM). Connect a wallet, trade `pAAPL` / `pNVDA`, bridge your balance to **BNB Smart Chain**, and see **every transaction confirm on-chain with a one-click explorer link**.
>
> ⚠️ *Synthetic test assets on testnet — not real equities, not securities, no monetary value. Research/hackathon prototype.*

---

## 🎯 The problem & the idea

Trading real-world assets on-chain usually means trusting a centralized venue, and moving value between chains usually means a clunky, opaque bridge. **PASTX shows the full loop end-to-end on Portaldot**: a familiar stock-trading UI, native settlement on a Polkadot-SDK EVM chain, and a working bridge that mirrors your liquidity onto BNB — all with transparent, verifiable receipts a judge can click and confirm.

## ✨ Features at a glance

| | Feature | What it does |
|:--:|---|---|
| 📈 | **Synthetic equity trading** | Buy & sell `pAAPL` and `pNVDA` on a fixed-price, fully on-chain market. |
| 🔗 | **Dual-wallet model** | Trade with an **EVM wallet** (MetaMask · Rabby · OKX); fund & sign native transfers with a **Substrate wallet** (Polkadot.js · Talisman · SubWallet). |
| 💰 | **Substrate → EVM funding** | Top up your EVM trading account straight from your Substrate `5…` balance via Portaldot's address mapping. |
| 🌉 | **Cross-chain bridge** | Lock tPOT on Portaldot → receive 1:1 **wtPOT** on BNB to trade the mirrored market. |
| 🧾 | **Transaction receipts** | Every trade, approval, transfer, top-up & bridge step shows its **tx hash + a clickable block-explorer link**. |
| 📱 | **Responsive** | One product from wide desktop down to mobile. |

## 🌉 How the cross-chain bridge works

Move tPOT from Portaldot to BNB as **wtPOT**, 1:1. Each step is a real on-chain action you can verify in the explorer:

| Step | Chain | Action | Contract call | Result |
|:--:|:--|:--|:--|:--|
| **1 · Lock** | 🟢 Portaldot | You deposit tPOT into the escrow | `PortalDotBridgeEscrow.deposit()` → emits `DepositInitiated` | tPOT locked |
| **2 · Attest** | 🔁 Relayer | Trusted relayer observes the deposit event | off-chain watcher (`services/relayer`) | deposit verified |
| **3 · Mint** | 🟡 BNB | Relayer mints the matching wtPOT to **you** | `BnbBridgeGateway.completeDeposit()` | 1:1 wtPOT received |
| **4 · Trade** | 🟡 BNB | You trade the mirrored market in wtPOT | `BnbWrappedPotMarket.buy()` / `sell()` | position opened |

```
   YOU (tPOT)                                            YOU (wtPOT)
      │                                                       ▲
      │ 1. deposit()                             3. completeDeposit()
      ▼                                                       │
 ┌─────────────────────┐    2. watch event    ┌───────────────────────┐
 │ PortalDotBridgeEscrow│ ───────────────────► │   BnbBridgeGateway     │
 │     (Portaldot V3)   │   trusted relayer    │   (BNB Smart Chain)    │
 └─────────────────────┘                       └───────────────────────┘
```

> 🔒 **Trust model (stated honestly):** the bridge is an **explicitly trusted, single-relayer prototype** — not a trustless bridge. It demonstrates the full cross-chain flow; trust-minimization is on the [roadmap](#-roadmap--the-future-of-pastx).

## 🧾 Transaction transparency

PASTX never asks you to take its word for it. After **every** action, the UI surfaces the exact transaction and a direct explorer link:

- **Portaldot EVM** → `scanner-testnet-v3.portaldot.dev/tx/<hash>`
- **BNB** → `testnet.bscscan.com/tx/<hash>`
- **Substrate** (funding & native transfers) → `scanner-testnet-v3.portaldot.dev/extrinsics/<hash>`

Copy the hash or click **view ↗** — a judge can confirm any claim on-chain in one click.

## 🏗️ Architecture

pnpm monorepo:

```
apps/web            React 19 + Vite 7 SPA — the trading app (viem + @polkadot/api)
services/relayer    Node watcher: Portaldot escrow → BNB gateway (mints wtPOT)
contracts/          Solidity contracts, deploy scripts & on-chain validation
packages/shared     Shared market types & helpers
```

The **frontend talks directly to each chain's RPC** — `viem` for EVM, `@polkadot/api` for Substrate. Trading, transfers and top-ups need **no backend at all**. The only server-side piece is the bridge **relayer**.

## 📍 Deployed contracts (testnet)

**🟢 Portaldot V3** — chain `420420777` · RPC `https://test-evm-rpc-v3.portaldot.dev` · explorer [`scanner-testnet-v3`](https://scanner-testnet-v3.portaldot.dev)

| Contract | Address |
|---|---|
| PortalDotNativeMarket | `0x2f85A292316f0B3385F0B5499b3490d33E958407` |
| pAAPL · synthetic Apple | `0x2eE620904288455e79be88cd6cf383b6685dd652` |
| pNVDA · synthetic Nvidia | `0x4B4535eD1825ef147c32aa58d9848e624C33C2E3` |
| PortalDotBridgeEscrow | `0x024b77EBbF04f48a0d921094f7000b18063bdD69` |

**🟡 BNB Smart Chain testnet** — chain `97` · explorer [`testnet.bscscan.com`](https://testnet.bscscan.com)

| Contract | Address |
|---|---|
| BnbBridgeGateway | `0xd81133c76289Df27105E8aF15579631fE305F9E1` |
| WrappedPot · wtPOT | `0xda7C743A57b2478b801Ab12cDB1f0245b7817Fb9` |
| BnbWrappedPotMarket | `0x39f98C838273F29E1095440Eb4411AfeFC2C546c` |
| bAAPL / bNVDA | `0xa4722Db67…c327a7` / `0x7592Ba53…8Dca41` |

## 🚀 Quickstart

**Prerequisites:** Node ≥ 22 · `pnpm` · an EVM wallet (e.g. MetaMask) · a Substrate wallet (e.g. Polkadot.js) · some testnet tPOT.

```bash
pnpm install

# run the trading app → http://localhost:5173  (dashboard at /demo)
pnpm --filter @pastx/web dev

# OPTIONAL — bridge relayer, only needed for the Bridge tab
#   set PASTX_BNB_RELAYER_PRIVATE_KEY in a root .env (see .env.example)
node services/relayer/index.mjs
```

Open **`/demo`**, connect your wallet, and trade. RPCs, addresses and explorer URLs ship as defaults; override any with `VITE_PASTX_*` env vars (see `.env.example`).

## ☁️ Deployment

The app is a **static SPA — deploy to Vercel with zero backend.** The included `vercel.json` builds `apps/web` from the monorepo root and rewrites all routes to `index.html` for client-side routing.

| Part | Needs a server? | Where it runs |
|---|:--:|---|
| Trading, transfers, top-ups | ❌ No | **Vercel** (static) |
| Cross-chain **bridge** relayer | ✅ Yes (always-on) | Railway / Render / Fly.io / VPS — **or run locally during a demo** |

> The relayer holds a signing key and continuously watches for events, so it **cannot** run on Vercel's serverless runtime and its key must **never** reach the frontend.

## 🧭 Roadmap — the future of PASTX

- 🔐 **Trust-minimized bridge** — replace the single relayer with a multi-sig / light-client / proof-based path.
- 📊 **Dynamic pricing** — move from fixed-price listings to an order book or AMM curve.
- 🏦 **More assets & chains** — grow the synthetic-equity universe and add settlement chains.
- 🚀 **Mainnet** — graduate from the V3 testnet to Portaldot mainnet (`scanner-live-v3.portaldot.dev`).
- ⚡ **Performance** — route-level code-splitting to shrink the initial bundle.
- 📱 **Mobile wallet** — deeper Portaldot mobile-wallet integration.

## 🛠️ Tech stack

`React 19` · `Vite 7` · `TypeScript` · `viem` · `@polkadot/api` · `pnpm workspaces` · `Solidity` · `pallet-revive (PolkaVM)` · `BNB Smart Chain`

---

<div align="center">
<sub>Built for the Portaldot ecosystem · Synthetic test assets only — not investment advice, not real securities.</sub>
</div>
