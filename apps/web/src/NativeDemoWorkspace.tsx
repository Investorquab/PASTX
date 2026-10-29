import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import {ArrowLeftRight, CheckCircle2, ExternalLink, RefreshCw, ShieldCheck, X, Copy } from "lucide-react";
import { decodeNativeCommand, encodeNativeCommand, formatNativeTpot, type NativeCommandResult, type NativeDemoAction } from "./nativeContract";
import "./native-demo.css";

const RPC_URL = import.meta.env.VITE_PASTX_NATIVE_WS_RPC_URL?.trim() || "wss://test-node-v3.portaldot.dev";
const CONTRACT_ADDRESS = import.meta.env.VITE_PASTX_NATIVE_CONTRACT_ADDRESS?.trim() || "5G99ixmXqViMj8gVz4ZWGavV5ryeajGDY7Hq4qZ1qQN6pYFq";
const EXPECTED_GENESIS = import.meta.env.VITE_PASTX_NATIVE_EXPECTED_GENESIS_HASH?.trim().toLowerCase() || "";
const STOCKS = [
  { id: 0, symbol: "pAAPL", name: "Apple Demo", price: 200 },
  { id: 1, symbol: "pNVDA", name: "NVIDIA Demo", price: 180 },
  { id: 2, symbol: "pTSLA", name: "Tesla Demo", price: 250 },
  { id: 3, symbol: "pMSFT", name: "Microsoft Demo", price: 400 }
] as const;

type InjectedAccount = { address: string; meta?: { name?: string; source?: string } };
type InjectedExtension = {
  enable: (name: string) => Promise<{
    accounts: { get: () => Promise<InjectedAccount[]> };
    signer: unknown;
  }>;
};
type EnabledExtension = {
  accounts: { get: () => Promise<InjectedAccount[]> };
  signer: unknown;
};
type WalletAccount = { address: string; label: string; source: string };
type DryRun = {
  result: NativeCommandResult;
  storageDeposit: bigint;
  gasLimit: unknown;
  inputData: string;
};
type PendingAction = {
  action: 1 | 2 | 3;
  stockId: number;
  quantity: number;
  description: string;
  result: NativeCommandResult;
  storageDeposit: bigint;
  storageDepositLimit: bigint;
  estimatedFee: bigint;
  freeBalance: bigint;
  gasLimit: unknown;
  inputData: string;
};

declare global {
  interface Window {
    injectedWeb3?: Record<string, InjectedExtension>;
  }
}

function weightForDryRun(api: ApiPromise): unknown {
  const maxBlock = (api.consts.system as any)?.blockWeights?.maxBlock;
  return maxBlock ?? api.registry.createType("WeightV2", {
    refTime: "1000000000000",
    proofSize: "10000000"
  });
}

function weightForTransaction(api: ApiPromise, response: any): unknown {
  const gas = response?.gasRequired ?? response?.gasConsumed;
  if (gas?.refTime && gas?.proofSize) {
    const refTime = BigInt(gas.refTime.toString());
    const proofSize = BigInt(gas.proofSize.toString());
    return api.registry.createType("WeightV2", {
      refTime: ((refTime * 120n) / 100n).toString(),
      proofSize: ((proofSize * 120n) / 100n).toString()
    });
  }
  return weightForDryRun(api);
}

function depositCharge(response: any): bigint {
  const raw = typeof response?.toJSON === "function" ? response.toJSON() : response;
  const value = raw?.storageDeposit;
  const deposit = typeof value?.toJSON === "function" ? value.toJSON() : value;
  if (deposit && typeof deposit === "object") {
    const entry = Object.entries(deposit as Record<string, unknown>).find(([key]) => key.toLowerCase() === "charge");
    if (entry) {
      const amount = entry[1];
      if (amount === null || amount === undefined) {
        throw new Error("Native runtime returned an empty storage-deposit charge.");
      }
      try {
        const parsed = BigInt(String(amount));
        if (parsed < 0n) throw new Error("negative deposit");
        return parsed;
      } catch {
        throw new Error("Native runtime returned an invalid storage-deposit charge; transaction preparation is blocked.");
      }
    }
    if (Object.keys(deposit).some((key) => key.toLowerCase() === "refund")) return 0n;
  }
  throw new Error("Native runtime storage-deposit result is unrecognized; transaction preparation is blocked rather than assuming a zero deposit.");
}

