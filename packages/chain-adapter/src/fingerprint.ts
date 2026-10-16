import { createPublicClient, http } from "viem";

const VERIFICATION_SCOPE = "chain_id_genesis_checkpoint_latest_block_read" as const;
const EVM_HASH = /^0x[a-fA-F0-9]{64}$/;
const BLOCK_NUMBER = /^(0|[1-9][0-9]{0,77})$/;

export type ChainFingerprintObservation = {
  chainId: number;
  latestBlockNumber: bigint;
  genesisHash: string | null;
  checkpointHash: string | null;
};

export type ChainFingerprintReader = (
  rpcUrl: string,
  checkpointBlockNumber: bigint
) => Promise<ChainFingerprintObservation>;

export type ChainFingerprintConfig = {
  rpcUrl?: string;
  expectedChainId: number;
  expectedGenesisHash?: string;
  checkpointBlock?: string;
  expectedCheckpointHash?: string;
};

type FingerprintReason =
  | "chain_id_mismatch"
  | "genesis_hash_mismatch"
  | "checkpoint_hash_mismatch"
  | "checkpoint_not_reached";

export type ChainFingerprintResult =
  | {
      configured: false;
      reachable: false;
      verified: false;
      status: "not_configured";
      reason: "trusted_fingerprint_not_configured";
      expectedChainId: number;
      checkpointBlock: null;
      verificationScope: typeof VERIFICATION_SCOPE;
    }
  | {
      configured: true;
      reachable: false;
      verified: false;
      status: "invalid_config";
      reason: "invalid_fingerprint_configuration";
      expectedChainId: number;
      checkpointBlock: string | null;
      verificationScope: typeof VERIFICATION_SCOPE;
    }
  | {
      configured: true;
      reachable: false;
      verified: false;
      status: "unreachable";
      reason: "rpc_unavailable";
      expectedChainId: number;
      checkpointBlock: string;
      chainId: null;
      genesisHash: null;
      checkpointHash: null;
      latestBlockNumber: null;
      verificationScope: typeof VERIFICATION_SCOPE;
    }
  | {
      configured: true;
      reachable: true;
      verified: false;
      status: "mismatch";
      reason: FingerprintReason;
      expectedChainId: number;
      checkpointBlock: string;
      chainId: number;
      genesisHash: string;
      checkpointHash: string | null;
      latestBlockNumber: string;
      verificationScope: typeof VERIFICATION_SCOPE;
    }
  | {
      configured: true;
      reachable: true;
      verified: true;
      status: "verified";
      expectedChainId: number;
      checkpointBlock: string;
      chainId: number;
      genesisHash: string;
      checkpointHash: string;
      latestBlockNumber: string;
      verificationScope: typeof VERIFICATION_SCOPE;
    };

function isHash(value: string | null | undefined): value is string {
  return typeof value === "string" && EVM_HASH.test(value);
}

function isHttpRpcUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0 && !url.username && !url.password &&
      !/[\u0000-\u0020\u007f]/.test(value);
  } catch {
    return false;
  }
}

const readChainFingerprint: ChainFingerprintReader = async (rpcUrl, checkpointBlockNumber) => {
  const client = createPublicClient({
    transport: http(rpcUrl, { timeout: 5_000, retryCount: 0 })
  });
  const [chainId, latestBlockNumber, genesisBlock] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    client.getBlock({ blockNumber: 0n })
  ]);
  if (latestBlockNumber < checkpointBlockNumber) {
    return { chainId, latestBlockNumber, genesisHash: genesisBlock.hash, checkpointHash: null };
  }
  const checkpoint = await client.getBlock({ blockNumber: checkpointBlockNumber });
  return {
    chainId,
    latestBlockNumber,
    genesisHash: genesisBlock.hash,
    checkpointHash: checkpoint.hash
  };
};

/**
 * Verifies an RPC response against independently provisioned chain ID, genesis
 * hash, and checkpoint block hash. This anchors the observed history only
 * through the configured checkpoint; it does not prove finality or head progress.
 */
