import { describe, expect, it, vi } from "vitest";
import { ApiClientError, getChainStatus } from "./api";

describe("getChainStatus", () => {
  it("returns the read-only status object", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      item: {
        configured: true, reachable: true, networkMatches: true,
        expectedChainId: 420420777, chainId: 420420777, status: "verified"
      }
    }), { status: 200 }));
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).resolves.toMatchObject({
      status: "verified", chainId: 420420777, networkMatches: true
    });
  });

  it("reports API transport failures safely", async () => {
    await expect(getChainStatus(async () => { throw new Error("private detail"); })).rejects.toMatchObject({
      name: "ApiClientError", message: "PASTX API is unavailable."
    });
  });

  it("rejects malformed API payloads", async () => {
    const fetcher = async () => new Response(JSON.stringify({ item: { status: "unknown" } }), { status: 200 });
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiClientError);
  });

  it("maps non-2xx responses to safe client errors", async () => {
    const fetcher = async () => new Response("private upstream details", { status: 503 });
    await expect(getChainStatus(fetcher as unknown as typeof fetch)).rejects.toMatchObject({ statusCode: 503 });
  });
});
