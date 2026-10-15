import { describe, expect, it, vi } from "vitest";
import { PORTALDOT_V3_EVM_CHAIN_ID, probePortaldotEvm } from "./index";

describe("probePortaldotEvm", () => {
  it("reports missing configuration without attempting RPC access", async () => {
    const reader = vi.fn();
    await expect(probePortaldotEvm(undefined, reader)).resolves.toMatchObject({
      configured: false, reachable: false, status: "not_configured", chainId: null
    });
    expect(reader).not.toHaveBeenCalled();
  });

  it("marks the expected Portaldot V3 EVM chain as verified", async () => {
    await expect(probePortaldotEvm("https://rpc.example", async () => PORTALDOT_V3_EVM_CHAIN_ID)).resolves.toMatchObject({
      configured: true, reachable: true, networkMatches: true, status: "verified", chainId: 420420777
    });
  });

  it("rejects a reachable but incorrect network", async () => {
    await expect(probePortaldotEvm("https://rpc.example", async () => 1)).resolves.toMatchObject({
      configured: true, reachable: true, networkMatches: false, status: "wrong_network", chainId: 1
    });
  });

  it("reports unreachable RPC without exposing provider error details", async () => {
    await expect(probePortaldotEvm("https://rpc.example", async () => { throw new Error("secret RPC details"); })).resolves.toMatchObject({
      configured: true, reachable: false, networkMatches: false, status: "unreachable", chainId: null
    });
  });

  it("rejects invalid chain IDs", async () => {
    await expect(probePortaldotEvm("https://rpc.example", async () => Number.NaN)).resolves.toMatchObject({
      status: "unreachable", chainId: null
    });
  });
});
