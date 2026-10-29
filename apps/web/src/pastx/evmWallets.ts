// EVM wallet discovery via EIP-6963 (multi-injected-provider), so the user can
// pick MetaMask / Rabby / OKX / etc. Falls back to legacy window.ethereum.
import { getAddress } from "viem";

export type Eip6963Wallet = { uuid: string; name: string; icon: string; rdns: string; provider: any };

const discovered = new Map<string, Eip6963Wallet>();
let listening = false;

function ensureListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("eip6963:announceProvider", (e: any) => {
    const d = e.detail;
    if (d?.info?.uuid) discovered.set(d.info.uuid, { ...d.info, provider: d.provider });
  });
}

/** Discover installed EVM wallets. Waits briefly for providers to announce. */
export function discoverEvmWallets(waitMs = 300): Promise<Eip6963Wallet[]> {
  ensureListening();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("eip6963:requestProvider"));
  return new Promise((resolve) => setTimeout(() => {
    const arr = Array.from(discovered.values());
    if (arr.length) return resolve(arr);
    const eth = (globalThis as any).window?.ethereum;
    if (eth) {
      const name = eth.isRabby ? "Rabby" : eth.isOkxWallet || eth.isOKExWallet ? "OKX Wallet" : eth.isMetaMask ? "MetaMask" : "Browser Wallet";
      return resolve([{ uuid: "injected", name, icon: "", rdns: "injected", provider: eth }]);
    }
    resolve([]);
  }, waitMs));
}

export async function connectEvmProvider(provider: any): Promise<{ address: `0x${string}`; chainId: number }> {
  const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No account authorized in the wallet.");
  const chainIdHex: string = await provider.request({ method: "eth_chainId" });
  return { address: getAddress(accounts[0]), chainId: parseInt(chainIdHex, 16) };
}
