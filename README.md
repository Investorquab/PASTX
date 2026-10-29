<div align="center">

<img src="apps/web/public/favicon.svg" width="88" alt="PASTX logo" />

# PASTX

### Portaldot Asset & Stock Trading Exchange

#### *Real stock-market UX. On-chain settlement. Cross-chain by design.*

**PASTX brings the familiar experience of trading stocks, a portfolio, a live market and a buy/sell ticket, fully on-chain: settled natively on [Portaldot](https://portaldot.dev) and bridged live to BNB Smart Chain. Every single action returns a transaction hash and a one-click explorer link, so nothing has to be taken on trust.**

<br/>

[![Status](https://img.shields.io/badge/STATUS-TESTNET%20LIVE-00a879?style=for-the-badge&labelColor=13241f)](https://pastx.vercel.app)
[![Live Demo](https://img.shields.io/badge/LIVE%20DEMO-pastx.vercel.app-00a879?style=for-the-badge&labelColor=13241f)](https://pastx.vercel.app)
<br/>
[![Portaldot V3](https://img.shields.io/badge/Portaldot%20V3-chain%20420420777-13241f?style=flat-square)](https://scanner-testnet-v3.portaldot.dev)
[![BNB Testnet](https://img.shields.io/badge/BNB%20Testnet-chain%2097-f0b90b?style=flat-square)](https://testnet.bscscan.com)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?style=flat-square)](https://vite.dev)
[![viem](https://img.shields.io/badge/viem-2-ffc517?style=flat-square)](https://viem.sh)
[![polkadot-api](https://img.shields.io/badge/@polkadot/api-17-e6007a?style=flat-square)](https://polkadot.js.org)
[![pallet-revive](https://img.shields.io/badge/pallet--revive-PolkaVM-e6007a?style=flat-square)](https://github.com/paritytech/polkadot-sdk)

</div>

---

> ## ⚡ 30-second overview
> **What:** a decentralized exchange for **synthetic equities** (`pAAPL`, `pNVDA`) with a **working cross-chain bridge**.
> **Where:** **Portaldot V3**, a Polkadot-SDK chain running the **`pallet-revive` EVM**, mirrored onto **BNB Smart Chain**.
> **Why it's different:** it's not a mock-up. You connect a real wallet, sign real transactions, move real (testnet) value across two chains, and **verify every step on a block explorer**.
>
> 👉 **Try it:** **[pastx.vercel.app](https://pastx.vercel.app)** → open `/demo` → connect → trade.
>
> ⚠️ *Synthetic test assets on testnet only. Not real equities, not securities, no monetary value. A hackathon research prototype.*

---

## 📖 Table of contents

| | | |
|---|---|---|
| [🎯 Why we built PASTX](#-why-we-built-pastx) | [✨ What we built](#-what-we-built) | [🌉 The cross-chain bridge](#-the-cross-chain-bridge) |
| [🧾 Radical transparency](#-radical-transparency) | [🏗️ Architecture](#️-architecture) | [📍 Deployed contracts](#-deployed-contracts-testnet) |
| [🚀 Quickstart](#-quickstart) | [☁️ Deployment](#️-deployment) | [🔐 Security & trust model](#-security--trust-model) |
| [🧭 The future of PASTX](#-the-future-of-pastx) | [🛠️ Tech stack](#️-tech-stack) | [⚖️ Disclaimer](#️-disclaimer) |

---

## 🎯 Why we built PASTX

Access to equity markets is still **gated**: by geography, by brokers, by minimums, by hours, by intermediaries who sit between you and the asset. And the web3 answer to "move value between chains" is usually a **black-box bridge** you have to trust blindly.

We set out to prove a single, ambitious idea on Portaldot:

> **You can deliver a polished, stock-market-grade trading experience that is fully on-chain, settles natively on a Polkadot-SDK chain, moves liquidity across ecosystems, and is auditable at every step, today.**

PASTX is the proof. It shows that Portaldot's `pallet-revive` EVM can run standard Solidity markets, that a Substrate-native chain can host a familiar DeFi UX, and that cross-chain value transfer can be **transparent and verifiable** rather than opaque. This is a foundation we intend to grow into a serious, trust-minimized, multi-asset exchange.

---

## ✨ What we built

A complete, end-to-end product, not a slide deck. Here is everything in the box:

### 🏦 The trading exchange

| Capability | Details |
|---|---|
| 📈 **Synthetic equity markets** | Buy & sell `pAAPL` (synthetic Apple) and `pNVDA` (synthetic Nvidia) against a fixed-price, fully on-chain market contract. |
| 💼 **Live portfolio** | Real-time balances across **tPOT** (Portaldot), **wtPOT** (BNB), **tBNB** (gas) and every open position, read straight from chain. |
| 🧮 **Order ticket** | Pick an asset, set share count, see cost and holdings, and execute - with inline status for approvals and confirmations. |
| 🔴 **Live network indicator** | A ticking block number shows the chain is live and the app is connected. |

### 🔗 The wallet layer

| Capability | Details |
|---|---|
| 🦊 **EVM wallets** | MetaMask · Rabby · OKX - discovered via EIP-6963, used to sign trades on **both** chains. |
| 🟣 **Substrate wallets** | Polkadot.js · Talisman · SubWallet - used to **fund** your EVM account and sign **native** tPOT transfers. |
| 🔁 **Automatic network switching** | The app adds/switches to Portaldot or BNB in your wallet as needed. |
| 🏷️ **Address mapping** | Your EVM `0x…` account maps deterministically to its backing Substrate `5…` account - fund one, trade with the other. |

### 💸 Movement of value

| Capability | Details |
|---|---|
| ⬆️ **Substrate → EVM top-up** | Send native tPOT from your `5…` wallet straight into your EVM trading balance. |
| ➡️ **Transfers** | Send tPOT, wtPOT or tBNB to any EVM address, or native tPOT to any Substrate address. |
| 🌉 **Cross-chain bridge** | Lock tPOT on Portaldot → receive 1:1 **wtPOT** on BNB to trade the mirrored market. |

### 🧾 Trust & transparency

| Capability | Details |
|---|---|
| 🔎 **Transaction receipts** | **Every** trade, approval, transfer, top-up and bridge step surfaces its **tx hash + copy button + clickable explorer link**. |
| 🏛️ **Honest labelling** | Synthetic assets and the trusted-relayer bridge are clearly marked in the UI - no overstated claims. |
| 📱 **Responsive design** | One coherent product from wide desktop down to a phone. |

---

## 🌉 The cross-chain bridge

Move tPOT from Portaldot to BNB as **wtPOT**, 1:1. Every step is a real on-chain action you can open in the explorer:

| Step | Chain | What happens | Contract call | Result |
|:--:|:--|:--|:--|:--|
| **1 · Lock** | 🟢 Portaldot | You deposit tPOT into the escrow | `PortalDotBridgeEscrow.deposit()` → emits `DepositInitiated` | 🔒 tPOT locked |
| **2 · Attest** | 🔁 Relayer | The relayer observes the deposit event | off-chain watcher - [`services/relayer`](services/relayer) | 👀 deposit verified |
| **3 · Mint** | 🟡 BNB | The relayer mints matching wtPOT to **you** | `BnbBridgeGateway.completeDeposit()` | 🪙 1:1 wtPOT received |
| **4 · Trade** | 🟡 BNB | You trade the mirrored market in wtPOT | `BnbWrappedPotMarket.buy()` / `sell()` | 📈 position opened |

```
      YOU (tPOT)                                                   YOU (wtPOT)
          │                                                            ▲
          │  1. deposit()                                3. completeDeposit()
          ▼                                                            │
  ┌──────────────────────┐      2. watch DepositInitiated     ┌──────────────────────┐
  │ PortalDotBridgeEscrow │ ─────────────────────────────────► │   BnbBridgeGateway    │
  │     Portaldot V3      │        trusted relayer wallet       │   BNB Smart Chain     │
  └──────────────────────┘                                     └──────────────────────┘
```

> 🔒 **We state the trust model plainly:** this is an **explicitly trusted, single-relayer** bridge, **not** trustless. It faithfully demonstrates the full cross-chain lifecycle; making it trust-minimized is the headline item on our [roadmap](#-the-future-of-pastx).

---

## 🧾 Radical transparency

PASTX never asks you to take its word for anything. After **every** action the UI shows the exact transaction and a direct explorer link:

| Action type | Explorer link format |
|---|---|
| Portaldot EVM (trade, bridge, transfer) | `scanner-testnet-v3.portaldot.dev/tx/<hash>` |
| BNB (trade, approve, transfer) | `testnet.bscscan.com/tx/<hash>` |
| Substrate (funding & native transfers) | `scanner-testnet-v3.portaldot.dev/extrinsics/<hash>` |

Copy the hash, or click **view ↗**: a judge, an auditor, or a user can verify any claim on-chain in a single click. **This is the heart of the product: provable, not promised.**

---

## 🏗️ Architecture

A clean **pnpm monorepo**:

```
PASTX/
├── apps/
│   └── web/            React 19 + Vite 7 SPA - the trading app (viem + @polkadot/api)
├── services/
│   └── relayer/        Always-on Node watcher: Portaldot escrow → BNB gateway (mints wtPOT)
├── contracts/          Solidity contracts, deploy scripts & on-chain validation harness
└── packages/
    └── shared/         Shared market types & helpers
```

The **frontend talks directly to each chain's RPC**: `viem` for EVM, `@polkadot/api` for Substrate. Trading, transfers and top-ups require **no backend at all**. The **only** server-side component is the bridge **relayer**.

---

## 📍 Deployed contracts (testnet)

### 🟢 Portaldot V3
`chain 420420777` · RPC `https://test-evm-rpc-v3.portaldot.dev` · explorer [`scanner-testnet-v3`](https://scanner-testnet-v3.portaldot.dev)

| Contract | Role | Address |
|---|---|---|
| **PortalDotNativeMarket** | Fixed-price synthetic-stock market, settled in native tPOT | `0x2f85A292316f0B3385F0B5499b3490d33E958407` |
| **pAAPL** | Synthetic Apple share token | `0x2eE620904288455e79be88cd6cf383b6685dd652` |
| **pNVDA** | Synthetic Nvidia share token | `0x4B4535eD1825ef147c32aa58d9848e624C33C2E3` |
| **PortalDotBridgeEscrow** | Locks tPOT, emits deposit events | `0x024b77EBbF04f48a0d921094f7000b18063bdD69` |

### 🟡 BNB Smart Chain testnet
`chain 97` · explorer [`testnet.bscscan.com`](https://testnet.bscscan.com)

| Contract | Role | Address |
|---|---|---|
| **BnbBridgeGateway** | Mints wtPOT 1:1 on verified deposits | `0xd81133c76289Df27105E8aF15579631fE305F9E1` |
| **WrappedPot (wtPOT)** | Bridged tPOT, ERC-20 | `0xda7C743A57b2478b801Ab12cDB1f0245b7817Fb9` |
| **BnbWrappedPotMarket** | Mirrored market, settled in wtPOT | `0x39f98C838273F29E1095440Eb4411AfeFC2C546c` |
| **bAAPL / bNVDA** | Synthetic shares on BNB | `0xa4722Db67…c327a7` / `0x7592Ba53…8Dca41` |

---

## 🚀 Quickstart

**Prerequisites:** Node ≥ 22 · `pnpm` · an EVM wallet (e.g. MetaMask) · a Substrate wallet (e.g. Polkadot.js) · some testnet tPOT.

```bash
pnpm install

# run the trading app → http://localhost:5173  (dashboard at /demo)
pnpm --filter @pastx/web dev
```

Open **`/demo`**, connect your wallet, and trade. RPCs, addresses and explorer URLs ship as defaults; override any with `VITE_PASTX_*` env vars (see `.env.example`).

> **Want the Bridge tab to work too?** Run the relayer; see **[services/relayer/README.md](services/relayer/README.md)** for local and VPS (pm2) instructions.

---

## ☁️ Deployment

The app is a **static SPA, so it deploys to Vercel with zero backend.** The included `vercel.json` builds `apps/web` from the monorepo root and rewrites all routes to `index.html` for client-side routing.

| Part of PASTX | Needs a server? | Where it runs |
|---|:--:|---|
| Trading · transfers · top-ups | ❌ **No** | **Vercel** (static CDN) |
| Cross-chain **bridge relayer** | ✅ **Yes** (always-on) | A VPS under **pm2** (or Railway / Render / Fly.io); see [services/relayer](services/relayer) |

> The relayer holds a signing key and continuously watches for events, so it **cannot** run on Vercel's serverless runtime, and its key must **never** reach the frontend. On our deployment it runs under **pm2** on a VPS so the bridge stays live for everyone.

---

## 🔐 Security & trust model

We are deliberate and honest about what is and isn't guaranteed:

- 🧪 **Testnet only.** Assets are synthetic and carry no monetary value.
- 🔑 **No secrets in the client.** The frontend never holds a server key. The relayer's key lives only in its own gitignored `.env` on the server.
- 🔁 **Trusted relayer (stated).** The bridge currently relies on a single authorized relayer wallet, a clearly-labelled prototype, not a trustless bridge.
- 🧾 **Verifiable by design.** Every action is a real transaction you can independently confirm on a public explorer.
- 🛡️ **Non-transferable share tokens.** Synthetic shares move only to/from the authorized market, preventing out-of-band transfers.

---

## 🧭 The future of PASTX

We built PASTX to be a **foundation, not a one-off demo.** Where we're taking it:

### Phase 1: Harden the core
- 🔐 **Trust-minimized bridge**: replace the single relayer with a **multi-sig / light-client / proof-based** attestation path, removing the trusted party.
- 🧪 **Expanded test & audit coverage**: grow the on-chain validation harness toward audit-readiness.

### Phase 2: Grow the market
- 📊 **Dynamic pricing**: move from fixed-price listings to an **order book or AMM** curve for real price discovery.
- 🏦 **More assets**: a larger synthetic-equity universe, indices, and potentially other asset classes.
- 🌐 **More chains**: additional settlement chains beyond BNB, leaning into Portaldot's cross-chain strengths.

### Phase 3: Go live & go wide
- 🚀 **Mainnet**: graduate from the V3 testnet to **Portaldot mainnet** (`scanner-live-v3.portaldot.dev`).
- 📱 **Mobile**: deeper integration with the **Portaldot mobile wallet** for trading on the go.
- ⚡ **Performance**: route-level code-splitting and caching for instant loads at scale.
- 🧑‍🤝‍🧑 **Community & liquidity**: incentives, market-maker tooling, and onboarding flows.

**Our thesis:** the next wave of on-chain finance will be judged on **accessibility and verifiability**. PASTX is our bet that a Polkadot-SDK chain like Portaldot is the right place to build it.

---

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 · Vite 7 · TypeScript |
| **Chain I/O** | `viem` (EVM) · `@polkadot/api` (Substrate) · EIP-6963 wallet discovery |
| **Smart contracts** | Solidity on **`pallet-revive` (PolkaVM)** + BNB Smart Chain |
| **Backend** | Node (bridge relayer only) · pm2 |
| **Tooling** | pnpm workspaces · Vercel |

---

## ⚖️ Disclaimer

PASTX is a **research / hackathon prototype on public testnets**. The "stocks" are **synthetic test tokens** with **no monetary value** and **no connection** to the real companies named. Nothing here is **investment advice**, a **security**, or an **offer**. The cross-chain bridge is an explicitly **trusted** prototype. Do not reuse testnet keys or mnemonics for anything of value.

---

<div align="center">

**Built for the Portaldot ecosystem.**

<sub>On-chain markets · verifiable by design · cross-chain by nature.</sub>

</div>
