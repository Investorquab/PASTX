# PASTX Security Baseline

## Secrets and repository hygiene

Never commit:
- wallet seed phrases or private keys;
- API keys, bearer tokens, passwords or session secrets;
- production `.env` files;
- private RPC URLs containing credentials;
- private user information or confidential correspondence.

Use `.env.example` with safe placeholder values. Keep actual values in an untracked local `.env` or a deployment secret manager. If a credential is committed, revoke/rotate it; deleting the file later is not sufficient.

The Secret Scan workflow runs Gitleaks on pushes, pull requests, and weekly, with full Git history available to the scanner. A clean scan is evidence only for the scanned repository history and detection rules; it is not proof that credentials were never exposed elsewhere. Rotate any credential suspected of exposure.

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

## Automated checks

The CI workflow runs `pnpm audit --prod --audit-level high` to fail on known high/critical production dependency advisories. The CodeQL workflow performs JavaScript/TypeScript static analysis on pushes, pull requests and weekly. The Secret Scan workflow runs Gitleaks over repository history. These checks complement, but do not replace, manual review, provider licensing verification, or live deployment validation.

## Before a public release

- review secret-scan findings and rotate any exposed credential;
- run dependency and static checks;
- review authorization and error paths;
- confirm no real keys are present in fixtures or screenshots;
- verify every deployment and transaction claim.

## CodeQL analysis

The CodeQL workflow runs the JavaScript/TypeScript security query suite and archives its SARIF output as a private GitHub Actions artifact named `codeql-sarif-<run-id>` for 14 days. This repository is private and Code Scanning upload is not currently enabled, so CI must not present an unavailable upload as a successful GitHub Security-tab publication. Review the artifact from the relevant Actions run when examining CodeQL findings.

When GitHub Code Security is enabled for this private repository, update the workflow's `upload: never` setting to `upload: always` to publish analysis results to GitHub Code Scanning. The artifact fallback preserves analysis output; it does not create GitHub Code Scanning alerts by itself.
