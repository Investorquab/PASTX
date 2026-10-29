import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Wallet, Coins, Repeat, GitBranch, Send, ShieldCheck, CircleDot, Layers3, Boxes, Server, FileCode2 } from "lucide-react";
import { portalPublic } from "./pastx/clients";
import { PastxMark } from "./pastx/Logo";

const PORTAL = {
  chainId: 420420777,
  evmRpc: "https://test-evm-rpc-v3.portaldot.dev",
  ws: "wss://test-node-v3.portaldot.dev",
  contracts: [
    { name: "PortalDotNativeMarket", role: "Fixed-price synthetic-stock market, settled in native tPOT", addr: "0x2f85A292316f0B3385F0B5499b3490d33E958407" },
    { name: "PastxTestStock · pAAPL", role: "Synthetic Apple share token", addr: "0x2eE620904288455e79be88cd6cf383b6685dd652" },
    { name: "PastxTestStock · pNVDA", role: "Synthetic Nvidia share token", addr: "0x4B4535eD1825ef147c32aa58d9848e624C33C2E3" },
    { name: "PortalDotBridgeEscrow", role: "Locks tPOT for the cross-chain route to BNB", addr: "0x024b77EBbF04f48a0d921094f7000b18063bdD69" },
  ],
};
const BNB = {
  chainId: 97,
  explorer: "https://testnet.bscscan.com/address/",
  contracts: [
    { name: "BnbBridgeGateway", role: "Mints/burns wtPOT against the Portaldot escrow", addr: "0xd81133c76289Df27105E8aF15579631fE305F9E1" },
    { name: "WrappedPot · wtPOT", role: "Bridged representation of tPOT on BNB (18 dec)", addr: "0xda7C743A57b2478b801Ab12cDB1f0245b7817Fb9" },
    { name: "BnbWrappedPotMarket", role: "Synthetic-stock market, settled in wtPOT", addr: "0x39f98C838273F29E1095440Eb4411AfeFC2C546c" },
    { name: "PastxTestStock · bAAPL", role: "Synthetic Apple share token", addr: "0xa4722Db67CD3C83798396aa2Ba360c0963c327a7" },
    { name: "PastxTestStock · bNVDA", role: "Synthetic Nvidia share token", addr: "0x7592Ba534c0937061f29ec73b950bF619F8Dca41" },
  ],
};

const steps = [
  { icon: <Wallet size={18} />, title: "Connect", body: "An EVM wallet (MetaMask, Rabby, OKX) signs trades. A Substrate wallet (Talisman, Polkadot.js, SubWallet) funds it. Keys never leave your browser." },
  { icon: <Coins size={18} />, title: "Fund your EVM account", body: "Move faucet tPOT from your 5… address into your EVM account. Portaldot maps every 0x address to a backing 5… account, so the transfer credits your EVM balance 1:1." },
  { icon: <Repeat size={18} />, title: "Trade on Portaldot", body: "Buy and sell synthetic stocks with native tPOT. Orders settle in the PortalDotNativeMarket contract: real on-chain positions, not a mock." },
  { icon: <GitBranch size={18} />, title: "Bridge to BNB", body: "Lock tPOT in the escrow; a relayer attests it to the BNB gateway, which mints the same amount of wtPOT to your address. 1:1, replay-protected." },
  { icon: <Boxes size={18} />, title: "Trade on BNB", body: "Use bridged wtPOT to trade synthetic stocks on the BNB market: the same mechanics, a second venue." },
  { icon: <Send size={18} />, title: "Send to anyone", body: "Transfer your tPOT, wtPOT or tBNB to any address directly from PASTX, without leaving for your wallet app." },
];

function ContractGroup({ title, tagClass, chainId, rows, explorer }: { title: string; tagClass: string; chainId: number; rows: { name: string; role: string; addr: string }[]; explorer?: string }) {
  return (
    <div className="contract-col">
      <div className="contract-col-head"><h3>{title}</h3><span className={`chain-pill ${tagClass}`}>chain {chainId}</span></div>
      {rows.map((c) => (
        <div className="contract-item" key={c.addr}>
          <div className="contract-item-top">
            <strong>{c.name}</strong>
            {explorer
              ? <a className="addr" href={explorer + c.addr} target="_blank" rel="noreferrer">{c.addr.slice(0, 10)}…{c.addr.slice(-8)} <ArrowUpRight size={12} /></a>
              : <span className="addr">{c.addr.slice(0, 10)}…{c.addr.slice(-8)}</span>}
          </div>
          <p>{c.role}</p>
        </div>
      ))}
    </div>
  );
}

