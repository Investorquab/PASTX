# PASTX bridge relayer

Always-on watcher for the PASTX cross-chain bridge. It polls the **Portaldot
escrow** for `DepositInitiated` events and calls `completeDeposit` on the **BNB
gateway** to mint the matching wtPOT.

> ⚠️ This is an **explicitly trusted single-relayer** model — not a trustless
> bridge. It holds a signing key, so run it on a server you control, never in a
> browser or a serverless function.

## Requirements

- Node ≥ 22 and `pm2` (`npm i -g pm2`) on the VPS.
- The relayer wallet's **private key** — it must match `BnbBridgeGateway.relayer()`
  and hold some **tBNB** for gas.

## Deploy on a VPS with pm2

```bash
# 1. get the code (clone the repo, or copy just this folder)
git clone https://github.com/Investorquab/PASTX.git
cd PASTX/services/relayer

# 2. install deps
npm ci

# 3. configure secrets (gitignored — never commit the real .env)
cp .env.example .env
nano .env            # set PASTX_BNB_RELAYER_PRIVATE_KEY

# 4. start under pm2 and keep it alive across reboots
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # run the command it prints (sets up the boot service)
```

On start you should see `PASTX relayer online` with the relayer address,
balance, escrow and gateway. If the key is wrong or isn't the gateway relayer,
it exits with a clear error.

## Operate

```bash
pm2 logs pastx-relayer      # live logs
pm2 status                  # process state
pm2 restart pastx-relayer   # after editing .env
pm2 stop pastx-relayer
```

## Updating

```bash
cd PASTX && git pull
cd services/relayer && npm ci
pm2 restart pastx-relayer
```

## Environment

See [`.env.example`](./.env.example). Only `PASTX_BNB_RELAYER_PRIVATE_KEY` is
required; RPC URLs and contract addresses default to the live testnet
deployment.
