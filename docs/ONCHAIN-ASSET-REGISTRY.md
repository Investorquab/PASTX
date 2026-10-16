# Pinned on-chain asset registry integrity

The chain adapter exports `verifyPinnedOnchainAssetRegistry(rawJson, expectedChainId, expectedSha256)`. It hashes the exact UTF-8 JSON bytes with SHA-256, compares them with a separately supplied 64-character hex digest pin, parses the JSON only after the digest matches, and applies the strict metadata validator.

The digest must be provisioned through an independent trusted configuration channel. Storing the registry and its expected digest together in the same untrusted location does not establish authenticity. Any byte-level change, including whitespace, changes the digest and fails closed.

This is an integrity check, not a signature system or chain identity proof. It does not establish who authored the registry, whether an RPC endpoint is canonical, whether the registry is current, or whether an asset is safe. The API's on-chain discovery endpoint remains disabled until registry provenance and canonical chain identity are independently verified. No wallet, balance, signing, transaction, or trading capability is enabled.

## API integration

The API accepts raw registry JSON through the server-side environment variable `PASTX_ONCHAIN_ASSET_REGISTRY_JSON` and its expected SHA-256 digest through `PASTX_ONCHAIN_ASSET_REGISTRY_SHA256`. The JSON payload is capped at 1 MiB and the metadata validator limits the catalogue to 500 entries. Supply the expected digest through a trusted release/configuration process; configuring the digest beside an attacker-controlled registry does not establish authenticity.

`GET /api/assets/onchain/registry-status` reports whether the configured bytes pass digest and metadata checks. The capability document publishes the same integrity state without exposing registry contents or the digest. `GET /api/assets/onchain` remains unavailable even after successful integrity verification: canonical chain identity and runtime integration are still unverified. Missing and invalid registry configuration fails closed.
