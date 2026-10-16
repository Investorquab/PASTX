import { describe, expect, it, vi } from "vitest";
import { PORTALDOT_V3_EVM_CHAIN_ID, probePortaldotEvm } from "./index";

const reader = (chainId: number, blockNumber = 123n) => vi.fn(async () => ({ chainId, blockNumber }));

describe("probePortaldotEvm", () => {
  it("reports missing configuration without attempting RPC access", async () => {
    const readProbe = vi.fn();
    await expect(probePortaldotEvm(undefined, readProbe)).resolves.toMatchObject({
      configured: false, reachable: false, status: "not_configured", chainId: null, blockNumber: null,
      verificationScope: "chain_id_and_latest_block_read"
    });
    expect(readProbe).not.toHaveBeenCalled();
  });
  it("requires expected chain ID and a successful latest-block read", async () => {
    await expect(probePortaldotEvm("https://rpc.example", reader(PORTALDOT_V3_EVM_CHAIN_ID))).resolves.toMatchObject({
      configured: true, reachable: true, networkMatches: true, status: "verified", chainId: 420420777,
      blockNumber: "123", verificationScope: "chain_id_and_latest_block_read"
    });
  });
  it("supports an explicitly configured expected chain ID", async () => {
    await expect(probePortaldotEvm("https://rpc.example", reader(5042), 5042)).resolves.toMatchObject({
      expectedChainId: 5042, chainId: 5042, blockNumber: "123", status: "verified"
    });
  });
  it("rejects invalid expected chain IDs", async () => {
    await expect(probePortaldotEvm("https://rpc.example", reader(1), 0)).rejects.toThrow("Expected EVM chain ID must be a positive safe integer.");
  });
  it("distinguishes a reachable endpoint on the wrong network", async () => {
    await expect(probePortaldotEvm("https://rpc.example", reader(1))).resolves.toMatchObject({
      configured: true, reachable: true, networkMatches: false, chainId: 1, blockNumber: "123", status: "wrong_network"
    });
  });
  it("reports RPC failures without exposing provider error details", async () => {
    await expect(probePortaldotEvm("https://rpc.example", vi.fn(async () => { throw new Error("secret RPC details"); })).resolves.toMatchObject({
      configured: true, reachable: false, status: "unreachable", chainId: null, blockNumber: null
    });
  });
  it("rejects invalid chain IDs and block numbers", async () => {
    await expect(probePortaldotEvm("https://rpc.example", reader(Number.NaN))).resolves.toMatchObject({ status: "unreachable", chainId: null });
    await expect(probePortaldotEvm("https://rpc.example", reader(PORTALDOT_V3_EVM_CHAIN_ID, -1n))).resolves.toMatchObject({ status: "unreachable", chainId: null, blockNumber: null });
  });
});
