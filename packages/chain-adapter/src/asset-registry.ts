import type { OnchainAssetMetadata } from "@pastx/shared";

export type AssetRegistryValidation =
  | { valid: true; items: OnchainAssetMetadata[] }
  | {
      valid: false;
      reason:
        | "invalid_expected_chain"
        | "invalid_registry_shape"
        | "registry_empty"
        | "too_many_assets"
        | "invalid_asset_metadata"
        | "chain_id_mismatch"
        | "duplicate_contract_address"
        | "duplicate_symbol";
    };

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SYMBOL = /^[A-Z0-9][A-Z0-9._-]{0,19}$/;
const MAX_REGISTRY_ASSETS = 500;

/**
 * Validate the shape and internal consistency of entries from a trusted registry.
 * This function does not establish that a registry is authentic or that an RPC
 * endpoint is canonical; callers must establish those trust roots separately.
 */
export function validateOnchainAssetRegistry(
  input: unknown,
  expectedChainId: number
): AssetRegistryValidation {
  if (!Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) {
    return { valid: false, reason: "invalid_expected_chain" };
  }
  if (!Array.isArray(input)) {
    return { valid: false, reason: "invalid_registry_shape" };
  }
  if (input.length === 0) {
    return { valid: false, reason: "registry_empty" };
  }
  if (input.length > MAX_REGISTRY_ASSETS) {
    return { valid: false, reason: "too_many_assets" };
  }

  const items: OnchainAssetMetadata[] = [];
  const addresses = new Set<string>();
  const symbols = new Set<string>();

  for (const entry of input) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { valid: false, reason: "invalid_asset_metadata" };
    }
    const asset = entry as Record<string, unknown>;
    if (
      !Number.isSafeInteger(asset.chainId) ||
      typeof asset.contractAddress !== "string" ||
      !EVM_ADDRESS.test(asset.contractAddress) ||
      typeof asset.symbol !== "string" ||
      asset.symbol !== asset.symbol.trim() ||
      !SYMBOL.test(asset.symbol) ||
      typeof asset.name !== "string" ||
      asset.name.trim().length === 0 ||
      asset.name.length > 120 ||
      !Number.isInteger(asset.decimals) ||
      (asset.decimals as number) < 0 ||
      (asset.decimals as number) > 255 ||
      asset.provenance !== "verified_registry"
    ) {
      return { valid: false, reason: "invalid_asset_metadata" };
    }
    if (asset.chainId !== expectedChainId) {
      return { valid: false, reason: "chain_id_mismatch" };
    }

    const addressKey = asset.contractAddress.toLowerCase();
    const symbolKey = asset.symbol.toUpperCase();
    if (addresses.has(addressKey)) {
      return { valid: false, reason: "duplicate_contract_address" };
    }
    if (symbols.has(symbolKey)) {
      return { valid: false, reason: "duplicate_symbol" };
    }

    addresses.add(addressKey);
    symbols.add(symbolKey);
    items.push({
      chainId: asset.chainId as number,
      contractAddress: asset.contractAddress,
      symbol: asset.symbol,
      name: asset.name.trim(),
      decimals: asset.decimals as number,
      provenance: "verified_registry"
    });
  }

  return { valid: true, items };
}
