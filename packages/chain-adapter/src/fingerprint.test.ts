import { describe, expect, it, vi } from "vitest";
import {
  verifyEvmChainFingerprint,
  type ChainFingerprintObservation
} from "./fingerprint";

const GENESIS = "0x" + "1".repeat(64);
const CHECKPOINT = "0x" + "2".repeat(64);
const OTHER = "0x" + "3".repeat(64);
const config = {
  rpcUrl: "https://rpc.example",
  expectedChainId: 5042,
  expectedGenesisHash: GENESIS,
  checkpointBlock: "100",
  expectedCheckpointHash: CHECKPOINT
};
const observation: ChainFingerprintObservation = {
  chainId: 5042,
  latestBlockNumber: 123n,
  genesisHash: GENESIS,
  checkpointHash: CHECKPOINT
};
const readerFor = (value: ChainFingerprintObservation) => vi.fn(async () => value);

describe("verifyEvmChainFingerprint", () => {
  it("does not attempt RPC access until trusted genesis and checkpoint anchors are configured", async () => {
    const reader = readerFor(observation);
    await expect(verifyEvmChainFingerprint({
      rpcUrl: config.rpcUrl,
      expectedChainId: config.expectedChainId
    }, reader)).resolves.toMatchObject({
      status: "not_configured",
      configured: false,
      verified: false,
      reason: "trusted_fingerprint_not_configured"
    });
    expect(reader).not.toHaveBeenCalled();
  });

  it("requires all well-formed trusted anchors", async () => {
    const reader = readerFor(observation);
    await expect(verifyEvmChainFingerprint({ ...config, expectedCheckpointHash: undefined }, reader)).resolves.toMatchObject({
      status: "invalid_config",
      reason: "invalid_fingerprint_configuration"
    });
    await expect(verifyEvmChainFingerprint({ ...config, checkpointBlock: "01" }, reader)).resolves.toMatchObject({
      status: "invalid_config"
    });
    expect(reader).not.toHaveBeenCalled();
  });

  it("verifies chain ID, genesis hash, and checkpoint hash", async () => {
    const reader = readerFor(observation);
    await expect(verifyEvmChainFingerprint(config, reader)).resolves.toMatchObject({
      status: "verified",
      configured: true,
      reachable: true,
      verified: true,
      chainId: 5042,
      genesisHash: GENESIS,
      checkpointHash: CHECKPOINT,
      latestBlockNumber: "123",
      verificationScope: "chain_id_genesis_checkpoint_latest_block_read"
    });
    expect(reader).toHaveBeenCalledWith(config.rpcUrl, 100n);
  });

  it("rejects a matching chain ID when genesis does not match the trusted anchor", async () => {
    await expect(verifyEvmChainFingerprint(config, readerFor({ ...observation, genesisHash: OTHER }))).resolves.toMatchObject({
      status: "mismatch",
      reason: "genesis_hash_mismatch",
      verified: false
    });
  });

  it("rejects a matching genesis when checkpoint hash does not match", async () => {
    await expect(verifyEvmChainFingerprint(config, readerFor({ ...observation, checkpointHash: OTHER }))).resolves.toMatchObject({
      status: "mismatch",
      reason: "checkpoint_hash_mismatch",
      verified: false
    });
  });

  it("does not claim verification when the endpoint has not reached the pinned checkpoint", async () => {
    await expect(verifyEvmChainFingerprint(config, readerFor({
      ...observation, latestBlockNumber: 99n, checkpointHash: null
    }))).resolves.toMatchObject({
      status: "mismatch",
      reason: "checkpoint_not_reached",
      verified: false
    });
  });

  it("reports chain ID mismatches distinctly", async () => {
    await expect(verifyEvmChainFingerprint(config, readerFor({ ...observation, chainId: 1 }))).resolves.toMatchObject({
      status: "mismatch",
      reason: "chain_id_mismatch",
      verified: false
    });
  });

  it("fails closed on RPC errors and malformed URLs", async () => {
    const failedReader = vi.fn(async () => { throw new Error("private RPC details"); });
    await expect(verifyEvmChainFingerprint(config, failedReader)).resolves.toMatchObject({
      status: "unreachable",
      reason: "rpc_unavailable",
      chainId: null
    });
    const reader = readerFor(observation);
    await expect(verifyEvmChainFingerprint({ ...config, rpcUrl: "file:///etc/passwd" }, reader)).resolves.toMatchObject({
      status: "unreachable",
      reason: "rpc_unavailable"
    });
    expect(reader).not.toHaveBeenCalled();
  });
});
