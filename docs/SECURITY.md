# PASTX Security Baseline

## Secrets and repository hygiene

Never commit:
- wallet seed phrases or private keys;
- API keys, bearer tokens, passwords or session secrets;
- production `.env` files;
- private RPC URLs containing credentials;
- private user information or confidential correspondence.

Use `.env.example` with safe placeholder values. Keep actual values in an untracked local `.env` or a deployment secret manager. If a credential is committed, revoke/rotate it; deleting the file later is not sufficient.

## Wallet security

- The user's wallet controls signing and private-key custody.
- The API and frontend must never ask users to paste seed phrases or private keys.
- Show network, account, asset, quantity, payment amount and fees before signing.
- Handle rejected signatures and wrong networks explicitly.
- Do not automatically retry non-idempotent transaction submissions without a safe deduplication strategy.

## Market-data security and correctness

- Keep provider keys server-side.
- Validate and bound all query parameters.
- Rate-limit public API endpoints and apply timeouts.
- Label source, currency, timestamp and delayed/stale status.
- Do not use external quote data as proof of asset backing or settlement price.

## Transaction integrity

- Verify chain identity before signing.
- Do not trust client-submitted balances, transaction status or portfolio values.
- Verify transaction receipts/events and resulting state.
- Require an atomic settlement guarantee before enabling trades.
- Test replay/duplicate submission and failure rollback.

## Public repository

The repository is public. Only publish documentation, source and evidence intended for public review. Do not publish private messages from ecosystem contacts without consent. Public project status must accurately distinguish planned, implemented, locally tested, and deployed features.

## Before a public release

- scan tracked files for secrets;
- run dependency and static checks;
- review authorization and error paths;
- confirm no real keys are present in fixtures or screenshots;
- verify every deployment and transaction claim.
