import { describe, expect, it } from "vitest";
import { validateOnchainAssetRegistry } from "./asset-registry";

const validAsset = {
  chainId: 5042,
  contractAddress: "0x1111111111111111111111111111111111111111",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  provenance: "verified_registry"
} as const;

describe("validateOnchainAssetRegistry", () => {
  it("accepts well-formed entries matching the configured chain", () => {
    expect(validateOnchainAssetRegistry([validAsset], 5042)).toEqual({
      valid: true,
      items: [{ ...validAsset, name: "USD Coin" }]
    });
  });

  it("rejects invalid expected chain IDs and non-array or empty registries", () => {
    expect(validateOnchainAssetRegistry([validAsset], 0)).toEqual({ valid: false, reason: "invalid_expected_chain" });
    expect(validateOnchainAssetRegistry({}, 5042)).toEqual({ valid: false, reason: "invalid_registry_shape" });
    expect(validateOnchainAssetRegistry([], 5042)).toEqual({ valid: false, reason: "registry_empty" });
  });

  it("rejects assets on a different chain", () => {
    expect(validateOnchainAssetRegistry([{ ...validAsset, chainId: 1 }], 5042)).toEqual({
      valid: false, reason: "chain_id_mismatch"
    });
  });

  it("rejects malformed addresses, symbols, names, decimals, and provenance", () => {
    const invalidEntries = [
      { ...validAsset, contractAddress: "0x1234" },
      { ...validAsset, symbol: "USDC!" },
      { ...validAsset, name: "   " },
      { ...validAsset, decimals: 256 },
      { ...validAsset, decimals: -1 },
      { ...validAsset, decimals: 1.5 },
      { ...validAsset, provenance: "user_supplied" },
      null,
      "not-an-object"
    ];
    for (const entry of invalidEntries) {
      expect(validateOnchainAssetRegistry([entry], 5042)).toEqual({
        valid: false, reason: "invalid_asset_metadata"
      });
    }
  });

  it("rejects duplicate addresses case-insensitively", () => {
    expect(validateOnchainAssetRegistry([
      validAsset,
      { ...validAsset, symbol: "USDC2", contractAddress: validAsset.contractAddress.toUpperCase().replace("0X", "0x") }
    ], 5042)).toEqual({ valid: false, reason: "duplicate_contract_address" });
  });

  it("rejects duplicate symbols case-insensitively", () => {
    expect(validateOnchainAssetRegistry([
      validAsset,
      { ...validAsset, contractAddress: "0x2222222222222222222222222222222222222222" }
    ], 5042)).toEqual({ valid: false, reason: "duplicate_symbol" });
  });

  it("rejects oversized registries", () => {
    expect(validateOnchainAssetRegistry(Array.from({ length: 501 }, (_, i) => ({
      ...validAsset,
      contractAddress: `0x${String(i + 1).padStart(40, "0")}`,
      symbol: `T${i}`
    })), 5042)).toEqual({ valid: false, reason: "too_many_assets" });
  });
});
