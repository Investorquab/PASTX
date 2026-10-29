import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatEther, parseEther, parseUnits, formatUnits, parseEventLogs } from "viem";
import { PastxMark } from "./pastx/Logo";
import { usePastxWallet, type PastxWallet } from "./pastx/usePastxWallet";
import { discoverEvmWallets, type Eip6963Wallet } from "./pastx/evmWallets";
import { listSubstrateWallets, topUpEvm, transferNative, substrateFreeBalance, type SubstrateWalletInfo } from "./pastx/substrateWallet";
import { publicByKey, walletClientFor, ensureChain, chainByKey } from "./pastx/clients";
import { nativeMarketAbi, wrappedMarketAbi, erc20Abi, escrowAbi, gatewayAbi } from "./pastx/abis";
import { ADDRESSES, PORTAL_LISTINGS, BNB_LISTINGS, ALL_LISTINGS, symbolKey, PORTALDOT, LINKS, explorerTxUrl, explorerExtrinsicUrl, type StockListing } from "./pastx/config";
import "./pastx/pastx-dashboard.css";

const short = (a?: string, n = 4) => (a ? a.slice(0, n + 2) + "…" + a.slice(-n) : "-");
const fmt = (v?: bigint, d = 4) => { if (v === undefined) return "-"; const [i, f = ""] = formatEther(v).split("."); return f ? `${i}.${f.slice(0, d)}` : i; };

// A confirmed transaction: its hash plus the explorer link to view it on-chain.
type TxInfo = { hash: string; href: string; label?: string };
const evmTx = (chain: "portaldot" | "bnb", hash: string, label?: string): TxInfo =>
  ({ hash, href: explorerTxUrl(chain, hash), label });
const subTx = (txHash: string, label?: string): TxInfo =>
  ({ hash: txHash, href: explorerExtrinsicUrl(txHash), label });

// Shows the tx hash with a copy button and a clickable explorer link.
function TxReceipt({ tx }: { tx: TxInfo }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(tx.hash).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => {});
  };
  return (
    <div className="px-txr">
      <span className="ulabel">{tx.label ?? "transaction"}</span>
      <code className="px-txr-hash num" title={tx.hash}>{short(tx.hash, 8)}</code>
      <button className="px-txr-btn" onClick={copy} title="copy full hash">{copied ? "copied ✓" : "copy"}</button>
      <a className="px-txr-btn link" href={tx.href} target="_blank" rel="noreferrer" title={tx.href}>view ↗</a>
    </div>
  );
}

type Balances = { tpot: bigint; tbnb: bigint; wtpot: bigint; positions: Record<string, bigint> };

async function fetchBalances(addr: `0x${string}`): Promise<Balances> {
  const [tpot, tbnb, wtpot] = await Promise.all([
    publicByKey.portaldot.getBalance({ address: addr }),
    publicByKey.bnb.getBalance({ address: addr }),
    publicByKey.bnb.readContract({ address: ADDRESSES.bnb.wrappedPot as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [addr] }) as Promise<bigint>,
  ]);
  const positions: Record<string, bigint> = {};
  await Promise.all(ALL_LISTINGS.map(async (l) => {
    const market = (l.chain === "portaldot" ? ADDRESSES.portaldot.market : ADDRESSES.bnb.market) as `0x${string}`;
    const abi = l.chain === "portaldot" ? nativeMarketAbi : wrappedMarketAbi;
    positions[l.symbol] = (await publicByKey[l.chain].readContract({ address: market, abi, functionName: "positions", args: [addr, symbolKey(l.symbol)] })) as bigint;
  }));
  return { tpot, tbnb, wtpot, positions };
}

async function writeTx(listing: StockListing, provider: any, address: `0x${string}`, target: `0x${string}`, abi: any, fn: string, args: any[], value?: bigint): Promise<`0x${string}`> {
  const chain = chainByKey[listing.chain];
  const wallet = walletClientFor(chain, provider);
  const pub = publicByKey[listing.chain];
  if (listing.chain === "portaldot") {
    const gas = await pub.estimateContractGas({ address: target, abi, functionName: fn, args, account: address, value } as any);
    const gasPrice = await pub.getGasPrice();
    return wallet.writeContract({ account: address, chain, address: target, abi, functionName: fn, args, value, gas: (gas * 150n) / 100n, gasPrice } as any);
  }
  return wallet.writeContract({ account: address, chain, address: target, abi, functionName: fn, args, value } as any);
}

