export type ChainStatus = {
  configured: boolean;
  reachable: boolean;
  networkMatches: boolean;
  expectedChainId: number;
  chainId: number | null;
  status: "not_configured" | "unreachable" | "verified" | "wrong_network";
};

export class ApiClientError extends Error {
  constructor(message: string, public readonly statusCode: number | null = null) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function getChainStatus(fetchImpl: typeof fetch = fetch): Promise<ChainStatus> {
  let response: Response;
  try {
    response = await fetchImpl("/api/chain/status", { headers: { accept: "application/json" } });
  } catch {
    throw new ApiClientError("PASTX API is unavailable.");
  }

  if (!response.ok) throw new ApiClientError("PASTX API could not return chain status.", response.status);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError("PASTX API returned an invalid response.", response.status);
  }

  if (typeof payload !== "object" || payload === null || !("item" in payload)) {
    throw new ApiClientError("PASTX API returned an invalid chain status.");
  }

  const item = (payload as { item?: unknown }).item;
  if (typeof item !== "object" || item === null) throw new ApiClientError("PASTX API returned an invalid chain status.");
  const status = item as Record<string, unknown>;
  const allowed = ["not_configured", "unreachable", "verified", "wrong_network"];
  if (
    typeof status.configured !== "boolean" ||
    typeof status.reachable !== "boolean" ||
    typeof status.networkMatches !== "boolean" ||
    typeof status.expectedChainId !== "number" ||
    !(status.chainId === null || typeof status.chainId === "number") ||
    typeof status.status !== "string" ||
    !allowed.includes(status.status)
  ) {
    throw new ApiClientError("PASTX API returned an invalid chain status.");
  }

  return status as unknown as ChainStatus;
}
