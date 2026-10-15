# Portaldot Hacker House 2026 — PASTX Requirements

**Last checked:** 15 October 2026  
**Project:** PASTX — Portaldot Asset & Stock Trading Exchange  
**Primary track:** Ecosystem DApps  
**Secondary contribution:** Modular Cloud & Middleware

## Track fit

PASTX is primarily an **Ecosystem DApp** because the product goal is a consumer-facing market and asset application. The market API and provider-normalization layer may also contribute to **Modular Cloud & Middleware**, but we should submit to the single track that best matches the delivered core product.

Officially listed tracks:
1. Modular Cloud & Middleware — decentralized middleware, storage/data components and APIs.
2. Multi-Chain & Cross-Chain Infra — asset/data bridges and liquidity engines.
3. Node Operations & Tooling — node monitoring, staking automation, node data visualization and security analysis.
4. Ecosystem DApps — DeFi, RWA tokenization and consumer-facing applications.

PASTX must not claim tokenized stock ownership unless the asset has verified backing and rights. Current AAPL/NVDA/TSLA/MSFT entries are external price references only, not on-chain equities.

## Evaluation weights

| Criterion | Weight | PASTX evidence required |
|---|---:|---|
| Technical Feasibility | 30% | Complete runnable code, tested core flow, architecture and deployment evidence |
| Innovation | 30% | A clear product distinction and meaningful use of Portaldot V3 features |
| Ecosystem Contribution | 20% | Real Portaldot usage, useful app/API and evidence of contribution |
| Business Potential | 20% | Defined user problem, product value and credible continuation plan |

## Event gates and deadlines

Times below are copied from the public event listing, which expresses these deadlines in UTC+8:
- **Check-in submission:** 24 October 2026, 20:00 UTC+8.
- **Office-hour application deadline:** 30 October 2026, 20:00 UTC+8.
- **Office hours:** 31 October–1 November 2026, 14:00–18:00 UTC+8.
- **Final submission / code freeze:** 6 November 2026, 12:00 UTC+8.
- **Live demo day:** 7–8 November 2026.
- **Community Choice voting:** 9 November 2026.
- **Winners announced:** 10 November 2026.

Check the organizer's DoraHacks page/Discord for changes before acting on deadlines.

## Check-in evidence expected

- Progress and outstanding items.
- Public GitHub repository and complete README.
- Product architecture diagram.
- Portaldot testnet deployment information.
- Contract address and transaction hash, where applicable.
- Explorer link, if available.
- Initial demo: live DApp or video no longer than three minutes, showing a core function.

A prototype/core flow is expected by check-in; concept-only submissions are insufficient. Simulated data may be used for a prototype, but real testnet interactions are encouraged.

## Final submission evidence expected

- Project name and team members.
- One-sentence overview.
- Public repository, complete README, documentation and deployment instructions.
- Reproducible/runnable code.
- Testnet deployment details and contract/transaction evidence, where applicable.
- Runnable DApp or clear local deployment instructions.
- Demo video of no more than three minutes showing the product, core functionality and Portaldot integration/usage.
- Pitch deck covering problem, why Portaldot is essential, proof of functionality and future support needs.

## Repository compliance

- Repository must remain public during the event.
- At least three valid commits during the Hacker House period.
- Core work should be produced during the event; do not dump the complete core implementation only in the final 24 hours.
- Keep commit history and development records.
- Code freeze begins after final submission; substantial functionality/architecture changes should not be made afterward without organizer guidance.

## PASTX implementation gates

1. Keep the preview UI truthful and runnable.
2. Implement and test server-side market API/provider normalization without leaking API keys.
3. Confirm provider licensing before publicly displaying live market data.
4. Verify the actual Portaldot V3 RPC, runtime identity, wallet path and supported asset/contract route.
5. Prove atomic settlement and rollback under the selected route.
6. Deploy to Portaldot testnet and capture verifiable evidence.
7. Complete a reproducible end-to-end core flow, README, demo and pitch deck.

**Important:** UI, provider API, or local-node tests alone do not satisfy the required Portaldot testnet integration gate.

## Sources

- [Public Portaldot Hacker House 2026 listing and requirements](https://www.hackathonradar.com/database/hackathon/portaldot-hacker-house-2026)
- [DoraHacks project event page](https://dorahacks.io/hackathon/2362/detail)
- [Portaldot V3 testnet guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide)
- [PASTX repository](https://github.com/Investorquab/PASTX)
