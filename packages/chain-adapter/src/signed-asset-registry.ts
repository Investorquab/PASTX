import { MAX_REGISTRY_JSON_BYTES, verifyPinnedOnchainAssetRegistry, type PinnedRegistryResult } from "./pinned-asset-registry";

export type SignedRegistryResult =
  | Extract<PinnedRegistryResult, { valid: true }>
  | Extract<PinnedRegistryResult, { valid: false }>
  | { valid: false; reason: "invalid_public_key" | "invalid_signature" | "signature_verification_unavailable" };

function hexBytes(value: string): Uint8Array {
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

/**
 * Verify the Ed25519 signature over the exact registry UTF-8 bytes before
 * checking the digest pin and metadata. The public key must be pinned through
 * an independently trusted release/configuration channel; never trust a key
 * delivered alongside an untrusted registry. The private signing key never
 * belongs in this application or repository.
 */
export async function verifySignedOnchainAssetRegistry(
  rawJson: string,
  expectedChainId: number,
  expectedSha256: string,
  signatureHex: string,
  trustedPublicKeyHex: string
): Promise<SignedRegistryResult> {
  const signature = signatureHex.trim();
  const publicKey = trustedPublicKeyHex.trim();
  if (!/^[a-fA-F0-9]{64}$/.test(publicKey)) {
    return { valid: false, reason: "invalid_public_key" };
  }
  if (!/^[a-fA-F0-9]{128}$/.test(signature)) {
    return { valid: false, reason: "invalid_signature" };
  }

  const message = new TextEncoder().encode(rawJson);
  if (message.byteLength > MAX_REGISTRY_JSON_BYTES) {
    return { valid: false, reason: "registry_too_large" };
  }

  let importedKey: CryptoKey;
  try {
    importedKey = await globalThis.crypto.subtle.importKey(
      "raw",
      hexBytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
  } catch {
    return { valid: false, reason: "invalid_public_key" };
  }

  let signatureValid: boolean;
  try {
    signatureValid = await globalThis.crypto.subtle.verify(
      { name: "Ed25519" },
      importedKey,
      hexBytes(signature),
      message
    );
  } catch {
    return { valid: false, reason: "signature_verification_unavailable" };
  }
  if (!signatureValid) return { valid: false, reason: "invalid_signature" };

  // Signature authenticates the bytes under the pinned public key; digest and
  // schema checks remain defense-in-depth and enforce the configured chain ID.
  return verifyPinnedOnchainAssetRegistry(rawJson, expectedChainId, expectedSha256);
}