export default function PastxDashboard() {
  const w = usePastxWallet();
  const [tab, setTab] = useState<"portfolio" | "trade" | "bridge" | "transfer">("portfolio");
  const [balances, setBalances] = useState<Balances | null>(null);
  const [block, setBlock] = useState<number | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [topup, setTopup] = useState(false);

  const refresh = useCallback(async () => {
    if (!w.evm) return setBalances(null);
    try { setBalances(await fetchBalances(w.evm.address)); } catch { /* transient */ }
  }, [w.evm]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    let on = true;
    const tick = () => publicByKey.portaldot.getBlockNumber().then((b) => on && setBlock(Number(b))).catch(() => {});
    tick(); const id = setInterval(tick, 3000);
    return () => { on = false; clearInterval(id); };
  }, []);

  return (
    <div className="px">
      <StatusBar block={block} w={w} onConnect={() => setConnectOpen(true)} onMenu={() => setMenuOpen(true)} />
      <nav className="px-nav">
        {(["portfolio", "trade", "bridge", "transfer"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {w.error && <div className="px-err">{w.error} <button onClick={w.clearError}>✕</button></div>}

      <main className="px-main">
        {!w.evm ? <Welcome onConnect={() => setConnectOpen(true)} />
          : tab === "portfolio" ? <Portfolio w={w} balances={balances} onRefresh={refresh} onTopup={() => (w.substrateSource ? setTopup(true) : setConnectOpen(true))} />
          : tab === "trade" ? <Trade w={w} balances={balances} onDone={refresh} />
          : tab === "bridge" ? <Bridge w={w} onDone={refresh} />
          : <Transfer w={w} balances={balances} onDone={refresh} />}
      </main>

      <footer className="px-foot">
        <span className="ulabel">synthetic test assets, not real equities</span>
        <span className="ulabel">bridge = trusted testnet relayer, not trustless</span>
      </footer>

      {connectOpen && <ConnectModal w={w} onClose={() => setConnectOpen(false)} />}
      {menuOpen && <WalletMenu w={w} onClose={() => setMenuOpen(false)} onConnect={() => { setMenuOpen(false); setConnectOpen(true); }} />}
      {topup && w.evm && <TopupModal w={w} onClose={() => setTopup(false)} onDone={refresh} />}
    </div>
  );
}

function StatusBar({ block, w, onConnect, onMenu }: { block: number | null; w: PastxWallet; onConnect: () => void; onMenu: () => void }) {
  return (
    <header className="px-status">
      <a className="px-brand" href="/"><PastxMark size={28} />PASTX</a>
      <span className="px-sep" />
      <span className="ulabel">Portaldot · chain {PORTALDOT.evmChainId}</span>
      <span className="px-block num"><span className="live-dot" /> block {block ?? "-"}</span>
      <div className="px-status-right">
        {w.evm
          ? <button className="px-acct" onClick={onMenu}><span className="live-dot" /> <span className="num">{short(w.evm.address)}</span> <span className="ulabel">{w.evm.walletName}</span></button>
          : <button className="btn btn-primary" onClick={onConnect}>Connect</button>}
      </div>
    </header>
  );
}

function Welcome({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="px-welcome">
      <span className="ulabel">portaldot · bnb testnet</span>
      <h1>Stock trading,<br />settled on Portaldot.</h1>
      <p>Connect a wallet to trade synthetic equities on Portaldot and BNB, fund your EVM account from your <span className="num">5…</span> faucet balance, and bridge tPOT across chains.</p>
      <div className="px-welcome-cta">
        <button className="btn btn-primary" onClick={onConnect}>Connect wallet</button>
        <a className="btn btn-ghost" href={LINKS.portaldotFaucet} target="_blank" rel="noreferrer">Get tPOT</a>
      </div>
    </div>
  );
}

function Portfolio({ w, balances, onRefresh, onTopup }: { w: PastxWallet; balances: Balances | null; onRefresh: () => void; onTopup: () => void }) {
  return (
    <div className="px-cols">
      <section className="p5 panel span2">
        <div className="panel-h"><span className="ulabel">accounts</span><button className="btn btn-ghost sm" onClick={onRefresh}>refresh</button></div>
        <Row k="EVM · trading" v={<span className="num">{w.evm?.address}</span>} sub={w.evm?.walletName} />
        <Row k="Backing 5… · mapped" v={<span className="num">{w.derivedSubstrate}</span>} />
        <Row k="Substrate · funding" v={w.selectedSubstrate ? <span className="num">{w.selectedSubstrate}</span> : <span className="dim">not connected</span>} sub={w.substrateSource ?? undefined} />
      </section>

      <section className="panel bal">
        <div className="panel-h"><span className="ulabel">tPOT · portaldot</span><span className="tag pdot">PDOT</span></div>
        <div className="big num">{fmt(balances?.tpot)}</div>
        <button className="btn btn-primary sm wfull" onClick={onTopup}>↑ Top up EVM</button>
      </section>
      <section className="panel bal">
        <div className="panel-h"><span className="ulabel">wtPOT · bnb</span><span className="tag bnb">BNB</span></div>
        <div className="big num">{fmt(balances?.wtpot)}</div>
        <span className="dim sm">bridge tPOT to get wtPOT</span>
      </section>
      <section className="panel bal">
        <div className="panel-h"><span className="ulabel">tBNB · gas</span><span className="tag bnb">BNB</span></div>
        <div className="big num">{fmt(balances?.tbnb)}</div>
      </section>

      <section className="panel span3">
        <div className="panel-h"><span className="ulabel">holdings</span></div>
        <table className="grid">
          <thead><tr><th>ticker</th><th>name</th><th>chain</th><th className="r">price</th><th className="r">shares</th><th className="r">value</th></tr></thead>
          <tbody>
            {ALL_LISTINGS.map((l) => {
              const sh = balances?.positions[l.symbol];
              const val = sh !== undefined ? (sh * l.priceWei) / 10n ** 18n : undefined;
              return (
                <tr key={l.symbol}>
                  <td className="num b">{l.symbol}</td>
                  <td>{l.display}</td>
                  <td><span className={`tag ${l.chain === "portaldot" ? "pdot" : "bnb"}`}>{l.chain === "portaldot" ? "PDOT" : "BNB"}</span></td>
                  <td className="r num">{fmt(l.priceWei)}</td>
                  <td className="r num">{fmt(sh)}</td>
                  <td className="r num">{fmt(val)} {l.payToken}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({ k, v, sub }: { k: string; v: ReactNode; sub?: string }) {
  return <div className="px-row"><span className="ulabel">{k}</span><span className="px-row-v">{v}{sub && <span className="dim sm"> · {sub}</span>}</span></div>;
}

function Trade({ w, balances, onDone }: { w: PastxWallet; balances: Balances | null; onDone: () => void }) {
  const [sel, setSel] = useState<StockListing>(ALL_LISTINGS[0]);
  const [shares, setShares] = useState("1");
  const [status, setStatus] = useState<string | null>(null);
  const [txs, setTxs] = useState<TxInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const cost = useMemo(() => { try { return (sel.priceWei * parseEther(shares)) / 10n ** 18n; } catch { return 0n; } }, [sel, shares]);
  const payBal = sel.chain === "portaldot" ? balances?.tpot : balances?.wtpot;
  const addTx = (t: TxInfo) => setTxs((prev) => [...prev, t]);

  const act = async (side: "buy" | "sell") => {
    if (!w.evm) return;
    setBusy(true); setTxs([]); setStatus(`› preparing ${side}…`);
    try {
      const sw = parseEther(shares);
      const market = (sel.chain === "portaldot" ? ADDRESSES.portaldot.market : ADDRESSES.bnb.market) as `0x${string}`;
      const mAbi = sel.chain === "portaldot" ? nativeMarketAbi : wrappedMarketAbi;
      await ensureChain(chainByKey[sel.chain], w.evm.provider);
      if (side === "buy") {
        if (sel.chain === "bnb") {
          setStatus("› approve wtPOT…");
          const ah = await writeTx(sel, w.evm.provider, w.evm.address, ADDRESSES.bnb.wrappedPot as `0x${string}`, erc20Abi, "approve", [market, cost]);
          await publicByKey.bnb.waitForTransactionReceipt({ hash: ah });
          addTx(evmTx(sel.chain, ah, `approve ${fmt(cost)} wtPOT`));
        }
        setStatus(`› buy ${shares} ${sel.symbol}…`);
        const h = await writeTx(sel, w.evm.provider, w.evm.address, market, mAbi, "buy", [symbolKey(sel.symbol), sw], sel.chain === "portaldot" ? cost : undefined);
        await publicByKey[sel.chain].waitForTransactionReceipt({ hash: h });
        addTx(evmTx(sel.chain, h, `buy ${shares} ${sel.symbol}`));
      } else {
        setStatus("› approve shares…");
        const ah = await writeTx(sel, w.evm.provider, w.evm.address, sel.token, erc20Abi, "approve", [market, sw]);
        await publicByKey[sel.chain].waitForTransactionReceipt({ hash: ah });
        addTx(evmTx(sel.chain, ah, `approve ${shares} ${sel.symbol}`));
        setStatus(`› sell ${shares} ${sel.symbol}…`);
        const h = await writeTx(sel, w.evm.provider, w.evm.address, market, mAbi, "sell", [symbolKey(sel.symbol), sw]);
        await publicByKey[sel.chain].waitForTransactionReceipt({ hash: h });
        addTx(evmTx(sel.chain, h, `sell ${shares} ${sel.symbol}`));
      }
      setStatus(`✓ ${side} ${shares} ${sel.symbol} on ${sel.chain === "portaldot" ? "Portaldot" : "BNB"}`);
      onDone();
    } catch (e: any) { setStatus("✕ " + (e?.shortMessage || e?.message || "failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="px-trade">
      <div>
        <MarketTable title="portaldot · pay tPOT" chain="pdot" listings={PORTAL_LISTINGS} sel={sel} onSel={setSel} pos={balances?.positions} />
        <MarketTable title="bnb · pay wtPOT" chain="bnb" listings={BNB_LISTINGS} sel={sel} onSel={setSel} pos={balances?.positions} />
      </div>
      <aside className="panel ticket">
        <div className="panel-h"><span className="ulabel">order</span><span className={`tag ${sel.chain === "portaldot" ? "pdot" : "bnb"}`}>{sel.chain === "portaldot" ? "PDOT" : "BNB"}</span></div>
        <div className="ticket-sym num">{sel.symbol}</div>
        <div className="dim">{sel.display} · {fmt(sel.priceWei)} {sel.payToken}/sh</div>
        <label className="ulabel">shares<input className="field amt num" value={shares} inputMode="decimal" onChange={(e) => setShares(e.target.value)} /></label>
        <div className="ticket-cost"><span className="ulabel">cost</span><span className="num">{fmt(cost)} {sel.payToken}</span></div>
        <div className="ticket-cost"><span className="ulabel">you hold</span><span className="num">{fmt(payBal)} {sel.payToken}</span></div>
        <div className="ticket-btns">
          <button className="btn buy" disabled={busy} onClick={() => act("buy")}>BUY</button>
          <button className="btn sell" disabled={busy} onClick={() => act("sell")}>SELL</button>
        </div>
        {status && <div className="ticket-status num">{status}</div>}
        {txs.map((t, i) => <TxReceipt key={t.hash + i} tx={t} />)}
      </aside>
    </div>
  );
}

function MarketTable({ title, chain, listings, sel, onSel, pos }: { title: string; chain: "pdot" | "bnb"; listings: StockListing[]; sel: StockListing; onSel: (l: StockListing) => void; pos?: Record<string, bigint> }) {
  return (
    <section className="panel market">
      <div className="panel-h"><span className="ulabel">{title}</span><span className={`tag ${chain}`}>{chain === "pdot" ? "PDOT" : "BNB"}</span></div>
      <table className="grid">
        <thead><tr><th>ticker</th><th>name</th><th className="r">price</th><th className="r">held</th><th></th></tr></thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.symbol} className={sel.symbol === l.symbol ? "sel" : ""} onClick={() => onSel(l)}>
              <td className="num b">{l.symbol}</td><td>{l.display}</td>
              <td className="r num">{fmt(l.priceWei)}</td>
              <td className="r num">{fmt(pos?.[l.symbol])}</td>
              <td className="r"><span className="pick">trade ›</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---- connect / wallet modals ---- */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="px-modal-bg" onClick={onClose}><div className="px-modal" onClick={(e) => e.stopPropagation()}>
    <div className="panel-h"><span className="ulabel">{title}</span><button className="px-x" onClick={onClose}>✕</button></div>{children}</div></div>;
}

function ConnectModal({ w, onClose }: { w: PastxWallet; onClose: () => void }) {
  const [step, setStep] = useState<"cat" | "evm" | "sub">("cat");
  const [evmWallets, setEvmWallets] = useState<Eip6963Wallet[] | null>(null);
  const [subWallets, setSubWallets] = useState<SubstrateWalletInfo[]>([]);

  const goEvm = async () => { setStep("evm"); setEvmWallets(await discoverEvmWallets()); };
  const goSub = () => { setSubWallets(listSubstrateWallets()); setStep("sub"); };

  return (
    <Modal title="connect wallet" onClose={onClose}>
      {step === "cat" && <div className="px-opts">
        <button className="px-opt" onClick={goEvm}><b>EVM wallet</b><span>MetaMask · Rabby · OKX. Signs trades on both chains</span></button>
        <button className="px-opt" onClick={goSub}><b>Substrate wallet</b><span>Polkadot.js · Talisman · SubWallet. Funds your EVM &amp; signs native transfers</span></button>
      </div>}
      {step === "evm" && <div className="px-opts">
        {evmWallets === null && <div className="dim">scanning…</div>}
        {evmWallets?.length === 0 && <div className="dim">No EVM wallet detected. Install MetaMask, Rabby or OKX.</div>}
        {evmWallets?.map((wal) => (
          <button key={wal.uuid} className="px-opt row" onClick={async () => { await w.connectEvm(wal); onClose(); }}>
            {wal.icon ? <img src={wal.icon} alt="" width={22} height={22} /> : <span className="px-wicon">◆</span>}<b>{wal.name}</b>
          </button>
        ))}
        <button className="btn btn-ghost sm" onClick={() => setStep("cat")}>← back</button>
      </div>}
      {step === "sub" && <div className="px-opts">
        {subWallets.length === 0 && <div className="dim">No Substrate wallet detected. Install Polkadot.js, Talisman or SubWallet.</div>}
        {subWallets.map((s) => (
          <button key={s.source} className="px-opt row" onClick={() => w.connectSubstrate(s.source)}>
            <span className="px-wicon">◆</span><b>{s.name}</b>{w.substrateSource === s.source && <span className="ok">connected</span>}
          </button>
        ))}
        {w.substrateAccounts.length > 0 && <div className="px-accs">
          <span className="ulabel">account</span>
          {w.substrateAccounts.map((a) => (
            <label key={a.address} className={w.selectedSubstrate === a.address ? "sel" : ""}>
              <input type="radio" checked={w.selectedSubstrate === a.address} onChange={() => w.selectSubstrate(a.address)} />
              <span>{a.name || "account"}</span><span className="num dim">{short(a.address, 6)}</span>
            </label>
          ))}
          <button className="btn btn-primary sm" onClick={onClose}>done</button>
        </div>}
        {w.substrateAccounts.length === 0 && <button className="btn btn-ghost sm" onClick={() => setStep("cat")}>← back</button>}
      </div>}
    </Modal>
  );
}

function WalletMenu({ w, onClose, onConnect }: { w: PastxWallet; onClose: () => void; onConnect: () => void }) {
  return (
    <Modal title="wallets" onClose={onClose}>
      <div className="px-wm">
        <div className="ulabel">EVM · trading</div>
        {w.evm ? <div className="px-wm-row"><span className="num">{short(w.evm.address, 6)}</span><span className="dim sm">{w.evm.walletName}</span><button className="btn btn-ghost sm" onClick={() => { w.disconnectEvm(); onClose(); }}>disconnect</button></div>
          : <button className="btn btn-ghost sm" onClick={onConnect}>connect EVM</button>}
        <div className="ulabel" style={{ marginTop: 14 }}>Substrate · funding</div>
        {w.selectedSubstrate ? <div className="px-wm-row"><span className="num">{short(w.selectedSubstrate, 6)}</span><span className="dim sm">{w.substrateSource}</span><button className="btn btn-ghost sm" onClick={() => { w.disconnectSubstrate(); onClose(); }}>disconnect</button></div>
          : <button className="btn btn-ghost sm" onClick={onConnect}>connect Substrate</button>}
      </div>
    </Modal>
  );
}

function TopupModal({ w, onClose, onDone }: { w: PastxWallet; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("10");
  const [status, setStatus] = useState<string | null>(null);
  const [tx, setTx] = useState<TxInfo | null>(null);
  const [free, setFree] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (w.selectedSubstrate) substrateFreeBalance(w.selectedSubstrate).then(setFree).catch(() => {}); }, [w.selectedSubstrate]);

  const go = async () => {
    if (!w.selectedSubstrate || !w.evm) return;
    setBusy(true); setTx(null); setStatus("› sign in your Substrate wallet…");
    try {
      const native = parseUnits(amount, PORTALDOT.nativeDecimals);
      const { txHash } = await topUpEvm(w.selectedSubstrate, w.evm.address, native, (s) => setStatus("› " + s));
      setStatus("✓ topped up EVM account");
      setTx(subTx(txHash, `top up ${amount} tPOT`));
      onDone();
    } catch (e: any) { setStatus("✕ " + (e?.message || "failed")); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="top up EVM" onClose={onClose}>
      <p className="dim sm">Send native tPOT from your Substrate wallet into your EVM trading account. Destination is your mapped <span className="num">5…</span> address (fixed).</p>
      <label className="ulabel">amount · tPOT<input className="field amt num" value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /></label>
      <div className="px-row"><span className="ulabel">from · substrate</span><span className="num">{short(w.selectedSubstrate ?? undefined, 6)}</span></div>
      <div className="px-row"><span className="ulabel">free balance</span><span className="num">{free === null ? "-" : formatUnits(free, PORTALDOT.nativeDecimals)} tPOT</span></div>
      <div className="px-row"><span className="ulabel">to · mapped 5… (fixed)</span><span className="num">{short(w.derivedSubstrate ?? undefined, 6)}</span></div>
      <button className="btn btn-primary wfull" disabled={busy || !w.selectedSubstrate} onClick={go}>Sign &amp; top up</button>
      {status && <div className="ticket-status num">{status}</div>}
      {tx && <TxReceipt tx={tx} />}
    </Modal>
  );
}

/* ---- Bridge: Portaldot escrow deposit → relayer mints wtPOT on BNB ---- */
type BridgeStep = "idle" | "depositing" | "relaying" | "done" | "error";
function Bridge({ w, onDone }: { w: PastxWallet; onDone: () => void }) {
  const [amount, setAmount] = useState("5");
  const [step, setStep] = useState<BridgeStep>("idle");
  const [portalTx, setPortalTx] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const go = async () => {
    if (!w.evm) return;
    setStep("depositing"); setPortalTx(null); setMsg(null);
    try {
      const value = parseEther(amount);
      const pub = publicByKey.portaldot;
      const escrow = ADDRESSES.portaldot.escrow as `0x${string}`;
      await ensureChain(chainByKey.portaldot, w.evm.provider);
      const wallet = walletClientFor(chainByKey.portaldot, w.evm.provider);
      const gas = await pub.estimateContractGas({ address: escrow, abi: escrowAbi, functionName: "deposit", args: [w.evm.address], account: w.evm.address, value } as any);
      const gasPrice = await pub.getGasPrice();
      const hash = await wallet.writeContract({ account: w.evm.address, chain: chainByKey.portaldot, address: escrow, abi: escrowAbi, functionName: "deposit", args: [w.evm.address], value, gas: (gas * 150n) / 100n, gasPrice } as any);
      setPortalTx(hash);
      const rc = await pub.waitForTransactionReceipt({ hash });
      const evs = parseEventLogs({ abi: escrowAbi, logs: rc.logs, eventName: "DepositInitiated" });
      const depositId = (evs[0] as any)?.args?.depositId as `0x${string}` | undefined;
      if (!depositId) throw new Error("Deposit event not found");

      setStep("relaying");
      const gateway = ADDRESSES.bnb.gateway as `0x${string}`;
      const start = Date.now();
      let minted = false;
      while (Date.now() - start < 120000) {
        const done = (await publicByKey.bnb.readContract({ address: gateway, abi: gatewayAbi, functionName: "processedDepositIds", args: [depositId] })) as boolean;
        if (done) { minted = true; break; }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!minted) { setStep("error"); setMsg("Relayer didn't respond within 2 min. Make sure `node services/relayer` is running."); return; }
      setStep("done"); onDone();
    } catch (e: any) { setStep("error"); setMsg(e?.shortMessage || e?.message || "Bridge failed"); }
  };

  const stageState = (s: BridgeStep): "done" | "active" | "idle" => {
    const order: BridgeStep[] = ["depositing", "relaying", "done"];
    if (step === "done") return "done";
    const si = order.indexOf(s), ci = order.indexOf(step);
    return ci > si ? "done" : ci === si ? "active" : "idle";
  };

  return (
    <div className="px-cols">
      <section className="panel span2">
        <div className="panel-h"><span className="ulabel">bridge · Portaldot → BNB</span><span className="tag pdot">tPOT → wtPOT</span></div>
        <p className="dim" style={{ marginTop: -6 }}>Lock tPOT in the Portaldot escrow; the relayer mints the same amount of wtPOT to your address on BNB. 1:1, trusted testnet relayer.</p>
        <label className="ulabel" style={{ display: "flex", flexDirection: "column", gap: 7, margin: "14px 0" }}>amount · tPOT
          <input className="field amt num" value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /></label>
        <button className="btn btn-primary wfull" disabled={step === "depositing" || step === "relaying"} onClick={go}>
          {step === "depositing" ? "Confirm in wallet…" : step === "relaying" ? "Relaying…" : "Bridge to BNB"}</button>
        {msg && <div className="ticket-status" style={{ marginTop: 12 }}>{msg}</div>}
        {portalTx && <TxReceipt tx={evmTx("portaldot", portalTx, "escrow deposit · Portaldot")} />}
      </section>

      <section className="panel bridge-flow">
        <div className="panel-h"><span className="ulabel">progress</span></div>
        <Stage n={1} state={stageState("depositing")} title="Lock on Portaldot" sub={portalTx ? short(portalTx, 6) : "deposit tPOT to escrow"} />
        <Stage n={2} state={stageState("relaying")} title="Relayer attests" sub="trusted testnet relayer" />
        <Stage n={3} state={stageState("done")} title="Mint on BNB" sub={`receive ${amount} wtPOT`} />
      </section>
    </div>
  );
}

function Stage({ n, state, title, sub }: { n: number; state: "done" | "active" | "idle"; title: string; sub: string }) {
  return (
    <div className={`bflow-step ${state}`}>
      <span className="bflow-dot">{state === "done" ? "✓" : n}</span>
      <div><div className="bflow-title">{title}</div><div className="dim sm">{sub}</div></div>
    </div>
  );
}

/* ---- Transfer: send your liquid tokens to another address ---- */
type SendKind = "native-evm" | "native-sub" | "erc20";
type Sendable = { key: string; sym: string; net: string; kind: SendKind; chain?: "portaldot" | "bnb"; token?: `0x${string}`; to: "evm" | "sub" };

function Transfer({ w, balances, onDone }: { w: PastxWallet; balances: Balances | null; onDone: () => void }) {
  const assets: Sendable[] = [
    { key: "tpot-evm", sym: "tPOT", net: "Portaldot · EVM", kind: "native-evm", chain: "portaldot", to: "evm" },
    { key: "wtpot", sym: "wtPOT", net: "BNB", kind: "erc20", chain: "bnb", token: ADDRESSES.bnb.wrappedPot as `0x${string}`, to: "evm" },
    { key: "tbnb", sym: "tBNB", net: "BNB · gas", kind: "native-evm", chain: "bnb", to: "evm" },
    { key: "tpot-sub", sym: "tPOT", net: "Substrate · 5…", kind: "native-sub", to: "sub" },
  ];
  const [sel, setSel] = useState<Sendable>(assets[0]);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [tx, setTx] = useState<TxInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [subFree, setSubFree] = useState<bigint | null>(null);

  useEffect(() => { if (sel.kind === "native-sub" && w.selectedSubstrate) substrateFreeBalance(w.selectedSubstrate).then(setSubFree).catch(() => {}); }, [sel, w.selectedSubstrate]);

  const balOf = (a: Sendable): string => {
    if (a.kind === "native-sub") return subFree != null ? formatUnits(subFree, PORTALDOT.nativeDecimals) : "-";
    if (a.key === "tpot-evm") return fmt(balances?.tpot);
    if (a.key === "wtpot") return fmt(balances?.wtpot);
    if (a.key === "tbnb") return fmt(balances?.tbnb);
    return "-";
  };
  const recipOk = sel.to === "evm" ? /^0x[0-9a-fA-F]{40}$/.test(to.trim()) : /^5[1-9A-HJ-NP-Za-km-z]{40,}$/.test(to.trim());

  const send = async () => {
    setBusy(true); setTx(null); setStatus("› preparing…");
    try {
      if (!amount || Number(amount) <= 0) throw new Error("Enter an amount");
      if (sel.kind === "native-sub") {
        if (!w.selectedSubstrate) throw new Error("Connect a Substrate wallet");
        setStatus("› sign in your Substrate wallet…");
        const { txHash } = await transferNative(w.selectedSubstrate, to.trim(), parseUnits(amount, PORTALDOT.nativeDecimals), (s) => setStatus("› " + s));
        setStatus(`✓ sent ${amount} ${sel.sym}`);
        setTx(subTx(txHash, `send ${amount} ${sel.sym}`));
      } else {
        if (!w.evm) throw new Error("Connect an EVM wallet");
        const chain = chainByKey[sel.chain!];
        const pub = publicByKey[sel.chain!];
        const dest = to.trim() as `0x${string}`;
        const value = parseEther(amount);
        await ensureChain(chain, w.evm.provider);
        const wallet = walletClientFor(chain, w.evm.provider);
        setStatus("› confirm in your wallet…");
        let hash: `0x${string}`;
        if (sel.kind === "native-evm") {
          let fee: any = {};
          if (sel.chain === "portaldot") { const gas = await pub.estimateGas({ account: w.evm.address, to: dest, value }); fee = { gas: (gas * 150n) / 100n, gasPrice: await pub.getGasPrice() }; }
          hash = await wallet.sendTransaction({ account: w.evm.address, chain, to: dest, value, ...fee } as any);
        } else {
          hash = await wallet.writeContract({ account: w.evm.address, chain, address: sel.token!, abi: erc20Abi, functionName: "transfer", args: [dest, value] } as any);
        }
        await pub.waitForTransactionReceipt({ hash });
        setStatus(`✓ sent ${amount} ${sel.sym}`);
        setTx(evmTx(sel.chain!, hash, `send ${amount} ${sel.sym}`));
      }
      setTo(""); setAmount(""); onDone();
    } catch (e: any) { setStatus("✕ " + (e?.shortMessage || e?.message || "failed")); } finally { setBusy(false); }
  };

  return (
    <div className="px-cols">
      <section className="panel">
        <div className="panel-h"><span className="ulabel">asset</span></div>
        <div className="send-assets">
          {assets.map((a) => (
            <button key={a.key} className={`send-asset ${sel.key === a.key ? "sel" : ""}`} onClick={() => { setSel(a); setStatus(null); setTx(null); }}>
              <span><b>{a.sym}</b> <span className="dim sm">{a.net}</span></span>
              <span className="num">{balOf(a)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel span2">
        <div className="panel-h"><span className="ulabel">send {sel.sym}</span><span className={`tag ${sel.chain === "bnb" ? "bnb" : "pdot"}`}>{sel.net}</span></div>
        <p className="dim" style={{ marginTop: -6 }}>Send {sel.sym} to another {sel.to === "evm" ? "EVM 0x…" : "Substrate 5…"} address. Balance: <span className="num">{balOf(sel)} {sel.sym}</span></p>
        <label className="ulabel" style={{ display: "flex", flexDirection: "column", gap: 7, margin: "14px 0 12px" }}>recipient · {sel.to === "evm" ? "0x…" : "5…"}
          <input className="field num" value={to} placeholder={sel.to === "evm" ? "0x…" : "5…"} onChange={(e) => setTo(e.target.value)} style={{ fontSize: 14 }} /></label>
        {to.trim() && !recipOk && <div className="dim sm" style={{ color: "var(--down)", marginTop: -6, marginBottom: 10 }}>Not a valid {sel.to === "evm" ? "0x" : "5…"} address</div>}
        <label className="ulabel" style={{ display: "flex", flexDirection: "column", gap: 7 }}>amount · {sel.sym}
          <input className="field amt num" value={amount} inputMode="decimal" placeholder="0.0" onChange={(e) => setAmount(e.target.value)} /></label>
        <button className="btn btn-primary wfull" disabled={busy || !recipOk || !amount} onClick={send} style={{ marginTop: 14 }}>Send {sel.sym}</button>
        {status && <div className="ticket-status" style={{ marginTop: 12 }}>{status}</div>}
        {tx && <TxReceipt tx={tx} />}
      </section>
    </div>
  );
}
