# Frontend Integration Contract

This document is the intended interface contract for the later `/demo` redesign. Do not wire the current app to guessed addresses.

## Portaldot market

- Chain ID: `420420777`
- RPC: `https://test-evm-rpc-v3.portaldot.dev`
- Native asset: tPOTv3 (14 decimals for wallet display; EVM `msg.value` uses chain base units)
- Market methods: `configureListing`, `addLiquidity`, `withdrawLiquidity`, `buy`, `sell`, `setPaused`
- Read: `owner`, `paused`, `listings(symbol)`, `positions(wallet,symbol)`, `address(market).balance`
- Trade events: `TradeExecuted`, `ListingConfigured`

## BNB testnet market

- Chain ID: `97`
- RPC: `https://bsc-testnet-dataseed.bnbchain.org`
- Native gas asset: tBNB
- Payment token: wtPOT, 18 decimals
- Market methods: `configureListing`, `addLiquidity`, `withdrawLiquidity`, `buy`, `sell`, `setPaused`
- Read: `wrappedPot.balanceOf(wallet)`, `listings(symbol)`, `positions(wallet,symbol)`, `wrappedPot.balanceOf(market)`
- Before buying: approve the market to spend wtPOT.
- Before selling: approve the market to spend the stock token.

## Bridge UX

1. User signs `PortalDotBridgeEscrow.deposit(bnbRecipient)` with native tPOT value on Portaldot.
2. Wait for source receipt and configured finality policy.
3. Relayer verifies the finalized source receipt and `DepositInitiated` event, then calls `BnbBridgeGateway.completeDeposit(...)`.
4. Confirm wtPOT balance and `DepositCompleted` on BNB.
5. For return, user approves gateway if required by the final token implementation and calls `requestWithdrawal(amount, portalRecipient)`. The gateway burns wtPOT and emits `WithdrawalRequested`.
6. Relayer verifies the BNB event and calls `PortalDotBridgeEscrow.release(withdrawalId, recipient, amount)` on Portaldot.
7. UI must show every leg separately. A source deposit is not complete on the destination until wtPOT mint finalizes.

## Activity and portfolio

- Read balances and positions from the correct chain RPC.
- Index `TradeExecuted`, `DepositInitiated`, `DepositCompleted`, `WithdrawalRequested`, and `WithdrawalReleased`.
- Store tx hashes, chain IDs, block numbers, status and event identifiers.
- Reconcile after receipt confirmation and after page reload; never treat browser-only state as authoritative.
- Display an explicit “Testnet synthetic asset — no equity ownership” label.

## Important limitations to resolve before app integration

- The bridge is relayer-attested; it is not trustless.
- A BNB transaction requires tBNB gas unless a separately audited sponsorship system is built.
- Native Portaldot tPOT uses 14 display decimals, while BNB wtPOT uses 18 decimals. **The conversion rule must be explicitly chosen and tested.** The starter source currently uses a same-raw-amount prototype assumption and must not be deployed until the denomination policy is resolved.
- The market is fixed-price and owner-priced, not an order book or live stock exchange.
