import { createPublicClient, http } from "viem";

export const PORTALDOT_V3_EVM_CHAIN_ID = 420420777;

export type ChainProbeResult =
  | { configured: false; reachable: false; networkMatches: false; expectedChainId: number; chainId: null; status: "not_configured"; verificationScope: "chain_id_only" }
  | { configured: true; reachable: false; networkMatches: false; expectedChainId: number; chainId: null; status: "unreachable"; verificationScope: "chain_id_only" }
  | { configured: true; reachable: true; networkMatches: boolean; expectedChainId: number; chainId: number; status: "verified" | "wrong_network"; verificationScope: "chain_id_only" };

export type ChainIdReader = (rpcUrl: string) => Promise<number>;

const readChainId: ChainIdReader = async (rpcUrl) => {
  const client = createPublicClient({ transport: http(rpcUrl, { timeout: 5_000, retryCount: 0 }) });
  return Number(await client.getChainId());
};

/**
 * Read-only network identity probe. It deliberately exposes no signing,
 * transfer, balance mutation, or transaction submission methods.
 */
export async function probePortaldotEvm(
  rpcUrl: string | undefined,
  getChainId: ChainIdReader = readChainId,
  expectedChainId = PORTALDOT_V3_EVM_CHAIN_ID
): Promise<ChainProbeResult> {
  if (!Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) throw new Error("Expected EVM chain ID must be a positive safe integer.");
  if (!rpcUrl?.trim()) {
    return {
      configured: false,
      reachable: false,
      networkMatches: false,
      expectedChainId,
      chainId: null,
      status: "not_configured",
      verificationScope: "chain_id_only"
    };
  }

  try {
    const chainId = await getChainId(rpcUrl);
    if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("Invalid chain ID");
    const networkMatches = chainId === expectedChainId;
    return {
      configured: true,
      reachable: true,
      networkMatches,
      expectedChainId,
      chainId,
      status: networkMatches ? "verified" : "wrong_network",
      verificationScope: "chain_id_only"
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      networkMatches: false,
      expectedChainId,
      chainId: null,
      status: "unreachable",
      verificationScope: "chain_id_only"
    };
  }
}
