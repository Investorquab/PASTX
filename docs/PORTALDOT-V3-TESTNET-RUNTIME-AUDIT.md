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

## Remaining gates

1. Confirm the metadata schema and storage-key encoding against a compatible official decoder/runtime source before implementing a client adapter.
2. Read testnet asset/precompile mappings only, validate decoded responses against the captured metadata, and preserve evidence with a pinned runtime fingerprint.
3. Establish account/address mapping rules and safe read-only balance queries without using private keys or signing.
4. Verify official mainnet endpoints and independently sourced chain fingerprints before making any mainnet claim.
5. Keep trading and settlement disabled until supported assets, market semantics, transaction outcomes, and rollback/failure behavior are tested end-to-end.
