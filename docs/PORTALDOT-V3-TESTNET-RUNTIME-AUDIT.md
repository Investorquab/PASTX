# Portaldot V3 Testnet Runtime Metadata Audit

**Audit date:** 17 October 2026  
**Scope:** Read-only testnet runtime metadata captured from the Portaldot V3 testnet endpoint  
**Substrate endpoint:** \`wss://test-node-v3.portaldot.dev\`  
**EVM JSON-RPC endpoint:** \`https://test-evm-rpc-v3.portaldot.dev\`  
**EVM chain ID reported:** \`420420777\`

## Evidence identity

The Substrate runtime-evidence workflow captured metadata and the returned hex bytes were inspected as SCALE-encoded FRAME metadata.

| Field | Observed value |
|---|---|
| Node-reported chain | \`PortaldotV3 Test\` |
| Node version | \`3.0.0-dev-fddd43141f2\` |
| Runtime \`specName\` | \`portaldot-v3\` |
| Runtime \`specVersion\` | \`3002\` |
| Runtime \`transactionVersion\` | \`2\` |
| Metadata format | FRAME metadata V14 |
| Metadata bytes | \`561,916\` |
| Initial-capture metadata SHA-256 | \`942ea1b81eaed81273d95ae263d0002595fcf95183df77ce5114248c35efcda3\` |
| Portable type registry entries | \`911\` |
| Pallet metadata entries | \`69\` |
| Decoder end position | Exact end of metadata; \`0\` trailing bytes |

This is a fingerprint of one observed testnet runtime, not a mainnet fingerprint or a guarantee that the runtime will remain unchanged. The evidence artifact is preserved by [the Substrate runtime evidence workflow](https://github.com/Investorquab/PASTX/actions/runs/38996055799).

## Runtime interfaces identified

The following names and storage/call interfaces are present in the captured runtime metadata. Presence in metadata means the runtime describes the interface; it does **not** mean that state is populated, a call is permissionless, or the interface is safe or appropriate for PASTX to use.

| Pallet (index) | Metadata-level evidence | What it does **not** establish |
|---|---|---|
| \`System\` (0) and \`Balances\` (6) | System account storage and native-balance account/storage interfaces are present. | No account was queried; no account mapping, balance value, or spendability was tested. |
| \`Assets\` (39) | Generic asset storage includes \`Asset\`, \`Account\`, \`Metadata\`, \`Approvals\`, \`Reserves\`, and \`NextAssetId\`. Calls described by metadata include create/mint/burn/transfer, metadata updates, approvals, and administrative controls. | No actual asset IDs, symbols, decimals, balances, owners, or permissions were read. These are generic runtime assets, not evidence of tokenized AAPL/NVDA/TSLA/MSFT shares. |
| \`PoolAssets\` (40) | A separate pool-asset runtime instance exposes a similar assets interface and storage layout. | Its current inventory, relationship to any pool, and asset-ID namespace have not been checked. |
| \`AssetConversion\` (65) | Metadata describes pool creation, liquidity addition/removal, exact-input and exact-output token swaps, and pool storage (\`Pools\`, \`NextPoolAssetId\`, \`PoolFees\`). | No live pool, route, quote, liquidity, fee, or successful swap was inspected. This is not evidence of a stock order book or executable equity-market prices. |
| \`Uniques\` (46), \`Nfts\` (47), \`NftFractionalization\` (48) | NFT/unique-asset interfaces are present; fractionalization metadata describes \`fractionalize\` and \`unify\` calls and an \`NftToAsset\` mapping. | No collection/item was queried. NFT fractionalization alone does not prove legal equity ownership, issuer backing, redemption rights, or a listed-stock representation. |
| \`Contracts\` (21) | A contracts pallet with code, contract-info, and call/instantiate interfaces is present. | No contract address, code hash, deployment, or execution was verified. |
| \`Revive\` (80) | Metadata includes \`eth_transact\`, \`eth_call\`, \`eth_instantiate_with_code\`, and Substrate-call interfaces. Storage includes \`AccountInfoOf\` keyed by an H160-like address and \`OriginalAccount\` mapping an H160-like address to an AccountId32. | This does not by itself prove full Ethereum JSON-RPC compatibility, contract address derivation, or a safe account-mapping algorithm. No mapping was read or exercised. |
| \`AssetsPrecompiles\` (91) | Storage is described for \`NextAssetIndex\`, \`AssetIndexToForeignAssetId\`, and \`ForeignAssetIdToAssetIndex\`. | No mappings or entries were read. The existence of mapping storage does not prove which assets have precompiles, the address derivation, or the ABI/behavior at any address. |
| \`AssetsPrecompilesPermit\` (92) | Metadata includes nonce storage associated with a verifying-contract/owner-address pair for permit signatures. | No permit, signature, nonce, token contract, or transaction was read or tested. |
| \`Oracle\` (85) | Metadata describes \`feed_values\` and storage for raw and aggregated oracle values. | No oracle keys or values were read; this does not establish live price feeds, data quality, provenance, or suitability for market prices. |

### Runtime evidence interpretation

The independent read-only endpoint probes passed on 17 October 2026:

- The EVM JSON-RPC probe observed chain ID \`420420777\` and block height progression from \`68453\` to \`68455\` across three samples. [EVM evidence run](https://github.com/Investorquab/PASTX/actions/runs/38996055820).
- The Substrate probe reported \`PortaldotV3 Test\`, \`portaldot-v3\` spec version \`3002\`, \`isSyncing: false\`, and one peer. Best and finalized heights each advanced by four blocks over five samples. [Substrate evidence run](https://github.com/Investorquab/PASTX/actions/runs/38996055799).

These are time-bounded testnet observations. One peer is a limited connectivity observation, not a decentralization or resilience assessment. The EVM endpoint check only tested chain ID and block-height progression; it did not test contract calls or canonicality. The Substrate metadata records the runtime-described interfaces, not the chain’s current asset state.

## Engineering conclusion

**The testnet exposes a usable generic-asset read surface, but no evidence of listed-stock tokens. PASTX must remain read-only and must not enable trading or settlement.**

## Bounded live asset/precompile snapshot — 17 October 2026

The [Asset State Evidence workflow](https://github.com/Investorquab/PASTX/actions/runs/39061172178) passed at commit `f23a336b8b79cc853e85a8585836dd2af671288b`; [artifact 12111426560](https://github.com/Investorquab/PASTX/actions/runs/39061172178/artifacts/12111426560) contains the bounded console output and captured metadata.

| Field | Observed value |
|---|---|
| Chain | `PortaldotV3 Test` |
| Finalized block | `78248` |
| Finalized hash | `0x2e5b0dd5db35dd6f8156a392f21c9bbf83a413c1559565ebe077b8a5a3341dca` |
| Runtime | `portaldot-v3`, spec version `3002`, transaction version `2` |
| Metadata format and size | FRAME metadata V14, `561,916` bytes |
| Raw metadata SHA-256 | `08448367f7ca945170dcadfa416894e199fd11df43fe4811b723c0aada193857` |
| Normalized metadata SHA-256 | `fec08cb5d8b6edc591fb7ee1d3c2af369185befb3c0d13bde6c5d23e020e3bf1` |
| Raw/API metadata equality | Exact byte match; two additional sessions matched at the same finalized block |
| Query limits | Maximum 25 entries per map; no account balances, signing, extrinsics or storage writes |

### Observed public state

- `Assets.Asset`: IDs `1` and `2` returned. ID `1` has metadata name `example asset for testnet`, symbol `TST`, decimals `18`, raw supply `0`. ID `2` has name `test asset`, symbol `TEST`, decimals `18`, raw supply `15,000,000,000,000,000,000`.
- `PoolAssets.Asset` and `PoolAssets.Metadata`: no entries returned.
- `AssetConversion.Pools`: no entries returned.
- `Assets.NextAssetId` and `PoolAssets.NextAssetId`: no value returned in this snapshot.
- `AssetsPrecompiles.AssetIndexToForeignAssetId`: index `0 -> 1`, `1 -> 2`.
- `AssetsPrecompiles.ForeignAssetIdToAssetIndex`: asset ID `1 -> 0`, `2 -> 1`. The two mappings are inverse-consistent for these entries.

**Conclusion:** only generic test assets named `TST` and `TEST` were observed. The snapshot found no listed-stock symbols or evidence of tokenized AAPL/NVDA/TSLA/MSFT shares and no conversion pools. Generic asset existence and precompile-index mappings do not establish issuer backing, legal ownership rights, redemption, price validity, wallet/account mapping, or executable market behavior.

The inspector uses read-only metadata-aware queries fixed to one finalized block. It caps each map at one 25-entry page and does not request per-account balances, connect a wallet, sign, submit extrinsics, or write state. This is a point-in-time **testnet** observation only. Do not infer mainnet state or enable the PASTX discovery capability from this result alone.

## Metadata fingerprint normalization

Six archived metadata captures, each 561,916 bytes, matched at every byte except offsets `549822` and `549823`. A SCALE V14 field walk maps those bytes to fallback/default-value byte indices `34` and `35` for `Revive.EthBlockBuilderIR`, outside the nine selected asset/precompile storage descriptions. Observed pairs were `(0x97, 0xa4)`, `(0x5b, 0xa4)`, `(0x56, 0xa4)`, `(0x51, 0xa4)`, `(0xa0, 0xa0)`, and `(0x9b, 0xa0)`. Normalizing only these two byte offsets produces SHA-256 `fec08cb5d8b6edc591fb7ee1d3c2af369185befb3c0d13bde6c5d23e020e3bf1` for every captured file.

The checker accepts this exact two-byte variance only. It pins the normalized digest and metadata length, checks chain/runtime identity and versions, requires exact raw/API equality and three matching same-finalized-block sessions, and verifies that the changing bytes remain at `Revive.EthBlockBuilderIR.fallback[34:36]`. Any other metadata difference or moved field fails closed. The original raw SHA remains in the artifact. The Revive fallback entry is not queried or interpreted as live state.

## Remaining gates

1. Review the bounded live testnet storage results and verify key/value decoding against the captured metadata.
2. Establish account/address mapping rules and safe read-only balance queries without using private keys or signing.
3. Verify official mainnet endpoints and independently sourced chain fingerprints before making any mainnet claim.
4. Keep trading and settlement disabled until supported assets, market semantics, transaction outcomes, and rollback/failure behavior are tested end-to-end.