const TICKERS = [
  { sym: "pAAPL", chain: "PDOT", unit: "tPOT", base: 2.0 },
  { sym: "pNVDA", chain: "PDOT", unit: "tPOT", base: 1.8 },
  { sym: "bAAPL", chain: "BNB", unit: "wtPOT", base: 2.0 },
  { sym: "bNVDA", chain: "BNB", unit: "wtPOT", base: 1.8 },
];

function HeroTerminal() {
  const [rows, setRows] = useState(TICKERS.map((t) => ({ ...t, price: t.base, dir: 0 as -1 | 0 | 1 })));
  const [block, setBlock] = useState<number | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    // demo price motion - purely illustrative movement around the fixed demo price
    const id = setInterval(() => {
      setRows((rs) => rs.map((r) => {
        const drift = (Math.random() - 0.5) * 0.02;
        const next = Math.max(r.base * 0.92, Math.min(r.base * 1.08, r.price * (1 + drift)));
        return { ...r, dir: next > r.price ? 1 : next < r.price ? -1 : 0, price: next };
      }));
    }, 1900);
    if (!seeded.current) { seeded.current = true; }
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let on = true;
    const tick = () => portalPublic.getBlockNumber().then((b) => on && setBlock(Number(b))).catch(() => {});
    tick();
    const id = setInterval(tick, 3000);
    return () => { on = false; clearInterval(id); };
  }, []);

  return (
    <aside className="hero-terminal" aria-hidden="true">
      <div className="ht-head">
        <span className="ht-title"><span className="eyebrow-dot" /> PASTX terminal</span>
        <span className="ht-block">{block ? `block ${block.toLocaleString()}` : "connecting…"}</span>
      </div>
      <div className="ht-rows">
        {rows.map((r) => {
          const pct = ((r.price - r.base) / r.base) * 100;
          return (
            <div className={`ht-row ${r.dir > 0 ? "up" : r.dir < 0 ? "down" : ""}`} key={r.sym}>
              <span className="ht-sym">{r.sym}</span>
              <span className={`chain-pill ${r.chain === "PDOT" ? "pdot" : "bnb"}`}>{r.chain}</span>
              <span className="ht-price">{r.price.toFixed(3)} <small>{r.unit}</small></span>
              <span className={`ht-delta ${pct >= 0 ? "pos" : "neg"}`}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%</span>
            </div>
          );
        })}
      </div>
      <div className="ht-bridge">
        <span className="chain-pill pdot">tPOT</span>
        <span className="ht-wire"><span className="ht-spark" /></span>
        <span className="chain-pill bnb">wtPOT</span>
        <span className="ht-bridge-note">bridged 1:1</span>
      </div>
      <div className="ht-foot">
        <span><b>9</b> contracts</span><span><b>2</b> chains</span><span><b>4</b> stocks</span>
        <span className="ht-live"><span className="eyebrow-dot" /> live testnet</span>
      </div>
    </aside>
  );
}

