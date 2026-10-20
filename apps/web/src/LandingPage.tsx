import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Blocks, CheckCircle2, CircleDot, GitBranch, Layers3, ShieldCheck, TrendingUp, Wallet, Zap } from "lucide-react";

const ecosystemLinks = [
  { label: "Portaldot official website", href: "https://www.portaldot.io", note: "Project and ecosystem" },
  { label: "Portaldot GitHub", href: "https://github.com/portaldotVolunteer/Portaldot", note: "Protocol source code" },
  { label: "Developer documentation", href: "https://portaldot-dev.readthedocs.io/en/latest/", note: "Build and integrate" },
  { label: "Portaldot node console", href: "https://node-console.portaldot.dev/", note: "Testnet network tools" },
  { label: "Portaldot explorer", href: "https://portalscan.portaldot.io/", note: "Inspect network activity" },
  { label: "Portaldot on X", href: "https://x.com/PortaldotL0", note: "Official ecosystem updates" }
];

export function LandingPage() {
  const [revealReady, setRevealReady] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(".pastx-landing [data-reveal]"));
    if (!targets.length) return;
    setRevealReady(true);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={"pastx-landing landing-redesign" + (revealReady ? " reveal-enabled" : "")}>
      <header className="landing-nav">
        <a className="product-brand" href="/" aria-label="PASTX home"><span className="brand-glyph">P</span><span>PASTX<small>PORTALDOT ASSET &amp; STOCK EXCHANGE</small></span></a>
        <nav aria-label="Main navigation">
          <a href="#product">Product</a><a href="#testnet">Testnet MVP</a><a href="#mainnet">Mainnet vision</a><a href="#iswap">iSwap &amp; iBridge</a><a href="#resources">Resources</a>
        </nav>
        <a className="button button-dark nav-cta" href="/demo">Open demo <ArrowRight size={15} /></a>
      </header>
      <main>
        <section className="landing-hero landing-hero-wide" data-reveal>
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> BUILT FOR PORTALDOT <span className="eyebrow-divider" /> ECOSYSTEM DAPP</div>
            <h1>A stock market<br /><em>built for Portaldot.</em></h1>
            <p className="hero-lede">PASTX brings stock discovery, wallet-based test trading, positions, portfolio tools and transaction activity into one clear workspace. The product starts with a synthetic-market MVP on Portaldot and is designed to grow toward a broader marketplace for tokenized stocks and real-world assets as the network, asset support and settlement infrastructure mature.</p>
            <div className="hero-status-tags"><span><CircleDot size={13} /> Testnet-first MVP</span><span><ShieldCheck size={13} /> Synthetic assets labelled clearly</span><span><GitBranch size={13} /> Mainnet and routing roadmap</span></div>
            <div className="hero-actions"><a className="button button-green" href="/demo">Explore the demo <ArrowRight size={16} /></a><a className="text-link" href="#testnet">See what is available <ArrowDownRight size={15} /></a></div>
            <p className="hero-caveat">This is a testnet product preview. Current stock tokens are synthetic and do not represent real equity ownership.</p>
          </div>
        </section>
        <section className="product-status-strip" aria-label="PASTX product principles" data-reveal>
          <div><span className="status-number">01</span><strong>Portaldot is home</strong><small>Built around the Portaldot ecosystem</small></div>
          <div><span className="status-number">02</span><strong>One market workspace</strong><small>Discover, trade, track and review</small></div>
          <div><span className="status-number">03</span><strong>Grow with verified infrastructure</strong><small>Future capabilities stay clearly labelled</small></div>
        </section>
        <section className="landing-section product-section landing-section-rich" id="product" data-reveal>
          <div className="section-intro">
            <div className="eyebrow">WHAT PASTX IS</div><h2>Market access<br /><em>without the confusion.</em></h2>
            <p>PASTX is a Portaldot-first stock-market application. It is designed to give users one place to discover synthetic stock listings, connect a compatible wallet, place supported test-market buy and sell orders, see their positions and balances, and understand what is happening on-chain.</p>
            <p>Today, the project is a testnet MVP. Longer term, the vision is to support a wider set of verified tokenized assets, deeper market data, a native asset-swap experience through iSwap, and carefully validated asset routes through iBridge.</p>
            <a className="text-link" href="/demo">Open the interactive workspace <ArrowRight size={15} /></a>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-dark"><div className="feature-icon"><BarChart3 size={19} /></div><span className="feature-index">01 / DISCOVER</span><h3>One stock directory.</h3><p>Explore clearly labelled synthetic listings instead of mistaking an external stock reference for an on-chain asset.</p><span className="feature-foot"><CircleDot size={12} /> Market discovery</span></article>
            <article className="feature-card"><div className="feature-icon green-icon"><Wallet size={19} /></div><span className="feature-index">02 / TRADE</span><h3>Buy and sell test assets.</h3><p>Use the market ticket for supported demo trades when Portaldot market contracts are deployed and configured.</p><span className="feature-foot"><CheckCircle2 size={12} /> Wallet-confirmed actions</span></article>
            <article className="feature-card"><div className="feature-icon purple-icon"><Layers3 size={19} /></div><span className="feature-index">03 / TRACK</span><h3>Your portfolio in context.</h3><p>Review supported balances, synthetic positions and activity from one workspace, with test assets identified honestly.</p><span className="feature-foot"><CheckCircle2 size={12} /> Portfolio visibility</span></article>
          </div>
        </section>
        <section className="landing-section testnet-section" id="testnet" data-reveal>
          <div className="section-heading-row"><div><div className="eyebrow">CURRENT MVP</div><h2>What you can explore<br /><em>on the testnet today.</em></h2></div><p className="section-heading-copy">The demo shows the intended product workflow on Portaldot V3 Testnet. Individual on-chain actions depend on the relevant contract address being deployed, verified and configured.</p></div>
          <div className="capability-grid">
            <article className="capability-card"><span className="capability-icon"><BarChart3 size={18} /></span><span className="capability-number">01</span><h3>Stock directory</h3><p>Browse sample listings such as Apple, NVIDIA, Tesla and Microsoft. These are synthetic demo instruments, not live exchange-listed assets.</p><span className="capability-status status-available">Available in the UI</span></article>
            <article className="capability-card"><span className="capability-icon"><Wallet size={18} /></span><span className="capability-number">02</span><h3>Market buy and sell</h3><p>Review the selected listing and amount, then submit a supported test trade when its contract is configured. Prices are owner-set demo prices, not live quotes.</p><span className="capability-status status-gated">Contract dependent</span></article>
            <article className="capability-card"><span className="capability-icon"><TrendingUp size={18} /></span><span className="capability-number">03</span><h3>Positions beneath the directory</h3><p>See the synthetic stock shares held by your connected wallet directly beneath the directory, keeping selection and management in one workflow.</p><span className="capability-status status-gated">Configured markets</span></article>
            <article className="capability-card"><span className="capability-icon"><Layers3 size={18} /></span><span className="capability-number">04</span><h3>Portfolio and assets</h3><p>Review the Portaldot native balance, supported PASTX demo-token balance and known synthetic positions. Send native test tokens or pUSD when supported settings are ready.</p><span className="capability-status status-gated">Supported assets only</span></article>
            <article className="capability-card"><span className="capability-icon"><ShieldCheck size={18} /></span><span className="capability-number">05</span><h3>Transaction activity</h3><p>Open explorer links for confirmed transactions recorded in the current browser session. Persistent account-wide trade history is a future improvement.</p><span className="capability-status status-available">Session activity</span></article>
            <article className="capability-card"><span className="capability-icon"><GitBranch size={18} /></span><span className="capability-number">06</span><h3>iBridge route preview</h3><p>Enter source network, destination network, asset and amount to preview the intended journey. The current flow is a simulation and does not transfer funds.</p><span className="capability-status status-demo">Simulation only</span></article>
          </div>
          <div className="truth-note"><ShieldCheck size={18} /><div><strong>Transparent testnet status</strong><p>pUSD is a PASTX demo token, not USDC or USDT, and has no redemption value. Synthetic stock tokens do not confer equity ownership. If market, token or faucet addresses are not configured, the relevant on-chain action remains unavailable rather than pretending a transaction succeeded.</p></div></div>
        </section>
        <section className="landing-section mainnet-section" id="mainnet" data-reveal>
          <div className="section-heading-row"><div><div className="eyebrow">WHEN PORTALDOT MAINNET IS READY</div><h2>From a testnet preview<br /><em>to a market users can rely on.</em></h2></div><p className="section-heading-copy">Mainnet functionality is planned, not live. It comes only after contract deployment, runtime checks, asset verification and the relevant market and settlement paths have been validated.</p></div>
          <div className="future-grid">
            <article className="future-card"><span className="future-label">MAINNET FOUNDATION</span><h3>Verified Portaldot deployment</h3><p>Deploy and verify market, token and faucet contracts on the intended network; confirm wallet support, decimals, transaction behavior and explorer records.</p></article>
            <article className="future-card"><span className="future-label">ASSET REGISTRY</span><h3>Clear asset identity</h3><p>Publish supported assets with verified contract addresses, metadata, payment asset and explicit issuer/backing information where applicable.</p></article>
            <article className="future-card"><span className="future-label">MARKET DATA</span><h3>Source-aware pricing</h3><p>Introduce approved data or pricing infrastructure with source, timestamp and staleness checks. External stock prices will not silently become executable on-chain prices.</p></article>
            <article className="future-card"><span className="future-label">PORTFOLIO</span><h3>On-chain holdings and activity</h3><p>Expand views around verified balances and persistent transaction history, rather than relying only on the current browser session.</p></article>
            <article className="future-card"><span className="future-label">EXECUTION</span><h3>Supported market trades</h3><p>Enable real transactions only for listings with a validated execution path, adequate liquidity, clear fees and correct token settlement behavior.</p></article>
            <article className="future-card"><span className="future-label">LONG-TERM VISION</span><h3>A broader tokenized-asset market</h3><p>Expand beyond the synthetic demo toward authorized tokenized stocks and real-world assets only when issuer, custody, legal and technical requirements are satisfied.</p></article>
          </div>
        </section>
        <section className="landing-section routing-section" id="iswap" data-reveal>
          <div className="section-heading-row"><div><div className="eyebrow">THE NEXT PRODUCT LAYER</div><h2>iSwap and iBridge.<br /><em>Different jobs, one experience.</em></h2></div><p className="section-heading-copy">Both are roadmap capabilities. The demo preview is deliberately separate from an actual swap, bridge or settlement transaction.</p></div>
          <div className="routing-grid">
            <article className="routing-card routing-iswap"><div className="routing-card-head"><span className="routing-icon"><Zap size={20} /></span><span className="roadmap-status status-future">PLANNED</span></div><h3>iSwap</h3><p className="routing-lede">Swap supported assets within an available Portaldot route.</p><ul><li><CheckCircle2 size={15} /> Choose the asset you pay with and the asset you want</li><li><CheckCircle2 size={15} /> Review estimated output, fees and price impact when supported</li><li><CheckCircle2 size={15} /> Confirm a swap only when pools, liquidity and routing are verified</li></ul><p className="routing-footnote">No live iSwap transaction is enabled by this testnet preview.</p></article>
            <article className="routing-card routing-ibridge"><div className="routing-card-head"><span className="routing-icon"><GitBranch size={20} /></span><span className="roadmap-status status-demo">SIMULATOR ONLY</span></div><h3>iBridge</h3><p className="routing-lede">A bridge-style flow for moving supported assets between Portaldot and approved external networks.</p><ul><li><CheckCircle2 size={15} /> Select source network, destination network, asset and amount</li><li><CheckCircle2 size={15} /> Review route, expected destination asset and fees before signing</li><li><CheckCircle2 size={15} /> Follow source and destination transaction status once a real, validated route exists</li></ul><p className="routing-footnote">Today, the UI can only preview a route. No cross-network funds move.</p></article>
          </div>
        </section>
        <section className="landing-section roadmap-section roadmap-section-rich" id="roadmap" data-reveal>
          <div className="roadmap-copy"><div className="eyebrow">THE ROADMAP</div><h2>Build carefully.<br /><em>Expand with evidence.</em></h2><p>PASTX will expand as Portaldot and its supporting infrastructure are ready. Each milestone is gated by working evidence—verified contracts, assets, price sources and routes—not a UI label alone.</p><a className="button button-dark" href="/demo">Explore the current MVP <ArrowRight size={15} /></a></div>
          <div className="roadmap-list">
            <div className="roadmap-item"><span className="roadmap-status status-current">NOW</span><div><strong>Testnet product foundation</strong><p>Stock directory, buy/sell UI, positions, portfolio, activity and iBridge simulation.</p></div></div>
            <div className="roadmap-item"><span className="roadmap-status status-demo">NEXT</span><div><strong>Verified Portaldot deployment</strong><p>Validate runtime behavior and wallet transactions, then deploy only after human approval.</p></div></div>
            <div className="roadmap-item"><span className="roadmap-status status-future">LATER</span><div><strong>Mainnet, iSwap and iBridge</strong><p>Enable supported assets and routes only after execution, liquidity, security and settlement checks.</p></div></div>
            <div className="roadmap-item"><span className="roadmap-status status-future">VISION</span><div><strong>More asset classes</strong><p>Grow with verified tokenized assets and richer market and portfolio information over time.</p></div></div>
          </div>
        </section>
        <section className="landing-section resources-section" id="resources" data-reveal>
          <div className="section-heading-row"><div><div className="eyebrow">LINKS AND RESOURCES</div><h2>Built in the open.<br /><em>Grounded in Portaldot.</em></h2></div><p className="section-heading-copy">Explore the product, Portaldot source and developer documentation, or the repository behind PASTX.</p></div>
          <div className="resource-grid">
            <a className="resource-card resource-primary" href="https://github.com/Investorquab/PASTX" target="_blank" rel="noreferrer"><span><Blocks size={19} /></span><strong>PASTX GitHub</strong><small>Product source, issues and engineering</small><ArrowUpRight size={15} /></a>
            <a className="resource-card" href="https://github.com/Investorquab" target="_blank" rel="noreferrer"><span><GitBranch size={19} /></span><strong>Builder profile</strong><small>More work from Quab</small><ArrowUpRight size={15} /></a>
            {ecosystemLinks.map((link) => <a className="resource-card" href={link.href} key={link.href} target="_blank" rel="noreferrer"><span><Layers3 size={19} /></span><strong>{link.label}</strong><small>{link.note}</small><ArrowUpRight size={15} /></a>)}
            <a className="resource-card" href="https://github.com/Investorquab/PASTX/blob/ui/firstbell-inspired-market-terminal/docs/PASTX-MARKET-IMPLEMENTATION.md" target="_blank" rel="noreferrer"><span><ShieldCheck size={19} /></span><strong>Technical notes</strong><small>Current implementation and validation boundaries</small><ArrowUpRight size={15} /></a>
          </div>
        </section>
        <section className="landing-cta landing-cta-rich" data-reveal><div><span className="eyebrow">EXPLORE PASTX</span><h2>See the market workspace for yourself.</h2><p>Explore the current testnet experience and its clearly labelled roadmap boundaries.</p></div><a className="button button-green" href="/demo">Open demo <ArrowRight size={16} /></a></section>
      </main>
      <footer className="landing-footer landing-footer-rich"><a className="product-brand" href="/"><span className="brand-glyph">P</span><span>PASTX<small>PORTALDOT ASSET &amp; STOCK EXCHANGE</small></span></a><p>Synthetic test assets today. Mainnet, swap and bridge capabilities remain roadmap items until verified and enabled.</p><div><a href="https://github.com/Investorquab/PASTX" target="_blank" rel="noreferrer">PASTX GitHub <ArrowUpRight size={12} /></a><a href="https://www.portaldot.io" target="_blank" rel="noreferrer">Portaldot <ArrowUpRight size={12} /></a><a href="/demo">Open demo</a></div></footer>
    </div>
  );
}