export async function verifyEvmChainFingerprint(
  config: ChainFingerprintConfig,
  reader: ChainFingerprintReader = readChainFingerprint
): Promise<ChainFingerprintResult> {
  const expectedGenesisHash = config.expectedGenesisHash?.trim();
  const checkpointBlock = config.checkpointBlock?.trim();
  const expectedCheckpointHash = config.expectedCheckpointHash?.trim();
  const anchorsAbsent = !expectedGenesisHash && !checkpointBlock && !expectedCheckpointHash;

  if (anchorsAbsent) {
    return {
      configured: false,
      reachable: false,
      verified: false,
      status: "not_configured",
      reason: "trusted_fingerprint_not_configured",
      expectedChainId: config.expectedChainId,
      checkpointBlock: null,
      verificationScope: VERIFICATION_SCOPE
    };
  }

  const expectedChainId = config.expectedChainId;
  const validBlockNumber = checkpointBlock !== undefined && BLOCK_NUMBER.test(checkpointBlock);
  if (
    !Number.isSafeInteger(expectedChainId) ||
    expectedChainId <= 0 ||
    !isHash(expectedGenesisHash) ||
    !validBlockNumber ||
    !isHash(expectedCheckpointHash)
  ) {
    return {
      configured: true,
      reachable: false,
      verified: false,
      status: "invalid_config",
      reason: "invalid_fingerprint_configuration",
      expectedChainId,
      checkpointBlock: checkpointBlock ?? null,
      verificationScope: VERIFICATION_SCOPE
    };
  }

  const checkpoint = BigInt(checkpointBlock);
  if (!config.rpcUrl?.trim() || !isHttpRpcUrl(config.rpcUrl)) {
    return {
      configured: true,
      reachable: false,
      verified: false,
      status: "unreachable",
      reason: "rpc_unavailable",
      expectedChainId,
      checkpointBlock,
      chainId: null,
      genesisHash: null,
      checkpointHash: null,
      latestBlockNumber: null,
      verificationScope: VERIFICATION_SCOPE
    };
  }

  try {
    const observed = await reader(config.rpcUrl, checkpoint);
    if (
      !Number.isSafeInteger(observed.chainId) ||
      observed.chainId <= 0 ||
      typeof observed.latestBlockNumber !== "bigint" ||
      observed.latestBlockNumber < 0n ||
      !isHash(observed.genesisHash) ||
      (observed.checkpointHash !== null && !isHash(observed.checkpointHash))
    ) {
      throw new Error("Invalid chain fingerprint response");
    }

    const observedBase = {
      configured: true as const,
      reachable: true as const,
      verified: false as const,
      expectedChainId,
      checkpointBlock,
      chainId: observed.chainId,
      genesisHash: observed.genesisHash,
      checkpointHash: observed.checkpointHash,
      latestBlockNumber: observed.latestBlockNumber.toString(),
      verificationScope: VERIFICATION_SCOPE
    };

    if (observed.chainId !== expectedChainId) {
      return { ...observedBase, status: "mismatch", reason: "chain_id_mismatch" };
    }
    if (observed.genesisHash.toLowerCase() !== expectedGenesisHash.toLowerCase()) {
      return { ...observedBase, status: "mismatch", reason: "genesis_hash_mismatch" };
    }
    if (observed.latestBlockNumber < checkpoint) {
      return { ...observedBase, status: "mismatch", reason: "checkpoint_not_reached" };
    }
    if (
      !observed.checkpointHash ||
      observed.checkpointHash.toLowerCase() !== expectedCheckpointHash.toLowerCase()
    ) {
      return { ...observedBase, status: "mismatch", reason: "checkpoint_hash_mismatch" };
    }

    return {
      ...observedBase,
      verified: true,
      status: "verified",
      checkpointHash: observed.checkpointHash
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      verified: false,
      status: "unreachable",
      reason: "rpc_unavailable",
      expectedChainId,
      checkpointBlock,
      chainId: null,
      genesisHash: null,
      checkpointHash: null,
      latestBlockNumber: null,
      verificationScope: VERIFICATION_SCOPE
    };
  }
}
