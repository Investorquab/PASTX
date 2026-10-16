import { describe, expect, it } from "vitest";
import { verifySignedOnchainAssetRegistry } from "./signed-asset-registry";

const registry = [{
  chainId: 420420777,
  contractAddress: "0x1111111111111111111111111111111111111111",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  provenance: "verified_registry"
}];

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(raw: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return toHex(new Uint8Array(digest));
}

async function sign(raw: string): Promise<{ signature: string; publicKey: string }> {
  const pair = await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair;
  const signature = await globalThis.crypto.subtle.sign(
    { name: "Ed25519" },
    pair.privateKey,
    new TextEncoder().encode(raw)
  );
  const publicKey = await globalThis.crypto.subtle.exportKey("raw", pair.publicKey);
  return { signature: toHex(new Uint8Array(signature)), publicKey: toHex(new Uint8Array(publicKey)) };
}

describe("verifySignedOnchainAssetRegistry", () => {
  it("verifies Ed25519 authenticity, the digest pin, and metadata", async () => {
    const raw = JSON.stringify(registry);
    const signed = await sign(raw);
    const result = await verifySignedOnchainAssetRegistry(raw, 420420777, await sha256(raw), signed.signature, signed.publicKey);
    expect(result).toMatchObject({ valid: true, items: registry });
  });

  it("rejects byte changes after a valid registry has been signed", async () => {
    const raw = JSON.stringify(registry);
    const signed = await sign(raw);
    await expect(verifySignedOnchainAssetRegistry(raw + " ", 420420777, await sha256(raw + " "), signed.signature, signed.publicKey)).resolves.toEqual({
      valid: false, reason: "invalid_signature"
    });
  });

  it("rejects a malformed trusted public key and malformed signature", async () => {
    const raw = JSON.stringify(registry);
    const digest = await sha256(raw);
    await expect(verifySignedOnchainAssetRegistry(raw, 420420777, digest, "0".repeat(128), "z".repeat(64))).resolves.toEqual({
      valid: false, reason: "invalid_public_key"
    });
    const signed = await sign(raw);
    await expect(verifySignedOnchainAssetRegistry(raw, 420420777, digest, "bad", signed.publicKey)).resolves.toEqual({
      valid: false, reason: "invalid_signature"
    });
  });

  it("rejects a bad digest even when the Ed25519 signature is valid", async () => {
    const raw = JSON.stringify(registry);
    const signed = await sign(raw);
    await expect(verifySignedOnchainAssetRegistry(raw, 420420777, "0".repeat(64), signed.signature, signed.publicKey)).resolves.toEqual({
      valid: false, reason: "digest_mismatch"
    });
  });

  it("rejects oversized bytes before cryptographic verification", async () => {
    const raw = "x".repeat(1_048_577);
    await expect(verifySignedOnchainAssetRegistry(raw, 420420777, "0".repeat(64), "0".repeat(128), "0".repeat(64))).resolves.toEqual({
      valid: false, reason: "registry_too_large"
    });
  });
});
