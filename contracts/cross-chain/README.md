# PASTX Cross-Chain Testnet Prototype

**Status: prototype source and local tests; not deployed and not production-ready.** This package is intentionally isolated from the market-data application. It provides a testnet-only source escrow, BNB testnet representation and mock stock market, and a trusted relayer prototype.

## What this is intended to demonstrate

- a native-value deposit event on PortalDOT V3;
- source transaction/receipt checks and configurable confirmation-depth waiting by a relayer;
- replay protection and source-event identity checks in the destination gateway;
- minting of a 1:1 raw-unit `wtPOTv3` test representation on BNB testnet;
- buy/sell of mock stock positions priced in test units;
- burn-and-request withdrawal back to PortalDOT V3, with releases limited by the source escrow balance and cumulative deposits.

**Important:** `wtPOTv3` is a test representation, not native BNB, USDT, or a real-valued asset. Test BNB is needed for destination gas. The mock market is not the official bStocks market, and its symbols are `AAPL-TEST`, `TSLA-TEST`, `NVDA-TEST`, and `MSFT-TEST`. Prices are owner-controlled demo values, not a live oracle or executable real-world stock quotes. Seeded market liquidity is minted test value and is not redeemable.

## Trust and security model

The configured relayer is trusted to attest that a source event exists. The contracts do **not** independently verify a cross-chain light-client proof. A compromised relayer can mint unbacked test representations and release escrow, bounded by the prototype's test accounting. This package must never accept valuable mainnet funds.

Other limitations:
- The source relay waits a configurable block-confirmation depth, not a verified PortalDOT finality proof.
- Scan cursors are held in process memory. On restart the operator should choose a reviewed start block; destination contract replay protection prevents the same recorded deposit from minting twice.
- Source native EVM amount semantics and tPOTv3 decimals must be verified on the live V3 testnet before a small test deposit.
- No official bStocks BNB-testnet deployment or liquidity was identified for this prototype.
- Price changes are admin-controlled. There is no production price oracle, broker, issuer, custody provider, or real stock-ownership claim.
- No audited validator set, threshold signing, fraud proof, light client, production recovery/migration design, or external security review is included.

## Networks and tooling

- Node.js 22+
- npm 10.9+
- PortalDOT V3 EVM RPC: `https://test-evm-rpc-v3.portaldot.dev`, chain ID `420420777`
- BNB Smart Chain testnet RPC: `https://bsc-testnet-dataseed.bnbchain.org`, chain ID `97`
- Faucet test tokens have no financial value.

The PortalDOT PVM compile target uses [Parity's Hardhat Polkadot plugin](https://docs.polkadot.com/smart-contracts/dev-environments/hardhat/) and `resolc`; the BNB target uses standard EVM bytecode. A separate local EVM unit model with chain ID 420420777 tests source escrow logic, but it does **not** emulate PortalDOT PolkaVM.

## Install and validate

From this directory:

```bash
npm install
npm run check
npm test
npm run compile:bnb
npm run compile:portal
```

The unit tests use local Hardhat EVM networks only. The PortalDOT command compiles for PolkaVM; it does not deploy the contract or prove runtime behavior on the live V3 testnet.

## Configure deployments

Copy `.env.example` to `.env` in this directory. Never commit `.env`; never paste keys into chat.

1. Fund testnet-only deployer accounts for PortalDOT V3 and BNB testnet.
2. Choose testnet relayer accounts and set each configured address before deployment.
3. Compile and deploy the source escrow:
   ```bash
   npm run deploy:portal
   ```
   Copy the printed source contract address and deployment block into `PASTX_PORTALDOT_ESCROW_ADDRESS` and `PASTX_PORTALDOT_SCAN_FROM_BLOCK`.
4. Deploy the BNB testnet gateway:
   ```bash
   npm run deploy:bnb
   ```
   Copy its address and deployment block into `PASTX_BNB_GATEWAY_ADDRESS` and `PASTX_BNB_SCAN_FROM_BLOCK`.
5. Optionally seed a small mock liquidity reserve with `PASTX_DEMO_MARKET_SEED_RAW`. This amount is simulated test liquidity only.

Both deployment scripts refuse unexpected chain IDs. The source contract enforces PortalDOT V3 EVM chain ID 420420777; the destination gateway enforces BSC testnet chain ID 97.

## Run the relayer

Start in read-only mode first:

```bash
npm run relay
```

The relayer checks the expected RPC chain IDs, source/destination contract configuration, relayer addresses when execution is enabled, source transaction receipts and configured confirmation depth. Dry-run mode logs candidate operations but submits no transactions.

Only after manual review of deployments, source and destination events, relayer addresses, amount semantics, and contract behavior should you set `PASTX_RELAY_EXECUTE=true` with the two testnet relayer keys in the local `.env`. Never enable execution for mainnet endpoints or valuable assets.

## Connect the PASTX demo UI

After both contracts are deployed and verified, add their public addresses to the local root `.env`:

```bash
VITE_PASTX_PORTALDOT_ESCROW_ADDRESS=0x...
VITE_PASTX_BNB_GATEWAY_ADDRESS=0x...
VITE_PASTX_SOURCE_VALUE_SEMANTICS_VERIFIED=false
```

Keep the final setting false until a manual, deliberately small source deposit confirms the V3 EVM balance, wallet mapping, transaction value, emitted amount and escrow balance. Only then may the operator set it to true locally; restart Vite after environment changes.

Connect an injected EVM wallet, switch to PortalDOT V3, initiate a test deposit, wait for the relay, switch to BNB testnet, refresh `wtPOTv3`, then trade mock stock and request a return. The UI does not custody keys, replace the relay, convert tPOTv3 into native tBNB/USDT, or use the official iBridge route.

## Explorer evidence to capture

For each end-to-end demo, record:
- PortalDOT source deposit tx and block;
- source escrow address and deployment tx;
- BNB gateway address and deployment tx;
- relayer log showing event/confirmation verification;
- BNB destination completion tx and `wtPOTv3` balance change;
- mock buy/sell transaction hashes, positions and balances;
- BNB withdrawal-request tx and PortalDOT release tx.

Do not claim the bridge is live until these real network transactions have been observed and verified. The root README records the intended production route and the unresolved official iBridge/iSwap integration gate.
