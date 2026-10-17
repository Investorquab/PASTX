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
| Metadata SHA-256 | \`942ea1b81eaed81273d95ae263d0002595fcf95183df77ce5114248c35efcda3\` |
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

**There is a plausible generic-asset integration surface to investigate, but PASTX is not ready to enable asset discovery or trading.**

Before integrating any pallet into the application, the next read-only gate is to inspect current testnet state for the asset metadata and precompile-mapping storage items, confirm exact key/value types and namespaces, and verify the account-mapping behavior against official runtime source or documentation. Keep \`Assets\`, \`PoolAssets\`, \`AssetConversion\`, \`Revive\`, and precompile integrations behind read-only/disabled boundaries during that work.

Do not submit any extrinsic, call a write method, sign a message, connect a user wallet, or change the PASTX discovery capability as part of this audit. The current findings do not establish that any listed stock is represented on-chain, that market prices are executable, or that settlement is safe.

## Next read-only state inspection

A bounded implementation now exists in `scripts/check-portaldot-v3-testnet-assets.mjs`, with workflow `Portaldot V3 Testnet Asset State Evidence`. It uses metadata-aware Substrate query tooling temporarily installed at an exact package version, verifies the expected chain/runtime/metadata fingerprint, fixes all reads to one finalized block, and samples at most 25 entries per selected map. It checks the runtime-described `Assets`, `PoolAssets`, `AssetConversion.Pools`, and `AssetsPrecompiles` mapping storage. It also reads next-ID values where present.

The script must fail closed if the chain label or runtime fingerprint differs from the evidence captured on 17 October 2026. An updated runtime requires a fresh metadata audit before re-running storage interpretation. The workflow artifact is intended to establish what public asset/precompile state is actually populated, not to approve any integration. Live results remain pending until that workflow run has completed and its output has been reviewed.

### Fingerprint mismatch observed on 17 October 2026

The first post-merge state-inspection run encountered a different hash from the metadata-aware API object than the hash captured in the earlier raw runtime evidence. It failed before issuing the selected storage reads, so no asset or precompile contents were observed in that run. Do not update the expected hash merely to make the workflow pass. The diagnostic path now requests `state_getRuntimeVersion` and `state_getMetadata` at a single finalized block, separately fetches the raw `state_getMetadata` JSON-RPC bytes at the same block, hashes both representations, and emits a bounded summary of the target storage schema. This should distinguish an actual metadata change from an API encoding/normalization difference. Until that report is reviewed, state inspection remains blocked.

### Follow-up runtime fingerprint discrepancy

A fresh independent runtime-evidence run on 17 October 2026 reported metadata length 561,916 and SHA-256 `acc74bc508af18c1d754b12abf0251e6aae6221ee905817de67aa223a7eec9a6` at finalized block `0xff8e00467ba814926925931e067a5e0b61b4e50d96008d9410e73cc7783bde4d`, while keeping the same node version, chain label, runtime spec name/version, and transaction version as the earlier capture. This differs from the audit fingerprint `942ea1b81eaed81273d95ae263d0002595fcf95183df77ce5114248c35efcda3`. The latest state-inspection attempt then stopped on a diagnostic-code error before comparing both representations or reading storage. Do not treat this as evidence of a populated asset registry and do not update the pin until the raw/decoded metadata and selected schema are reconciled. The revised checker requests raw metadata through the same provider connection used for API decoding, fixes type-registry reporting, and keeps the fingerprint gate closed.

### Repeated-capture metadata discrepancy

Three archived metadata captures each contain 561,916 bytes and the same V14 prefix, but have different SHA-256 fingerprints. A byte-level comparison found exactly one differing byte at offset 549822, with observed values 0x97, 0x5b, and 0x56. The chain label and runtime version fields remained PortaldotV3 Test, portaldot-v3 spec version 3002, and transaction version 2. The semantic identity of the differing byte has not yet been established, so it is not a sufficient basis for updating the audited metadata pin.

The latest asset-state diagnostic confirmed that raw RPC metadata and API-decoded metadata matched on the same provider connection (SHA-256 aaf882cc4d657fa7ae9ee14e1ad079618a0e94a8f55ece31ce5a23117c5495a9 at finalized block 69071). Metadata described the selected Assets, PoolAssets, AssetConversion, and AssetsPrecompiles storage entries, including key/value type IDs, but the hash differed from the audited pin, so the script stopped before querying storage values.

A same-finalized-block, independent-connection consistency check is being added to distinguish runtime metadata variance from connection/backend variance. Storage queries remain blocked until that check passes and the byte-level discrepancy is explained.

## Remaining gates

1. Review the bounded live testnet storage results and verify key/value decoding against the captured metadata.
2. Establish account/address mapping rules and safe read-only balance queries without using private keys or signing.
3. Verify official mainnet endpoints and independently sourced chain fingerprints before making any mainnet claim.
4. Keep trading and settlement disabled until supported assets, market semantics, transaction outcomes, and rollback/failure behavior are tested end-to-end.
