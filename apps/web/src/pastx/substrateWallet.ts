// Substrate wallet support: enumerate installed extensions, connect a chosen
// one, list its accounts, read balances, and sign native transfers (used by the
// "top up EVM" flow and native sends).
import { ApiPromise, WsProvider } from "@polkadot/api";
import { web3Enable, web3Accounts, web3FromAddress } from "@polkadot/extension-dapp";
import { PORTALDOT } from "./config";
import { evmToSubstrate } from "./accountMapping";

export type SubstrateAccount = { address: string; name?: string; source: string };
export type SubstrateWalletInfo = { source: string; name: string };

const WALLET_NAMES: Record<string, string> = {
  "polkadot-js": "Polkadot.js",
  talisman: "Talisman",
  "subwallet-js": "SubWallet",
  "nova wallet": "Nova Wallet",
  enkrypt: "Enkrypt",
  fearless: "Fearless",
};

let apiPromise: Promise<ApiPromise> | null = null;
export function portalApi(): Promise<ApiPromise> {
  if (!apiPromise) apiPromise = ApiPromise.create({ provider: new WsProvider(PORTALDOT.wsRpc) });
  return apiPromise;
}

/** Installed Substrate wallet extensions, from window.injectedWeb3. */
export function listSubstrateWallets(): SubstrateWalletInfo[] {
  const inj = (globalThis as any).window?.injectedWeb3 || {};
  return Object.keys(inj).map((source) => ({ source, name: WALLET_NAMES[source] || source }));
}

/** Enable extensions and return accounts for the chosen wallet source. */
export async function connectSubstrateWallet(source: string): Promise<SubstrateAccount[]> {
  const extensions = await web3Enable("PASTX");
  if (!extensions.length) throw new Error("No Substrate wallet enabled. Approve access in your extension.");
  const accounts = await web3Accounts({ ss58Format: PORTALDOT.ss58Format });
  const forSource = accounts.filter((a) => a.meta.source === source);
  return (forSource.length ? forSource : accounts).map((a) => ({ address: a.address, name: a.meta.name, source: a.meta.source }));
}

/** Free native balance (14-decimal units) of a Substrate 5... address. */
export async function substrateFreeBalance(address: string): Promise<bigint> {
  const api = await portalApi();
  const acct: any = await api.query.system.account(address);
  return BigInt(acct.data.free.toString());
}

/** Result of a signed substrate transfer: the extrinsic hash + the finalized block hash. */
export type SubstrateTxResult = { txHash: string; block: string };

/**
 * Transfer native tPOT. `nativeAmount` is in 14-decimal native units.
 * onStatus gets human status strings; resolves with the extrinsic hash and the
 * finalized block hash (both link into the Portaldot explorer).
 */
export async function transferNative(
  from: string, to: string, nativeAmount: bigint, onStatus?: (s: string) => void,
): Promise<SubstrateTxResult> {
  const api = await portalApi();
  const injector = await web3FromAddress(from);
  const tx = api.tx.balances.transferKeepAlive(to, nativeAmount);
  const txHash = tx.hash.toHex();
  return new Promise<SubstrateTxResult>((resolve, reject) => {
    tx.signAndSend(from, { signer: injector.signer }, (result: any) => {
      onStatus?.(result.status.type);
      if (result.status.isInBlock) onStatus?.("In block — finalizing");
      if (result.dispatchError) reject(new Error(result.dispatchError.toString()));
      else if (result.status.isFinalized) resolve({ txHash, block: result.status.asFinalized.toString() });
    }).catch(reject);
  });
}

/** Top up an EVM account by sending native tPOT to its backing 5... (mapped, non-editable). */
export async function topUpEvm(
  fromSubstrate: string, evmAddress: string, nativeAmount: bigint, onStatus?: (s: string) => void,
): Promise<{ dest: string } & SubstrateTxResult> {
  const dest = evmToSubstrate(evmAddress);
  const { txHash, block } = await transferNative(fromSubstrate, dest, nativeAmount, onStatus);
  return { dest, txHash, block };
}
