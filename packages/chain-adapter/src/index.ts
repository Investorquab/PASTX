import { createPublicClient, http } from "viem";

export const PORTALDOT_V3_EVM_CHAIN_ID = 420420777;
const VERIFICATION_SCOPE = "chain_id_and_latest_block_read" as const;

export type ChainProbeResult =
  | { configured: false; reachable: false; networkMatches: false; expectedChainId: number; chainId: null; blockNumber: null; status: "not_configured"; verificationScope: typeof VERIFICATION_SCOPE }
  | { configured: true; reachable: false; networkMatches: false; expectedChainId: number; chainId: null; blockNumber: null; status: "unreachable"; verificationScope: typeof VERIFICATION_SCOPE }
  | { configured: true; reachable: true; networkMatches: boolean; expectedChainId: number; chainId: number; blockNumber: string; status: "verified" | "wrong_network"; verificationScope: typeof VERIFICATION_SCOPE };

export type ChainProbeReader = (rpcUrl: string) => Promise<{ chainId: number; blockNumber: bigint }>;

const readChainProbe: ChainProbeReader = async (rpcUrl) => {
  const client = createPublicClient({ transport: http(rpcUrl, { timeout: 5_000, retryCount: 0 }) });
  const [chainId, blockNumber] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
  return { chainId, blockNumber };
};

/** Read-only RPC check; it never signs or submits transactions. */
export async function probePortaldotEvm(
  rpcUrl: string | undefined,
  readProbe: ChainProbeReader = readChainProbe,
  expectedChainId = PORTALDOT_V3_EVM_CHAIN_ID
): Promise<ChainProbeResult> {
  if (!Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) throw new Error("Expected EVM chain ID must be a positive safe integer.");
  if (!rpcUrl?.trim()) {
    return { configured: false, reachable: false, networkMatches: false, expectedChainId, chainId: null, blockNumber: null, status: "not_configured", verificationScope: VERIFICATION_SCOPE };
  }
  try {
    const { chainId, blockNumber } = await readProbe(rpcUrl);
    if (!Number.isSafeInteger(chainId) || chainId <= 0 || typeof blockNumber !== "bigint" || blockNumber < 0n) throw new Error("Invalid RPC response");
    const networkMatches = chainId === expectedChainId;
    return { configured: true, reachable: true, networkMatches, expectedChainId, chainId, blockNumber: blockNumber.toString(), status: networkMatches ? "verified" : "wrong_network", verificationScope: VERIFICATION_SCOPE };
  } catch {
    return { configured: true, reachable: false, networkMatches: false, expectedChainId, chainId: null, blockNumber: null, status: "unreachable", verificationScope: VERIFICATION_SCOPE };
  }
}
