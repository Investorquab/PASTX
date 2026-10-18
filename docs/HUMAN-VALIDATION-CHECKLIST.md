# Human Validation Checklist

This checklist is the hand-off boundary between repository-level engineering and tests that require a real provider account, a local machine, or confirmed Portaldot infrastructure.

## 1. Pull the PR branch

~~~bash
git fetch origin
git switch ui/firstbell-inspired-market-terminal
git pull --ff-only origin ui/firstbell-inspired-market-terminal
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
~~~

Do not merge this branch into **main** as part of validation. Record the tested commit SHA with the results.

## 2. Start the app with safe defaults

Copy **.env.example** to **.env** and configure only values available to the operator. Keep credentials server-side; do not put secrets in **VITE_*** variables, screenshots, logs, or commits.

Start the API and web app:

~~~bash
pnpm dev
~~~

Expected local endpoints:
- Web: http://localhost:5173
- API: http://localhost:4000

Verify baseline health and safety gates:

~~~bash
curl -fsS http://localhost:4000/api/health
curl -fsS http://localhost:4000/api/capabilities
curl -fsS http://localhost:4000/api/chain/status
curl -fsS http://localhost:4000/api/chain/fingerprint
curl -fsS http://localhost:4000/api/assets/onchain/readiness
~~~

Expected by default: API health is OK, **tradingEnabled** is **false**, on-chain discovery is unavailable, and readiness identifies the missing registry/fingerprint/runtime adapter gates. A reachable RPC by itself is not proof of the correct chain.

For Portaldot V3 testnet work, the [current guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide) was updated on 16 October 2026: Substrate WebSocket `wss://test-node-v3.portaldot.dev`, EVM JSON-RPC `https://test-evm-rpc-v3.portaldot.dev`, EVM chain ID `420420777`. The former `feso-apps.xyz` endpoints are retired. Keep `PORTALDOT_EVM_RPC_URL` blank until you independently re-check the current guide and the endpoint's live identity; these values are testnet-only, not mainnet configuration.

## 3. Validate market discovery

Without a configured provider key, verify the search route returns a clear configuration error instead of fabricated results:

~~~bash
curl -i "http://localhost:4000/api/markets/search?q=Microsoft&limit=15"
~~~

With an authorized Twelve Data account configured on the API process, test:
- **/api/markets/search?q=Microsoft&limit=15**
- A ticker available on more than one venue; confirm listings remain distinct by MIC/exchange, currency, and country.
- **/api/markets/:symbol** with exchange/MIC/country/currency query parameters.
- Logo lookup for a listing whose provider metadata identifies the expected venue.

Confirm ETFs are not shown as common-stock search results and that each search result is described as external reference data, not a Portaldot-issued asset.

## 4. Validate quotes and candles only after licensing approval

Do **not** set **MARKET_DATA_DISPLAY_ENABLED=true** until the account owner has confirmed the provider's terms permit the intended client-facing display. With approval and a valid server-side **MARKET_DATA_API_KEY**, enable the flag in the API environment and restart the API.

Then verify:
- **/api/markets/:symbol/quote** returns a matching symbol, listing venue, and currency.
- **/api/markets/:symbol/candles?interval=1day&outputsize=30** returns coherent OHLC values and timestamps.
- Changing MIC/exchange/country does not reuse another listing's cached quote or candles.
- Invalid symbols, venue mismatches, provider rate limits, and provider failures produce safe error responses.
- Browser devtools and client bundles contain no provider key.

Never interpret reference-market quotes as a PASTX execution price or as proof of equity ownership.

## 5. Browser acceptance pass

At http://localhost:5173, verify:
- Header navigation contains no documentation link; documentation is available in the footer.
- Search can find listings beyond the four quick-access Overview entries when provider configuration is available.
- The same ticker listed on different venues can be selected distinctly.
- Quote/chart labels and currency match the selected listing; provider failure does not create fake prices or candles.
- The chart axis corresponds to the plotted series.
- The amount-to-spend preview is denominated consistently and never implies a submitted order.
- Closing the picker clears its temporary filter and does not leave the watchlist inexplicably empty.
- Language selection changes the translated terminal labels.
- Network/chain status is explicit; wallet, order submission, balances, and settlement remain disabled.

## 6. Portaldot chain gate — do not bypass

Before any on-chain asset discovery or execution is enabled, an operator must supply and independently verify:
- The canonical Portaldot V3 RPC endpoint and expected chain ID.
- Trusted genesis and checkpoint block hashes from an authoritative source.
- A signed, digest-pinned asset registry using a trusted public key.
- Evidence that the target runtime adapter can enumerate the expected assets and validate their metadata.
- The supported wallet, asset/payment, transaction, and settlement path on the actual target network.

The API's chain fingerprint and signed-registry checks are necessary safeguards, not proof that the runtime adapter or trading flow is implemented. Do not enable trading based only on a passing health endpoint or a matching chain ID.

## 7. Report back

Attach the tested commit SHA and provide:
- Results of **pnpm check**, **pnpm test**, and **pnpm build**.
- Browser acceptance results and screenshots for any visual issues.
- Provider plan/permission confirmation and redacted API responses for search, quote, and candles.
- Verified chain ID, genesis/checkpoint evidence, and the runtime asset-enumeration result.
- Any failures with the exact command/route, HTTP status, and redacted error output.

Never include API keys, private keys, wallet seed phrases, or other secrets in the report.
