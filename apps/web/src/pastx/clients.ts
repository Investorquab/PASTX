// viem chains + public clients for Portaldot V3 and BNB testnet, plus a helper
// to get an injected (MetaMask) wallet client and switch/add networks.
import { createPublicClient, createWalletClient, custom, http, defineChain, type Chain } from "viem";
import { PORTALDOT, BNB } from "./config";

export const portaldotChain: Chain = defineChain({
  id: PORTALDOT.evmChainId,
  name: PORTALDOT.label,
  nativeCurrency: { name: "Portaldot Test", symbol: PORTALDOT.nativeSymbol, decimals: 18 },
  rpcUrls: { default: { http: [PORTALDOT.evmRpc] } },
});

export const bnbChain: Chain = defineChain({
  id: BNB.evmChainId,
  name: BNB.label,
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: { default: { http: [BNB.evmRpc] } },
  blockExplorers: { default: { name: "BscScan Testnet", url: "https://testnet.bscscan.com" } },
});

export const chainByKey = { portaldot: portaldotChain, bnb: bnbChain } as const;

export const portalPublic = createPublicClient({ chain: portaldotChain, transport: http(PORTALDOT.evmRpc) });
export const bnbPublic = createPublicClient({ chain: bnbChain, transport: http(BNB.evmRpc) });
export const publicByKey = { portaldot: portalPublic, bnb: bnbPublic } as const;

export function walletClientFor(chain: Chain, provider: any) {
  if (!provider) throw new Error("No EVM wallet connected.");
  return createWalletClient({ chain, transport: custom(provider) });
}

/** Ensure the connected wallet is on `chain`, adding it if the wallet doesn't know it. */
export async function ensureChain(chain: Chain, provider: any): Promise<void> {
  const eth = provider;
  const hexId = "0x" + chain.id.toString(16);
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (err: any) {
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message || "")) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
        }],
      });
    } else {
      throw err;
    }
  }
}
