import { validateOnchainAssetRegistry, type AssetRegistryValidation } from "./asset-registry";

export type PinnedRegistryResult =
  | { valid: true; sha256: string; items: Extract<AssetRegistryValidation, { valid: true }>["items"] }
  | {
      valid: false;
      reason: "invalid_digest_pin" | "digest_mismatch" | "invalid_json" | "registry_too_large" | Extract<AssetRegistryValidation, { valid: false }>["reason"];
    };

const MAX_REGISTRY_JSON_BYTES = 1_048_576;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifies exact registry bytes against an independently supplied SHA-256 pin,
 * then validates the decoded metadata. The digest pin must come from a separate
 * trusted configuration channel; this function does not authenticate its source,
 * prove canonical chain identity, or enable discovery by itself.
 */
export async function verifyPinnedOnchainAssetRegistry(
  rawJson: string,
  expectedChainId: number,
  expectedSha256: string
): Promise<PinnedRegistryResult> {
  if (!/^[a-fA-F0-9]{64}$/.test(expectedSha256)) {
    return { valid: false, reason: "invalid_digest_pin" };
  }

  if (new TextEncoder().encode(rawJson).byteLength > MAX_REGISTRY_JSON_BYTES) {
    return { valid: false, reason: "registry_too_large" };
  }

  const digestBytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawJson)
  );
  const sha256 = toHex(new Uint8Array(digestBytes));
  if (sha256 !== expectedSha256.toLowerCase()) {
    return { valid: false, reason: "digest_mismatch" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { valid: false, reason: "invalid_json" };
  }

  const validation = validateOnchainAssetRegistry(parsed, expectedChainId);
  if (!validation.valid) return validation;
  return { valid: true, sha256, items: validation.items };
}
