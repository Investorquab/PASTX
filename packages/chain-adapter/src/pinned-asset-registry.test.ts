import { describe, expect, it } from "vitest";
import { verifyPinnedOnchainAssetRegistry } from "./pinned-asset-registry";

const registry = [{
  chainId: 420420777,
  contractAddress: "0x1111111111111111111111111111111111111111",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  provenance: "verified_registry"
}];

async function pin(raw: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("verifyPinnedOnchainAssetRegistry", () => {
  it("accepts exact bytes with a matching independent SHA-256 pin and valid metadata", async () => {
    const raw = JSON.stringify(registry);
    const result = await verifyPinnedOnchainAssetRegistry(raw, 420420777, await pin(raw));
    expect(result).toMatchObject({ valid: true, items: registry });
    if (result.valid) expect(result.sha256).toBe(await pin(raw));
  });

  it("rejects a missing or malformed digest pin", async () => {
    await expect(verifyPinnedOnchainAssetRegistry("[]", 420420777, "")).resolves.toEqual({
      valid: false, reason: "invalid_digest_pin"
    });
    await expect(verifyPinnedOnchainAssetRegistry("[]", 420420777, "g".repeat(64))).resolves.toEqual({
      valid: false, reason: "invalid_digest_pin"
    });
  });

  it("rejects changed bytes even when the JSON remains valid", async () => {
    const raw = JSON.stringify(registry);
    await expect(verifyPinnedOnchainAssetRegistry(raw + " ", 420420777, await pin(raw))).resolves.toEqual({
      valid: false, reason: "digest_mismatch"
    });
  });

  it("rejects malformed JSON after its bytes match the supplied pin", async () => {
    const raw = "{not-json";
    await expect(verifyPinnedOnchainAssetRegistry(raw, 420420777, await pin(raw))).resolves.toEqual({
      valid: false, reason: "invalid_json"
    });
  });

  it("checks registry metadata after integrity verification", async () => {
    const raw = JSON.stringify([{ ...registry[0], chainId: 1 }]);
    await expect(verifyPinnedOnchainAssetRegistry(raw, 420420777, await pin(raw))).resolves.toEqual({
      valid: false, reason: "chain_id_mismatch"
    });
  });
});