export function LandingPage() {
  const [revealReady, setRevealReady] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(".pastx-landing .landing-section, .pastx-landing .product-status-strip, .pastx-landing .landing-cta"));
    if (!targets.length) return;
    setRevealReady(true);
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, []);

  return (
    <div className={"pastx-landing landing-redesign" + (revealReady ? " reveal-enabled" : "")}>
      <header className="landing-nav">
        <a className="product-brand" href="/" aria-label="PASTX home"><PastxMark size={27} /><span>PASTX<small>PORTALDOT ASSET &amp; STOCK EXCHANGE</small></span></a>
        <nav aria-label="Main navigation">
          <a href="#product">Product</a><a href="#how">How it works</a><a href="#contracts">Contracts</a><a href="#status">Status</a><a href="#resources">Resources</a>
        </nav>
        <div className="landing-nav-actions"><a className="button button-dark nav-cta" href="/demo">Open the app <ArrowRight size={15} /></a></div>
      </header>

      <main>
        <section className="landing-hero landing-hero-wide">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> Live on Portaldot V3 <span className="eyebrow-divider" /> BNB testnet</div>
            <h1>Synthetic stock markets,<br /><em>settled on Portaldot.</em></h1>
            <p className="hero-lede">PASTX brings stock-style trading to the Portaldot testnet. Fund an account from your tPOT faucet balance, buy and sell synthetic equities on-chain, and bridge value to BNB to trade there too, backed by real deployed contracts, not a mockup.</p>
            <div className="hero-actions"><a className="button button-green" href="/demo">Launch the app <ArrowRight size={16} /></a><a className="text-link" href="#contracts">View deployed contracts <ArrowRight size={15} /></a></div>
            <ul className="hero-chips">
              <li><Repeat size={13} /> On-chain settlement</li>
              <li><GitBranch size={13} /> Cross-chain to BNB</li>
              <li><ShieldCheck size={13} /> Self-custody</li>
              <li><CircleDot size={13} /> Replay-protected</li>
            </ul>
            <p className="hero-caveat">Testnet only. Assets are synthetic demo tokens, not real equities. The cross-chain route uses a clearly-labelled trusted relayer, not a trustless bridge.</p>
          </div>
          <HeroTerminal />
        </section>

        <section className="product-status-strip">
          <div><CircleDot size={15} className="green-icon" /><strong>Portaldot-first</strong><small>Trade synthetic stocks natively with tPOT. Every buy and sell settles in an on-chain market contract on Portaldot V3.</small></div>
          <div><GitBranch size={15} className="purple-icon" /><strong>Cross-chain</strong><small>Move value to BNB through an escrow-and-gateway route and trade there with wtPOT, a 1:1 bridged representation of tPOT.</small></div>
          <div><ShieldCheck size={15} className="green-icon" /><strong>Self-custody</strong><small>Your wallet signs every transaction. The relayer only attests deposits; it never holds your keys or your funds.</small></div>
        </section>

        <section className="landing-section product-section" id="product">
          <div className="section-intro">
            <div className="eyebrow">What PASTX is</div>
            <h2>A working testnet exchange,<br /><em>not a pitch deck.</em></h2>
            <p>PASTX is a full trading app for the Portaldot ecosystem. You connect a wallet, see your balances across Portaldot and BNB, and trade a small set of synthetic stocks that settle entirely on-chain. It demonstrates the complete mechanics (pricing, settlement, cross-chain transfer and transaction history) without pretending the test tokens are real money or that the synthetic shares are regulated equities.</p>
            <p>The point is activity on Portaldot: tPOT holders get somewhere to use their balance, and the app shows how a real asset marketplace could grow on top of Portaldot's native runtime.</p>
            <a className="text-link" href="/demo">Open the workspace <ArrowRight size={15} /></a>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-dark"><div className="feature-icon"><Repeat size={19} /></div><h3>On-chain markets</h3><p>Fixed-price market contracts on both chains hold stock inventory and settle buys and sells atomically. Positions are real contract state you can read back.</p><span className="feature-foot"><CircleDot size={12} /> live on Portaldot &amp; BNB</span></article>
            <article className="feature-card"><div className="feature-icon green-icon"><Coins size={19} /></div><h3>Account funding</h3><p>Portaldot maps each EVM address to a Substrate account. PASTX uses that mapping to let you fund your 0x trading account straight from your 5… faucet balance.</p><span className="feature-foot">tPOT 5… → 0x, 1:1</span></article>
            <article className="feature-card"><div className="feature-icon purple-icon"><GitBranch size={19} /></div><h3>Cross-chain route</h3><p>A capped escrow on Portaldot and a gateway on BNB move value between chains. Deposits are nonce'd and deduplicated; wtPOT is only minted against a matching locked deposit.</p><span className="feature-foot">trusted relayer · testnet</span></article>
          </div>
        </section>

        <section className="landing-section how-section" id="how">
          <div className="section-heading-row">
            <div><div className="eyebrow">How it works</div><h2>From faucet to filled order,<br /><em>in six steps.</em></h2></div>
            <p className="section-heading-copy">Each step is a real signed transaction against a deployed contract. Nothing here is simulated in the browser.</p>
          </div>
          <ol className="arch-steps">
            {steps.map((s, i) => (
              <li className="arch-step" key={s.title}>
                <span className="arch-step-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="arch-step-icon">{s.icon}</span>
                <div><h3>{s.title}</h3><p>{s.body}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section contracts-section" id="contracts">
          <div className="section-heading-row">
            <div><div className="eyebrow">Deployed contracts</div><h2>Everything is on-chain,<br /><em>and verifiable.</em></h2></div>
            <p className="section-heading-copy">The addresses below are the live testnet deployment. BNB contracts link to BscScan; Portaldot runs its EVM at <code>{PORTAL.evmRpc}</code>.</p>
          </div>
          <div className="contract-cols">
            <ContractGroup title="Portaldot V3" tagClass="pdot" chainId={PORTAL.chainId} rows={PORTAL.contracts} />
            <ContractGroup title="BNB Smart Chain testnet" tagClass="bnb" chainId={BNB.chainId} rows={BNB.contracts} explorer={BNB.explorer} />
          </div>
          <div className="truth-note"><ShieldCheck size={18} /><div><strong>What these contracts are, and what they are not</strong><p>Prices are owner-set demo prices, not live quotes or oracle prices. Stock tokens are non-transferable except through their market, and confer no equity, dividend or ownership rights. The bridge is operated by a single trusted relayer; it does not verify the other chain's consensus and is not a trustless bridge. All of this is testnet.</p></div></div>
        </section>

        <section className="landing-section status-section" id="status">
          <div className="section-heading-row">
            <div><div className="eyebrow">Status</div><h2>What's live now,<br /><em>and what's next.</em></h2></div>
            <p className="section-heading-copy">Honest about the line between what's deployed and what's on the roadmap.</p>
          </div>
          <div className="capability-grid">
            <article className="capability-card"><span className="capability-icon"><Repeat size={18} /></span><h3>Native stock trading</h3><p>Buy and sell synthetic stocks with tPOT on Portaldot, settled on-chain.</p><span className="capability-status status-available">Live</span></article>
            <article className="capability-card"><span className="capability-icon"><Coins size={18} /></span><h3>EVM account funding</h3><p>Fund your 0x trading account from your 5… faucet balance via the account mapping.</p><span className="capability-status status-available">Live</span></article>
            <article className="capability-card"><span className="capability-icon"><GitBranch size={18} /></span><h3>tPOT ⇄ wtPOT bridge</h3><p>Escrow-and-gateway route with a trusted relayer. Forward (tPOT → wtPOT) is live.</p><span className="capability-status status-demo">Trusted relayer</span></article>
            <article className="capability-card"><span className="capability-icon"><Send size={18} /></span><h3>Peer transfers</h3><p>Send tPOT, wtPOT and tBNB to any address from inside the app.</p><span className="capability-status status-available">Live</span></article>
            <article className="capability-card"><span className="capability-icon"><Layers3 size={18} /></span><h3>Native AMM &amp; oracle pricing</h3><p>Portaldot ships AssetConversion and Oracle pallets; wiring real swaps and feeds is next.</p><span className="capability-status status-gated">Planned</span></article>
            <article className="capability-card"><span className="capability-icon"><ShieldCheck size={18} /></span><h3>Trustless iBridge &amp; mainnet</h3><p>A verifying bridge and a mainnet deployment follow once the testnet mechanics are proven.</p><span className="capability-status status-gated">Future</span></article>
          </div>
        </section>

        <section className="landing-section resources-section" id="resources">
          <div className="section-heading-row">
            <div><div className="eyebrow">Resources</div><h2>Dig into the code<br /><em>and the ecosystem.</em></h2></div>
            <p className="section-heading-copy">PASTX is built in the open on the Portaldot testnet.</p>
          </div>
          <div className="resource-grid">
            <a className="resource-card resource-primary" href="https://github.com/Investorquab/PASTX" target="_blank" rel="noreferrer"><span><FileCode2 size={19} /></span><strong>PASTX source</strong><small>Contracts, deploy scripts, the app and the relayer</small><ArrowUpRight size={15} /></a>
            <a className="resource-card" href="https://www.portaldot.io" target="_blank" rel="noreferrer"><span><Boxes size={19} /></span><strong>Portaldot</strong><small>The network PASTX is built on</small><ArrowUpRight size={15} /></a>
            <a className="resource-card" href="https://node-console.portaldot.dev/" target="_blank" rel="noreferrer"><span><Server size={19} /></span><strong>Node console</strong><small>Portaldot V3 testnet tools</small><ArrowUpRight size={15} /></a>
            <a className="resource-card" href="https://testnet.bscscan.com/address/0xda7C743A57b2478b801Ab12cDB1f0245b7817Fb9" target="_blank" rel="noreferrer"><span><GitBranch size={19} /></span><strong>wtPOT on BscScan</strong><small>Inspect the bridged token on BNB</small><ArrowUpRight size={15} /></a>
          </div>
        </section>

        <section className="landing-cta landing-cta-rich">
          <div><span className="eyebrow">Ready</span><h2>Put your tPOT to work.</h2><p>Connect a wallet and trade synthetic stocks on Portaldot in a couple of minutes.</p></div>
          <a className="button button-green" href="/demo">Open the app <ArrowRight size={16} /></a>
        </section>
      </main>

      <footer className="landing-footer landing-footer-rich">
        <a className="product-brand" href="/"><PastxMark size={27} /><span>PASTX<small>PORTALDOT ASSET &amp; STOCK EXCHANGE</small></span></a>
        <p>Testnet demonstration. Synthetic assets, not real equities. The cross-chain route is a trusted-relayer prototype, not a trustless bridge.</p>
        <div><a href="https://github.com/Investorquab/PASTX" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><a href="https://www.portaldot.io" target="_blank" rel="noreferrer">Portaldot <ArrowUpRight size={12} /></a><a href="/demo">Open the app</a></div>
      </footer>
    </div>
  );
}
