import { createPublicClient, http } from "viem";

export const PORTALDOT_V3_EVM_CHAIN_ID = 420420777;

export type ChainProbeResult =
  | { configured: false; reachable: false; networkMatches: false; expectedChainId: number; chainId: null; status: "not_configured" }
  | { configured: true; reachable: false; networkMatches: false; expectedChainId: number; chainId: null; status: "unreachable" }
  | { configured: true; reachable: true; networkMatches: boolean; expectedChainId: number; chainId: number; status: "verified" | "wrong_network" };

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
  getChainId: ChainIdReader = readChainId
): Promise<ChainProbeResult> {
  if (!rpcUrl?.trim()) {
    return {
      configured: false,
      reachable: false,
      networkMatches: false,
      expectedChainId: PORTALDOT_V3_EVM_CHAIN_ID,
      chainId: null,
      status: "not_configured"
    };
  }

  try {
    const chainId = await getChainId(rpcUrl);
    if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("Invalid chain ID");
    const networkMatches = chainId === PORTALDOT_V3_EVM_CHAIN_ID;
    return {
      configured: true,
      reachable: true,
      networkMatches,
      expectedChainId: PORTALDOT_V3_EVM_CHAIN_ID,
      chainId,
      status: networkMatches ? "verified" : "wrong_network"
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      networkMatches: false,
      expectedChainId: PORTALDOT_V3_EVM_CHAIN_ID,
      chainId: null,
      status: "unreachable"
    };
  }
}
