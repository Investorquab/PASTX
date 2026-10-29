import { useCallback, useState } from "react";
import { getAddress } from "viem";
import { connectEvmProvider, type Eip6963Wallet } from "./evmWallets";
import { connectSubstrateWallet, type SubstrateAccount } from "./substrateWallet";
import { evmToSubstrate } from "./accountMapping";

export type EvmState = { address: `0x${string}`; chainId: number; provider: any; walletName: string };

export function usePastxWallet() {
  const [evm, setEvm] = useState<EvmState | null>(null);
  const [substrateSource, setSubstrateSource] = useState<string | null>(null);
  const [substrateAccounts, setSubstrateAccounts] = useState<SubstrateAccount[]>([]);
  const [selectedSubstrate, setSelectedSubstrate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connectEvm = useCallback(async (wallet: Eip6963Wallet) => {
    setError(null); setBusy(true);
    try {
      const { address, chainId } = await connectEvmProvider(wallet.provider);
      setEvm({ address, chainId, provider: wallet.provider, walletName: wallet.name });
      wallet.provider.on?.("accountsChanged", (a: string[]) =>
        setEvm((prev) => (!a?.length ? null : prev ? { ...prev, address: getAddress(a[0]) } : prev)));
      wallet.provider.on?.("chainChanged", (c: string) =>
        setEvm((prev) => (prev ? { ...prev, chainId: parseInt(c, 16) } : prev)));
    } catch (e: any) { setError(e?.message || "EVM wallet connection failed."); }
    finally { setBusy(false); }
  }, []);

  const connectSubstrate = useCallback(async (source: string) => {
    setError(null); setBusy(true);
    try {
      const accs = await connectSubstrateWallet(source);
      setSubstrateSource(source);
      setSubstrateAccounts(accs);
      setSelectedSubstrate(accs[0]?.address ?? null);
    } catch (e: any) { setError(e?.message || "Substrate wallet connection failed."); }
    finally { setBusy(false); }
  }, []);

  const disconnectEvm = useCallback(() => setEvm(null), []);
  const disconnectSubstrate = useCallback(() => {
    setSubstrateSource(null); setSubstrateAccounts([]); setSelectedSubstrate(null);
  }, []);

  return {
    evm, substrateSource, substrateAccounts, selectedSubstrate,
    derivedSubstrate: evm ? evmToSubstrate(evm.address) : null,
    error, busy,
    connectEvm, connectSubstrate, disconnectEvm, disconnectSubstrate,
    selectSubstrate: setSelectedSubstrate,
    clearError: () => setError(null),
  };
}

export type PastxWallet = ReturnType<typeof usePastxWallet>;
