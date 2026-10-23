# PASTX Contract Library

This is the source-of-truth directory for the PASTX smart contracts. The contracts are separated by **network/runtime**, then by **contract responsibility**, so a judge can open each contract directly without digging through the deployment tooling.

## Layout

```text
contracts/
├── README.md
├── manifest.json
├── portaldot-v3/
│   ├── evm/
│   │   ├── pusd/PastxDemoToken.sol
│   │   ├── faucet/PastxFaucet.sol
│   │   ├── market/PastxMarket.sol
│   │   ├── stock-token/PastxStockToken.sol
│   │   ├── iswap/PastxISwap.sol
│   │   ├── bridge-escrow/PortalDotTestnetEscrow.sol
│   │   └── diagnostics/PortalValueSemanticsProbe.sol
│   ├── native-solang/
│   │   ├── pusd/PastxDemoToken.sol
│   │   ├── faucet/PastxFaucet.sol
│   │   ├── market/PastxMarket.sol
│   │   └── stock-token/PastxStockToken.sol
│   └── native-ink/PastxBudgetMarket/
│       ├── Cargo.toml
│       ├── lib.rs
│       ├── README.md
│       └── scripts/
└── bnb-testnet/
    └── evm/
        ├── pusd/PastxDemoToken.sol
        ├── faucet/PastxFaucet.sol
        ├── market/PastxMarket.sol
        ├── stock-token/PastxStockToken.sol
        └── bridge-gateway/BnbTestnetGateway.sol
```

`contracts/cross-chain/` is now the **tooling/control plane**: Hardhat configs, unit tests, deployment/probe scripts, the relayer, and native build helpers. Contract source-of-truth files live in the folders above. `manifest.json` lists every contract, its target runtime, its purpose, whether it belongs to the primary bridge deployment, and the command that builds or deploys its route.

## Which route should judges run?

The primary demonstration is **Portaldot V3 EVM → BNB testnet → Portaldot V3 EVM**:

1. Probe and verify the exact Portaldot EVM native `msg.value` mapping. This costs gas; the deposited test value is returned if the probe succeeds.
2. Deploy the Portaldot pUSD, market, faucet, individual synthetic stock-token contracts, and iSwap.
3. Deploy `PortalDotTestnetEscrow` on Portaldot V3 EVM.
4. Deploy `BnbTestnetGateway` on BNB testnet, configured to accept deposits from that exact escrow.
5. Start the trusted relayer in read-only/dry-run mode first, verify its keys and contract addresses, then explicitly enable testnet execution.
6. Demonstrate a 0.01 tPOT → 0.01 `wtPOTv3` → 0.01 tPOT round trip. Every leg must be supported by a successful transaction receipt and the matching contract event on the destination chain.

From the repository root, run all non-transactional checks first:

~~~powershell
npm --prefix contracts/cross-chain install --no-audit --no-fund
npm --prefix contracts/cross-chain run check
npm --prefix contracts/cross-chain test
npm --prefix contracts/cross-chain run preflight:all:testnet
~~~

When live value-semantics evidence is valid, the correct EVM accounts have sufficient gas on **both** networks, the local `.env` is configured, and the output directory has no prior/partial deployment record, the guarded one-command deployment is:

~~~powershell
npm --prefix contracts/cross-chain run deploy:all:testnet
~~~

The master command checks both networks, requires the exact interactive confirmation `DEPLOY PASTX TESTNET`, and then calls the market/iSwap, source escrow, and BNB gateway deployment scripts in dependency order. It writes a unified record to `contracts/cross-chain/deployments/all-testnet/`. It never starts the relayer or claims the round trip passed. If a stage fails after earlier transactions were confirmed, inspect the saved manifest before resuming; do not rerun blindly.

## Other routes are alternatives, not all part of one deployment

- **Native ink!:** one compact app-ledger contract at `portaldot-v3/native-ink/PastxBudgetMarket/lib.rs`. It is a budget-focused native Substrate demo, not the EVM pUSD token or bridge. It uses a separate artifact build and live storage-deposit preflight.
- **Native Solang:** four separate Solidity source contracts for the native Contracts pallet. This larger route has a significantly higher WASM code-deposit cost and is not included in the EVM `deploy:all:testnet` command.
- **BNB standalone demo market:** `npm --prefix contracts/cross-chain run deploy:market:bnb` deploys a separate synthetic-market demo. Its pUSD and stock contracts are not the Portaldot iSwap or the wrapped bridge token.

## Safety and product truth

All routes are testnet-only. pUSD is a faucet-funded demo token, not a fiat-backed stablecoin. Synthetic stock tokens do not represent equity. The bridge uses a trusted single relayer; there is no on-chain light-client proof. Do not use mainnet or valuable assets with these contracts.

Never commit or paste a mnemonic/private key. Keep credentials in the gitignored local `contracts/cross-chain/.env`. Don't set the native-value verification flag manually until the live probe report matches the exact deployment cap and its refund receipt has been checked.