function decodeDispatchError(api: ApiPromise, error: any): string {
  if (error?.isModule) {
    const decoded = api.registry.findMetaError(error.asModule);
    return `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
  }
  return error?.toString?.() || "Unknown runtime error";
}

async function simulateCommand(
  api: ApiPromise,
  from: string,
  contractAddress: string,
  action: NativeDemoAction,
  stockId: number,
  quantity: number
): Promise<DryRun> {
  const call = (api.call as any)?.contractsApi?.call;
  if (typeof call !== "function") {
    throw new Error("This RPC does not expose ContractsApi.call. Native contract execution is not verified on this runtime.");
  }

  const inputData = encodeNativeCommand(action, stockId, quantity);
  const response = await call(from, contractAddress, "0", weightForDryRun(api), null, inputData);
  if (response?.result?.isErr) {
    throw new Error(decodeDispatchError(api, response.result.asErr));
  }
  const encodedOutput = response?.result?.asOk?.data?.toHex?.();
  if (typeof encodedOutput !== "string") {
    throw new Error("The native contracts runtime returned no decodable contract output.");
  }
  return {
    result: decodeNativeCommand(encodedOutput),
    storageDeposit: depositCharge(response),
    gasLimit: weightForTransaction(api, response),
    inputData
  };
}

function formatWhole(value: bigint | number): string {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatNative(value: bigint | null): string {
  return value === null ? "—" : `${formatNativeTpot(value)} tPOT`;
}

function actionName(action: PendingAction["action"]): string {
  return action === 1 ? "Claim pUSD" : action === 2 ? "Buy demo shares" : "Sell demo shares";
}

type NativeWorkspaceView = "markets" | "portfolio" | "activity";

export function NativeDemoWorkspace({ view = "markets" }: { view?: NativeWorkspaceView }) {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [, setChainName] = useState("Connecting to Portaldot V3 Testnet…");
  const [genesisHash, setGenesisHash] = useState("");
  const [, setRpcError] = useState("");
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");

  const [stockId, setStockId] = useState<number>(0);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [faucetModalOpen, setFaucetModalOpen] = useState(false);
  const [faucetEligibilityChecked, setFaucetEligibilityChecked] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [shareQuantity, setShareQuantity] = useState("1");
  const [portfolio, setPortfolio] = useState<NativeCommandResult | null>(null);
  const [positions, setPositions] = useState<Array<{ symbol: string; name: string; shares: bigint; quote: bigint }>>([]);
  const [freeBalance, setFreeBalance] = useState<bigint | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [activity, setActivity] = useState<string[]>([]);
  const enabledBySource = useRef(new Map<string, EnabledExtension>());
  const confirmationRef = useRef<HTMLElement | null>(null);

  const stock = STOCKS.find((item) => item.id === stockId) ?? STOCKS[0];
  const networkVerified = Boolean(EXPECTED_GENESIS && genesisHash && EXPECTED_GENESIS === genesisHash.toLowerCase());
  const selectedAccount = accounts.find((account) => account.address === selectedAddress);
  const contractConfigured = CONTRACT_ADDRESS.length > 0;
  const canUseContract = Boolean(api && selectedAccount && contractConfigured);
  const canWrite = canUseContract && networkVerified && !busy;
  const pendingTotal = pending ? pending.estimatedFee + pending.storageDeposit : 0n;
  const estimatedRemaining = pending ? (pending.freeBalance > pendingTotal ? pending.freeBalance - pendingTotal : 0n) : null;
  const providerName = selectedAccount?.source.replace(/-js$/i, "") || "";

  useEffect(() => {
    let active = true;
    let connection: ApiPromise | null = null;
    const connectRpc = async () => {
      try {
        const provider = new WsProvider(RPC_URL);
        connection = await ApiPromise.create({ provider });
        await connection.isReady;
        if (!active) {
          await connection.disconnect();
          return;
        }
        const [name, genesis] = await Promise.all([
          connection.rpc.system.chain(),
          Promise.resolve(connection.genesisHash.toHex())
        ]);
        setChainName(name.toString());
        setGenesisHash(genesis);
        setApi(connection);
        setRpcError("");
      } catch (error) {
        if (active) {
          setRpcError(error instanceof Error ? error.message : "Could not connect to the native testnet RPC.");
          setChainName("Native RPC unavailable");
        }
      }
    };
    void connectRpc();
    return () => {
      active = false;
      if (connection) void connection.disconnect();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!api || !selectedAddress || !CONTRACT_ADDRESS) return;
    setBusy(true);
    try {
      const [queries, info] = await Promise.all([
        Promise.all(STOCKS.map((item) => simulateCommand(api, selectedAddress, CONTRACT_ADDRESS, 0, item.id, 0))),
        api.query.system.account(selectedAddress)
      ]);
      setPortfolio(queries[stockId]?.result ?? queries[0]?.result ?? null);
      setPositions(queries.map((query, index) => ({
        symbol: STOCKS[index].symbol,
        name: STOCKS[index].name,
        shares: BigInt(query.result.shares),
        quote: BigInt(query.result.quote)
      })));
      setFreeBalance(BigInt((info as any).data.free.toString()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the native portfolio.");
    } finally {
      setBusy(false);
    }
  }, [api, selectedAddress, stockId]);

  useEffect(() => {
    setPending(null);
    if (api && selectedAddress && CONTRACT_ADDRESS) void refresh();
  }, [api, selectedAddress, stockId, refresh]);

  const connectWallet = async () => {
    setBusy(true);
    setMessage("");
    try {
      const injectedEntries = Object.entries(window.injectedWeb3 ?? {}).sort(([a], [b]) => {
        const priority = (name: string) => name.toLowerCase().includes("subwallet") ? 0 : name.toLowerCase().includes("polkadot") ? 1 : 2;
        return priority(a) - priority(b);
      });
      if (!injectedEntries.length) {
        throw new Error("Install and unlock SubWallet or a compatible Polkadot.js browser extension, then reconnect.");
      }
      let connectedAccounts: WalletAccount[] = [];
      for (const [source, extension] of injectedEntries) {
        const injected = await extension.enable("PASTX Native Market Demo");
        enabledBySource.current.set(source, injected);
        const found = await injected.accounts.get();
        connectedAccounts = found.map((account) => ({
          address: account.address,
          label: account.meta?.name?.trim() || account.address,
          source
        }));
        if (connectedAccounts.length) break;
      }
      if (!connectedAccounts.length) {
        throw new Error("The connected extension did not provide an account. Approve account access in your wallet and try again.");
      }
      setAccounts(connectedAccounts);
      setPending(null);
      if (connectedAccounts.length === 1) {
        setSelectedAddress(connectedAccounts[0].address);
        setAccountPickerOpen(false);
        window.dispatchEvent(new Event("pastx:native-wallet-connected"));
        setMessage("Native wallet connected. Read-only portfolio checks use the selected account.");
      } else {
        setAccountPickerOpen(true);
        setMessage("Choose the account address you want PASTX to use.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handleWalletRequest = () => { void connectWallet(); };
    window.addEventListener("pastx:connect-native-wallet", handleWalletRequest);
    return () => window.removeEventListener("pastx:connect-native-wallet", handleWalletRequest);
  });

  const prepareAction = async (action: 1 | 2 | 3) => {
    if (!api || !selectedAccount || !contractConfigured) {
      setMessage("The native contract address is not configured yet. Do not submit a transaction without the current deployment address.");
      return;
    }
    if (!networkVerified) {
      setMessage("Writes are blocked until VITE_PASTX_NATIVE_EXPECTED_GENESIS_HASH is set to the independently verified Portaldot V3 testnet genesis hash.");
      return;
    }
    const enteredQuantity = action === 1 ? 0 : Number(shareQuantity);
    const quantity = action === 1 ? 0 : Math.round(enteredQuantity * 10);
    if (action !== 1 && (!Number.isFinite(enteredQuantity) || enteredQuantity <= 0 || Math.abs(enteredQuantity * 10 - quantity) > 1e-8 || quantity > 0xffff_ffff)) {
      setMessage("Enter a quantity of at least 0.1 share, in increments of 0.1.");
      return;
    }
    setBusy(true);
    setPending(null);
    setMessage("");
    try {
      const simulation = await simulateCommand(api, selectedAccount.address, CONTRACT_ADDRESS, action, stockId, quantity);
      if (!simulation.result.success) {
        const explanation = action === 1
          ? "The faucet simulation rejected this claim. The one-hour wallet cooldown or global 1,000-claim cap may have been reached."
          : "The trade simulation rejected this order. Check your pUSD balance, available shares, listing, and quantity.";
        setMessage(explanation);
        return;
      }
      const tx = (api.tx as any)?.contracts?.call?.(
        CONTRACT_ADDRESS,
        "0",
        simulation.gasLimit,
        simulation.storageDeposit.toString(),
        simulation.inputData
      );
      if (!tx) throw new Error("This runtime has no contracts.call extrinsic.");
      const [feeInfo, accountInfo] = await Promise.all([
        tx.paymentInfo(selectedAccount.address),
        api.query.system.account(selectedAccount.address)
      ]);
      const estimatedFee = BigInt(feeInfo.partialFee.toString());
      const available = BigInt((accountInfo as any).data.free.toString());
      const storageDepositLimit = available > estimatedFee ? available - estimatedFee : 0n;
      const next: PendingAction = {
        action,
        stockId,
        quantity,
        description: action === 1
          ? "Claim 1,000 whole-unit pUSD"
          : `${action === 2 ? "Buy" : "Sell"} ${(quantity / 10).toFixed(1)} ${stock.symbol} share(s) at ${stock.price} pUSD each`,
        result: simulation.result,
        storageDeposit: simulation.storageDeposit,
        storageDepositLimit,
        estimatedFee,
        freeBalance: available,
        gasLimit: simulation.gasLimit,
        inputData: simulation.inputData
      };
      setPending(next);
      if (available < estimatedFee + simulation.storageDeposit) {
        setMessage("Preflight calculated a storage deposit plus fee that exceeds the wallet's current free tPOT. No transaction has been sent.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The action preflight failed. No transaction was sent.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handleFaucetRequest = () => {
      setFaucetModalOpen(true);
      setFaucetEligibilityChecked(false);
      setPending(null);
      setMessage("");
    };
    window.addEventListener("pastx:claim-native-faucet", handleFaucetRequest);
    return () => window.removeEventListener("pastx:claim-native-faucet", handleFaucetRequest);
  });

  useEffect(() => {
    if (!pending) return;
    const frame = window.requestAnimationFrame(() => {
      confirmationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pending]);

  const confirmAction = async () => {
    if (!api || !selectedAccount || !pending) return;
    const injector = enabledBySource.current.get(selectedAccount.source);
    if (!injector?.signer) {
      setMessage("The selected wallet signer is unavailable. Reconnect the extension; no transaction was sent.");
      return;
    }
    if (!networkVerified) {
      setMessage("The network identity is not pinned and verified. No transaction was sent.");
      return;
    }
    if (pending.freeBalance < pending.estimatedFee + pending.storageDeposit) {
      setMessage("Insufficient free tPOT for the simulated storage deposit and estimated fee. No transaction was sent.");
      return;
    }
    setBusy(true);
    setMessage("Waiting for wallet signature and finalized inclusion…");
    try {
      const tx = (api.tx as any).contracts.call(
        CONTRACT_ADDRESS,
        "0",
        pending.gasLimit,
        pending.storageDepositLimit.toString(),
        pending.inputData
      );
      const txHash = await new Promise<string>((resolve, reject) => {
        let unsubscribe: (() => void) | undefined;
        let terminal = false;
        const finish = (error?: Error, hash?: string) => {
          if (terminal) return;
          terminal = true;
          if (unsubscribe) unsubscribe();
          if (error) reject(error);
          else resolve(hash || "");
        };
        tx.signAndSend(
          selectedAccount.address,
          { signer: injector.signer } as any,
          (result: any) => {
            if (result.dispatchError) {
              finish(new Error(decodeDispatchError(api, result.dispatchError)));
              return;
            }
            if (result.status?.isInvalid || result.status?.isDropped || result.status?.isUsurped) {
              finish(new Error(`Transaction was not accepted: ${result.status.toString()}`));
              return;
            }
            if (result.status?.isFinalized) {
              // contracts.call can finalize as an extrinsic even when the contract
              // itself reverted. Do not report success unless ContractExecution
              // confirms the contract call result was Ok.
              const executionEvent = result.events?.find(({ event }: any) =>
                event.section === "contracts" && event.method === "ContractExecution"
              );
              const executionResult = executionEvent?.event?.data?.[1] as any;
              if (executionResult?.isErr) {
                finish(new Error(`Contract execution failed: ${decodeDispatchError(api, executionResult.asErr)}`));
                return;
              }
              if (!executionEvent) {
                finish(new Error("Transaction finalized without a contracts.ContractExecution event; outcome is unverified."));
                return;
              }
              finish(undefined, result.txHash.toHex());
            }
          }
        ).then((unsub: () => void) => {
          unsubscribe = unsub;
          if (terminal) unsubscribe();
        }).catch((error: unknown) => finish(error instanceof Error ? error : new Error(String(error))));
      });
      setActivity((current) => [`${actionName(pending.action)} · ${txHash}`, ...current].slice(0, 10));
      setPending(null);
      setMessage(`Finalized ${actionName(pending.action)}. Transaction: ${txHash}`);
      if (pending.action === 1) {
        setFaucetModalOpen(false);
        setFaucetEligibilityChecked(true);
        window.dispatchEvent(new Event("pastx:native-faucet-claimed"));
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transaction failed. Check the native explorer and wallet activity.");
    } finally {
      setBusy(false);
    }
  };

  const selectedQuote = portfolio?.quote || stock.price;
  const estimatedCost = useMemo(() => BigInt(Math.max(0, Number(shareQuantity) || 0)) * BigInt(selectedQuote), [shareQuantity, selectedQuote]);

  return (
    <div className="native-demo-shell">
<main className="native-demo-main">
        <section className="native-demo-intro">
          {!contractConfigured && <div className="native-warning">Contract address is not set. After deployment, add <code>VITE_PASTX_NATIVE_CONTRACT_ADDRESS</code> to the app environment; this page will not guess an address.</div>}
          {contractConfigured && !networkVerified && <div className="native-warning">Writes are disabled until <code>VITE_PASTX_NATIVE_EXPECTED_GENESIS_HASH</code> contains the independently verified testnet genesis hash. A chain label alone is not sufficient.</div>}
        </section>

        <div className="native-demo-grid">
          {view === "markets" && <section className="native-card native-market-card">
            <div className="native-section-head">
              <div><span className="native-eyebrow">DEMO LISTINGS</span><h2>Choose a market</h2></div>
              <button className="native-icon-button" type="button" disabled={!canUseContract || busy} onClick={() => void refresh()} aria-label="Refresh native portfolio"><RefreshCw size={14}/></button>
            </div>
            <div className="native-stock-list">
              {STOCKS.map((item) => (
                <button className={item.id === stockId ? "native-stock-row is-selected" : "native-stock-row"} key={item.id} type="button" onClick={() => { setStockId(item.id); setPending(null); if (!selectedAccount) { setMessage("Connect your wallet before opening a trade."); window.dispatchEvent(new Event("pastx:connect-native-wallet")); return; } setMessage(""); setTradeModalOpen(true); }}>
                  <span className="native-stock-icon">{item.symbol.slice(1, 2)}</span>
                  <span className="native-stock-identity"><strong>{item.symbol}</strong><small>{item.name}</small></span>
                  <span className="native-stock-price"><strong>{item.price} pUSD</strong><small>Fixed demo quote</small></span>
                  <span className="native-stock-select">{item.id === stockId ? "Selected" : "Select"}</span>
                </button>
              ))}
            </div>
            <div className="native-market-disclaimer"><ShieldCheck size={14}/> Fixed demonstration prices, not live market data or oracle-verified prices.</div>
          </section>}

          {view === "markets" && tradeModalOpen && <div className="native-trade-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setTradeModalOpen(false); setPending(null); } }}>
            <section className="native-trade-modal" role="dialog" aria-modal="true" aria-labelledby="native-trade-modal-title">
              <div className="native-trade-modal-head">
                <div><span className="native-eyebrow">DEMO ORDER TICKET</span><h2 id="native-trade-modal-title">{stock.symbol} · {stock.name}</h2><p>Fixed demo quote · no live equity market data</p></div>
                <button type="button" className="native-icon-button" aria-label="Close trading modal" onClick={() => { setTradeModalOpen(false); setPending(null); }}><X size={16}/></button>
              </div>
              <div className="native-modal-price"><span>Demo price</span><strong>{selectedQuote} pUSD</strong><small>Illustrative chart only</small></div>
              <div className="native-demo-chart" aria-label="Illustrative demo price graph">
                <div className="native-chart-top"><span>PRICE MOVEMENT</span><span>ILLUSTRATIVE · NOT LIVE</span></div>
                <svg viewBox="0 0 640 180" role="img" aria-label="Illustrative price movement line">
                  <defs><linearGradient id="pastx-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#42b9a0" stopOpacity=".25"/><stop offset="100%" stopColor="#42b9a0" stopOpacity="0"/></linearGradient></defs>
                  <path d="M0 145 H640 M0 105 H640 M0 65 H640 M0 25 H640" stroke="currentColor" strokeOpacity=".09" fill="none"/>
                  <path d="M0 128 L45 117 L85 125 L130 86 L175 98 L220 66 L265 82 L310 51 L355 74 L400 43 L445 56 L490 29 L535 49 L580 20 L640 34 L640 180 L0 180 Z" fill="url(#pastx-chart-fill)"/>
                  <path d="M0 128 L45 117 L85 125 L130 86 L175 98 L220 66 L265 82 L310 51 L355 74 L400 43 L445 56 L490 29 L535 49 L580 20 L640 34" fill="none" stroke="#168b78" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="native-chart-labels"><span>Past</span><span>Illustrative trend</span><span>Now</span></div>
              </div>
              <div className="native-trade-price"><span>Price per share</span><strong>{selectedQuote} pUSD</strong></div>
              <label className="native-field"><span>Shares (minimum 0.1)</span><input value={shareQuantity} onChange={(event) => { const value = event.target.value; if (/^\d*(?:\.\d?)?$/.test(value)) setShareQuantity(value); setPending(null); }} inputMode="decimal" aria-label="Share quantity" /></label>
              <div className="native-estimated-cost"><span>Estimated order value</span><strong>{formatWhole(estimatedCost)} pUSD</strong></div>
              <div className="native-trade-actions">
                <button className="native-button native-button-green" type="button" disabled={!canWrite || busy} onClick={() => void prepareAction(2)}>Buy shares</button>
                <button className="native-button native-button-outline" type="button" disabled={!canWrite || busy} onClick={() => void prepareAction(3)}>Sell shares</button>
              </div>
              <p className="native-helper">Buys debit pUSD and create demo shares. Sells require shares and return the same fixed price. No order book, live pricing, or real equity.</p>
              {view === "markets" && pending && <section ref={confirmationRef} className="native-card native-confirm-card">
                <span className="native-eyebrow">DRY-RUN PASSED · REVIEW BEFORE SIGNING</span>
                <h2>{pending.description}</h2>
                <div className="native-confirm-details">
                  <div><span>Expected pUSD balance</span><strong>{formatWhole(pending.result.balance)} pUSD</strong></div>
                  <div><span>Expected {stock.symbol} shares</span><strong>{(pending.result.shares / 10).toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></div>
                  <div><span>Simulated storage deposit charge</span><strong>{formatNative(pending.storageDeposit)}</strong></div>
                  <div><span>Maximum storage-deposit limit</span><strong>{formatNative(pending.storageDepositLimit)}</strong></div>
                  <div><span>Estimated extrinsic fee</span><strong>{formatNative(pending.estimatedFee)}</strong></div>
                  <div><span>Wallet free balance after estimate</span><strong>{estimatedRemaining === null ? "—" : formatNative(estimatedRemaining)}</strong></div>
                </div>
                <p className="native-confirm-note">The transaction allows storage deposit up to the selected wallet’s free balance after the estimated extrinsic fee. The runtime may still reject the call if its required deposit exceeds this limit. Review the limit before signing.</p>
                <div className="native-trade-actions">
                  <button className="native-button native-button-green" type="button" disabled={!canWrite || pending.freeBalance < pendingTotal} onClick={() => void confirmAction()}>Confirm in wallet</button>
                  <button className="native-button native-button-outline" type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
                </div>
              </section>}
            </section>
          </div>}

          {accountPickerOpen && <div className="native-trade-overlay" role="presentation">
            <section className="native-account-picker" role="dialog" aria-modal="true" aria-labelledby="native-account-picker-title">
              <div className="native-trade-modal-head"><div><span className="native-eyebrow">WALLET ACCOUNTS</span><h2 id="native-account-picker-title">Choose an address</h2><p>Select which wallet address PASTX should use.</p></div><button type="button" className="native-icon-button" aria-label="Close account selector" onClick={() => setAccountPickerOpen(false)}><X size={16}/></button></div>
              <div className="native-account-options">{accounts.map((account) => <button key={account.address} type="button" className="native-account-option" onClick={() => { setSelectedAddress(account.address); setAccountPickerOpen(false); setPending(null); window.dispatchEvent(new Event("pastx:native-wallet-connected")); setMessage("Wallet connected using the selected address."); }}><span><strong>{account.label}</strong><small>{account.source.replace(/-js$/i, "")}</small><code>{account.address}</code></span><ArrowLeftRight size={16}/></button>)}</div>
            </section>
          </div>}

          {view === "portfolio" && <section className="native-card native-activity-card">
            <span className="native-eyebrow">CONNECTED ACCOUNT</span><h2>Your positions</h2>
            {positions.filter((position) => position.shares > 0n).length
              ? positions.filter((position) => position.shares > 0n).map((position) => (
                <div className="native-activity-row" key={position.symbol}>
                  <CheckCircle2 size={15}/>
                  <span><strong>{position.symbol}</strong> · {formatWhole(position.shares)} demo share(s) · {formatWhole(position.quote)} pUSD fixed quote</span>
                </div>
              ))
              : <p className="native-helper">{selectedAddress ? "No demo share positions were returned by the configured contract for this account." : "Connect a native wallet and configure the verified market contract to read positions."}</p>}
          </section>}

          {view === "portfolio" && <section className="native-card native-account-card">
            <span className="native-eyebrow">YOUR NATIVE ACCOUNT</span>
            <h2>Account</h2>
            {accounts.length > 1 && <label className="native-field"><span>Choose address</span><select value={selectedAddress} onChange={(event) => { setSelectedAddress(event.target.value); setPending(null); }} disabled={busy}>{accounts.map((account) => <option key={account.address} value={account.address}>{account.address}</option>)}</select></label>}
            <div className="native-wallet-address">
              <span>WALLET ADDRESS</span>
              <code title={selectedAddress}>{selectedAddress || "Connect a wallet to view your address"}</code>
              {selectedAddress && <button type="button" className="native-copy-address" aria-label="Copy wallet address" title="Copy address" onClick={() => { void navigator.clipboard.writeText(selectedAddress).then(() => setMessage("Wallet address copied.")).catch(() => setMessage("Could not copy address; copy it manually.")); }}><Copy size={14}/><span>Copy</span></button>}
            </div>
            <div className="native-balance-grid">
              <div className="native-balance-card"><span>pUSD BALANCE</span><strong>{portfolio ? formatWhole(portfolio.balance) : "â€”"}</strong><small>Demo settlement token</small></div>
              <div className="native-balance-card"><span>{stock.symbol} SHARES</span><strong>{portfolio ? formatWhole(portfolio.shares) : "â€”"}</strong><small>Selected market position</small></div>
              <div className="native-balance-card"><span>AVAILABLE tPOT</span><strong>{formatNative(freeBalance)}</strong><small>Native testnet gas</small></div>
            </div>
          </section>}

          {view === "markets" && tradeModalOpen && pending && <section ref={confirmationRef} className="native-card native-confirm-card">
            <span className="native-eyebrow">DRY-RUN PASSED · REVIEW BEFORE SIGNING</span>
            <h2>{pending.description}</h2>
            <div className="native-confirm-details">
              <div><span>Expected pUSD balance</span><strong>{formatWhole(pending.result.balance)} pUSD</strong></div>
              <div><span>Expected {stock.symbol} shares</span><strong>{(pending.result.shares / 10).toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></div>
              <div><span>Simulated storage deposit charge</span><strong>{formatNative(pending.storageDeposit)}</strong></div>
              <div><span>Maximum storage-deposit limit</span><strong>{formatNative(pending.storageDepositLimit)}</strong></div>
              <div><span>Estimated extrinsic fee</span><strong>{formatNative(pending.estimatedFee)}</strong></div>
              <div><span>Wallet free balance after estimate</span><strong>{estimatedRemaining === null ? "—" : formatNative(estimatedRemaining)}</strong></div>
            </div>
            <p className="native-confirm-note">The transaction allows storage deposit up to the selected wallet’s free balance after the estimated extrinsic fee. The runtime may still reject the call if its required deposit exceeds this limit. A storage deposit can be reserved separately from the transaction fee; review the limit before signing.</p>
            <div className="native-trade-actions">
              <button className="native-button native-button-green" type="button" disabled={!canWrite || pending.freeBalance < pendingTotal} onClick={() => void confirmAction()}>Confirm in wallet</button>
              <button className="native-button native-button-outline" type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
            </div>
          </section>}

          {view === "activity" && <section className="native-card native-activity-card">
            <span className="native-eyebrow">ON-CHAIN CONFIRMATIONS</span><h2>Finalized transactions</h2>
            {activity.length ? activity.map((entry) => <div className="native-activity-row" key={entry}><CheckCircle2 size={15}/><span>{entry}</span></div>) : <p className="native-helper">No finalized market transactions recorded in this session for the selected account.</p>}
            <p className="native-helper">This list contains transactions finalized by this app session; it is not a complete explorer index of all wallet activity.</p>
          </section>}
        </div>
        {faucetModalOpen && <div className="native-faucet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setFaucetModalOpen(false); }}>
          <section className="native-faucet-modal" role="dialog" aria-modal="true" aria-labelledby="native-faucet-title">
            <div className="native-faucet-head"><div><span className="native-eyebrow">PORTALDOT V3 TESTNET</span><h2 id="native-faucet-title">Claim test pUSD</h2></div><button className="native-icon-button" type="button" aria-label="Close faucet" disabled={busy} onClick={() => setFaucetModalOpen(false)}><X size={16}/></button></div>
            <div className="native-faucet-amount"><span>Faucet allocation</span><strong>1,000 pUSD</strong><small>Demo-only market credits. Not transferable and not redeemable.</small></div>
            {!selectedAccount && <p className="native-faucet-status" role="status">Connect a compatible Polkadot wallet first. Then reopen Faucet to check eligibility.</p>}
            {selectedAccount && !faucetEligibilityChecked && !pending && <p className="native-faucet-status">Check on-chain eligibility before claiming. The contract enforces the one-hour wallet cooldown and remaining global claim cap.</p>}
            {pending?.action === 1 && <div className="native-faucet-preflight"><div><span>Estimated transaction fee</span><strong>{formatNative(pending.estimatedFee)}</strong></div><div><span>Estimated storage deposit</span><strong>{formatNative(pending.storageDeposit)}</strong></div><div><span>Available free tPOT</span><strong>{formatNative(pending.freeBalance)}</strong></div><p>These are preflight estimates. The wallet will ask you to sign only after you choose Claim. The chain can still reject a call if its actual storage requirement exceeds the allowed limit.</p><button className="native-button native-button-green native-full-button" type="button" disabled={!canWrite || pending.freeBalance < pending.estimatedFee + pending.storageDeposit || busy} onClick={() => void confirmAction()}>Claim 1,000 pUSD in wallet</button></div>}
            <div className="native-faucet-actions">{!selectedAccount && <button className="native-button native-button-green" type="button" disabled={busy} onClick={() => window.dispatchEvent(new Event("pastx:connect-native-wallet"))}>Connect wallet</button>}{selectedAccount && !pending && <button className="native-button native-button-green" type="button" disabled={!canWrite || busy} onClick={() => { setFaucetEligibilityChecked(true); void prepareAction(1); }}>{busy ? "Checking eligibility…" : "Check eligibility"}</button>}<button className="native-button native-button-outline" type="button" disabled={busy} onClick={() => setFaucetModalOpen(false)}>Close</button></div>
            {!networkVerified && <p className="native-faucet-footnote">Writes remain disabled until the configured genesis hash matches the connected testnet.</p>}
          </section>
        </div>}
        {message && <div className="native-message" role="status"><span>{message}</span><button type="button" onClick={() => setMessage("")}>Dismiss</button></div>}
        <footer className="native-demo-footer">
          <span>Native ink! demo · no real money or equity</span>
          <span>{providerName ? `Signer: ${providerName}` : "No wallet selected"}</span>
          <span>RPC: {RPC_URL}</span>
          <a href="https://github.com/Investorquab/PASTX/tree/ui/firstbell-inspired-market-terminal/contracts/cross-chain/native-ink" target="_blank" rel="noreferrer">Contract source <ExternalLink size={11}/></a>
        </footer>
      </main>
    </div>
  );
}
