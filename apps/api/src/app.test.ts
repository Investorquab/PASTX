import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKET_INSTRUMENTS } from "@pastx/shared";
import { MarketDataError, TwelveDataAdapter } from "@pastx/market-data";
import { buildApp } from "./app";
import { PORTALDOT_V3_EVM_CHAIN_ID } from "@pastx/chain-adapter";

afterEach(() => {
  vi.restoreAllMocks();
});

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signRegistry(rawJson: string): Promise<{ signature: string; publicKey: string }> {
  const pair = await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair;
  const signature = await globalThis.crypto.subtle.sign(
    { name: "Ed25519" },
    pair.privateKey,
    new TextEncoder().encode(rawJson)
  );
  const publicKey = await globalThis.crypto.subtle.exportKey("raw", pair.publicKey);
  return {
    signature: bytesToHex(new Uint8Array(signature)),
    publicKey: bytesToHex(new Uint8Array(publicKey))
  };
}


describe("PASTX API", () => {
  it("reports health without claiming trading is enabled", async () => {
    const app = await buildApp({ logger: false, marketDataApiKey: undefined });
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", tradingEnabled: false, marketDataConfigured: false, marketDataDisplayEnabled: false });
    await app.close();
  });

  it("publishes a capability contract that distinguishes implementation from enablement", async () => {
    const app = await buildApp({ logger: false, marketDataApiKey: "configured-key", marketDataDisplayEnabled: false });
    const response = await app.inject({ method: "GET", url: "/api/capabilities" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      capabilities: {
        referenceCatalogue: { implemented: true, enabled: true },
        marketQuotes: { implemented: true, enabled: false },
        marketCandles: { implemented: true, enabled: false },
        chainIdentityProbe: { implemented: true, enabled: true, verificationScope: "chain_id_and_latest_block_read" },
        chainFingerprintVerification: { implemented: true, enabled: false, verificationScope: "chain_id_genesis_checkpoint_latest_block_read" },
        onchainAssetRegistryIntegrity: { implemented: true, configured: false, verified: false, status: "not_configured", assetCount: 0, reason: "registry_not_configured" },
        onchainAssetDiscovery: { implemented: false, enabled: false, reason: "registry_not_configured" },
        walletConnection: { implemented: false, enabled: false },
        orderPreview: { implemented: true, enabled: true, execution: false },
        orderSubmission: { implemented: false, enabled: false },
        atomicSettlement: { implemented: false, enabled: false }
      },
      safety: { tradingEnabled: false, externalStockQuotesAreReferenceData: true }
    });
    await app.close();
  });

  it("does not treat whitespace-only provider keys as configured", async () => {
    const app = await buildApp({ logger: false, marketDataApiKey: "   " });
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.json().marketDataConfigured).toBe(false);
    await app.close();
  });

  it("applies security headers to API responses", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBeTruthy();
    await app.close();
  });

  it("reports chain status without exposing RPC URL or enabling writes", async () => {
    const app = await buildApp({
      logger: false,
      chainProbe: async () => ({
        configured: true, reachable: true, networkMatches: true,
        expectedChainId: PORTALDOT_V3_EVM_CHAIN_ID, chainId: PORTALDOT_V3_EVM_CHAIN_ID, blockNumber: "12345", status: "verified", verificationScope: "chain_id_and_latest_block_read"
      })
    });
    const response = await app.inject({ method: "GET", url: "/api/chain/status" });
    expect(response.statusCode).toBe(200);
    expect(response.json().item).toMatchObject({ status: "verified", chainId: 420420777, verificationScope: "chain_id_and_latest_block_read" });
    expect(response.body).not.toContain("rpc.example");
    await app.close();
  });


  it("reports that trusted chain fingerprint anchors are not configured by default", async () => {
    const app = await buildApp({ logger: false });
    try {
      const response = await app.inject({ method: "GET", url: "/api/chain/fingerprint" });
      expect(response.statusCode).toBe(200);
      expect(response.json().item).toMatchObject({
        status: "not_configured",
        configured: false,
        reachable: false,
        verified: false,
        reason: "trusted_fingerprint_not_configured",
        verificationScope: "chain_id_genesis_checkpoint_latest_block_read"
      });
    } finally {
      await app.close();
    }
  });

  it("uses an explicitly configured expected chain ID for the read-only probe", async () => {
    const app = await buildApp({ logger: false, chainExpectedChainId: 5042 });
    try {
      const response = await app.inject({ method: "GET", url: "/api/chain/status" });
      expect(response.statusCode).toBe(200);
      expect(response.json().item).toMatchObject({
        configured: false,
        expectedChainId: 5042,
        chainId: null,
        blockNumber: null,
        status: "not_configured",
        verificationScope: "chain_id_and_latest_block_read"
      });
    } finally {
      await app.close();
    }
  });

  it("rejects an invalid configured expected chain ID at startup", async () => {
    await expect(buildApp({ logger: false, chainExpectedChainId: 0 })).rejects.toThrow(
      "PORTALDOT_EVM_CHAIN_ID must be a positive safe integer."
    );
  });


  it("keeps on-chain asset discovery explicitly unavailable rather than returning fabricated assets", async () => {
    const app = await buildApp({ logger: false });
    try {
      const response = await app.inject({ method: "GET", url: "/api/assets/onchain" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "unavailable", items: [], reason: "registry_not_configured" });
      const capabilities = await app.inject({ method: "GET", url: "/api/capabilities" });
      expect(capabilities.json().capabilities.onchainAssetDiscovery).toEqual({ implemented: false, enabled: false, reason: "registry_not_configured" });
      expect(capabilities.json().capabilities.onchainAssetRegistryIntegrity).toMatchObject({ status: "not_configured", configured: false, verified: false });
      expect(capabilities.json().capabilities.onchainBalances).toEqual({ implemented: false, enabled: false });
    } finally { await app.close(); }
  });



  it("treats blank optional registry environment placeholders as unconfigured", async () => {
    const app = await buildApp({
      logger: false,
      onchainAssetRegistryJson: "",
      onchainAssetRegistrySha256: ""
    });
    try {
      const status = await app.inject({ method: "GET", url: "/api/assets/onchain/registry-status" });
      expect(status.json()).toEqual({
        status: "not_configured",
        configured: false,
        verified: false,
        assetCount: 0,
        reason: "registry_not_configured"
      });
    } finally {
      await app.close();
    }
  });

  it("reports pinned registry integrity without enabling discovery", async () => {
    const rawJson = JSON.stringify([{
      chainId: PORTALDOT_V3_EVM_CHAIN_ID,
      contractAddress: "0x1111111111111111111111111111111111111111",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      provenance: "verified_registry"
    }]);
    const sha256 = createHash("sha256").update(rawJson).digest("hex");
    const signed = await signRegistry(rawJson);
    const app = await buildApp({
      logger: false,
      onchainAssetRegistryJson: rawJson,
      onchainAssetRegistrySha256: sha256,
      onchainAssetRegistrySignature: signed.signature,
      onchainAssetRegistryPublicKey: signed.publicKey
    });
    try {
      const status = await app.inject({ method: "GET", url: "/api/assets/onchain/registry-status" });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toEqual({ status: "verified", configured: true, verified: true, assetCount: 1 });

      const assets = await app.inject({ method: "GET", url: "/api/assets/onchain" });
      expect(assets.json()).toEqual({ status: "unavailable", items: [], reason: "runtime_adapter_unverified" });

      const capabilities = await app.inject({ method: "GET", url: "/api/capabilities" });
      expect(capabilities.json().capabilities.onchainAssetRegistryIntegrity).toMatchObject({ verified: true, assetCount: 1 });
      expect(capabilities.json().capabilities.onchainAssetDiscovery).toEqual({ implemented: false, enabled: false, reason: "runtime_adapter_unverified" });
      expect(capabilities.json().capabilities.onchainBalances).toEqual({ implemented: false, enabled: false });
      expect(capabilities.json().safety.tradingEnabled).toBe(false);
    } finally {
      await app.close();
    }
  });

  it("fails closed on a mismatched registry digest and reports no assets", async () => {
    const rawJson = JSON.stringify([{
      chainId: PORTALDOT_V3_EVM_CHAIN_ID,
      contractAddress: "0x1111111111111111111111111111111111111111",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      provenance: "verified_registry"
    }]);
    const signed = await signRegistry(rawJson);
    const app = await buildApp({
      logger: false,
      onchainAssetRegistryJson: rawJson,
      onchainAssetRegistrySha256: "0".repeat(64),
      onchainAssetRegistrySignature: signed.signature,
      onchainAssetRegistryPublicKey: signed.publicKey
    });
    try {
      const status = await app.inject({ method: "GET", url: "/api/assets/onchain/registry-status" });
      expect(status.json()).toMatchObject({ status: "invalid", configured: true, verified: false, assetCount: 0, reason: "digest_mismatch" });
      const assets = await app.inject({ method: "GET", url: "/api/assets/onchain" });
      expect(assets.json()).toEqual({ status: "unavailable", items: [], reason: "registry_integrity_failed" });
    } finally {
      await app.close();
    }
  });

  it("returns only explicitly classified reference catalogue entries", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/api/markets" });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual(MARKET_INSTRUMENTS);
    await app.close();
  });

  it("rejects unknown symbols", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/api/markets/NOPE/quote" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });

  it("blocks quote and candle requests when the provider key is missing even if display is enabled", async () => {
    const getQuote = vi.fn();
    const getCandles = vi.fn();
    const fakeAdapter = { getQuote, getCandles } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketDataApiKey: "   ", marketData: fakeAdapter, marketDataDisplayEnabled: true });
    try {
      const quote = await app.inject({ method: "GET", url: "/api/markets/AAPL/quote" });
      const candles = await app.inject({ method: "GET", url: "/api/markets/AAPL/candles" });
      expect(quote.statusCode).toBe(503);
      expect(quote.json().error.code).toBe("PROVIDER_NOT_CONFIGURED");
      expect(candles.statusCode).toBe(503);
      expect(candles.json().error.code).toBe("PROVIDER_NOT_CONFIGURED");
      expect(getQuote).not.toHaveBeenCalled();
      expect(getCandles).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("blocks live quote display by default until licensing is confirmed", async () => {
    const getQuote = vi.fn();
    const fakeAdapter = { getQuote, getCandles: vi.fn() } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketDataApiKey: "configured-key", marketData: fakeAdapter });
    const response = await app.inject({ method: "GET", url: "/api/markets/AAPL/quote" });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("MARKET_DATA_DISPLAY_DISABLED");
    expect(getQuote).not.toHaveBeenCalled();
    await app.close();
  });

  it("validates candle outputsize as decimal digits and enforces the 1–500 range", async () => {
    const getCandles = vi.fn().mockResolvedValue([]);
    const fakeAdapter = { getQuote: vi.fn(), getCandles } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketDataApiKey: "configured-key", marketData: fakeAdapter, marketDataDisplayEnabled: true });
    try {
      const invalidInterval = await app.inject({ method: "GET", url: "/api/markets/AAPL/candles?interval=2min" });
      const invalidSizes = await Promise.all(["abc", "1.5", "-1", "0", "501", "1d"].map((size) =>
        app.inject({ method: "GET", url: `/api/markets/AAPL/candles?outputsize=${encodeURIComponent(size)}` })
      ));
      expect(invalidInterval.statusCode).toBe(400);
      expect(invalidSizes.every((response) => response.statusCode === 400)).toBe(true);
      expect(getCandles).not.toHaveBeenCalled();

      const validSize = await app.inject({ method: "GET", url: "/api/markets/AAPL/candles?outputsize=30" });
      expect(validSize.statusCode).toBe(200);
      expect(getCandles).toHaveBeenCalledWith(MARKET_INSTRUMENTS[0], "1day", 30);
    } finally {
      await app.close();
    }
  });

  it("returns a normalized error when the API rate limit is exceeded", async () => {
    const app = await buildApp({ logger: false });
    let response;
    for (let index = 0; index < 61; index += 1) {
      response = await app.inject({ method: "GET", url: "/api/health" });
    }
    expect(response?.statusCode).toBe(429);
    expect(response?.json().error).toMatchObject({ code: "RATE_LIMITED", message: "Too many requests. Please retry later." });
    expect(response?.json().error.requestId).toBeTruthy();
    await app.close();
  });

  it("does not leak provider details on errors", async () => {
    const fakeAdapter = {
      getQuote: vi.fn().mockRejectedValue(new MarketDataError("PROVIDER_RATE_LIMIT", "Market data provider rate limit reached.", 429)),
      getCandles: vi.fn()
    } as unknown as TwelveDataAdapter;
    const app = await buildApp({ logger: false, marketDataApiKey: "configured-key", marketData: fakeAdapter, marketDataDisplayEnabled: true });
    const response = await app.inject({ method: "GET", url: "/api/markets/AAPL/quote" });
    expect(response.statusCode).toBe(429);
    expect(response.json().error).toMatchObject({ code: "PROVIDER_RATE_LIMIT" });
    expect(response.body).not.toContain("apikey");
    await app.close();
  });
});
