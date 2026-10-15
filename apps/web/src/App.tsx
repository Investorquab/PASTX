import { useEffect, useMemo, useState } from "react";
import { getChainStatus, type ChainStatus } from "./api";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChartCandlestick,
  ChevronDown,
  CircleHelp,
  Compass,
  Layers3,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type MarketItem = {
  symbol: string;
  name: string;
  category: string;
  price: string;
  change: string;
  positive: boolean;
  initials: string;
};

const referenceMarkets: MarketItem[] = [
  { symbol: "AAPL", name: "Apple Inc.", category: "US EQUITY · REFERENCE", price: "$247.96", change: "+1.24%", positive: true, initials: "A" },
  { symbol: "NVDA", name: "NVIDIA Corporation", category: "US EQUITY · REFERENCE", price: "$181.42", change: "+2.86%", positive: true, initials: "N" },
  { symbol: "TSLA", name: "Tesla, Inc.", category: "US EQUITY · REFERENCE", price: "$438.07", change: "−0.72%", positive: false, initials: "T" },
  { symbol: "MSFT", name: "Microsoft Corporation", category: "US EQUITY · REFERENCE", price: "$514.21", change: "+0.38%", positive: true, initials: "M" },
];

const candles = [34, 42, 37, 51, 47, 43, 59, 55, 65, 60, 73, 67, 77, 70, 84, 79, 90, 82, 96, 88, 103, 95, 108, 101, 116, 110, 122, 113, 128, 121, 136, 130, 143, 135, 151, 145, 158, 149, 166, 158, 174, 166, 183, 175, 191, 182, 199, 191, 208, 200, 217, 210];

function MiniChart() {
  const points = candles.map((y, index) => `${(index / (candles.length - 1)) * 100},${220 - y}`).join(" ");
  return (
    <svg className="chart-line" viewBox="0 0 100 220" preserveAspectRatio="none" role="img" aria-label="Illustrative upward market chart, not live price data">
      <defs>
        <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#64e5b4" stopOpacity=".24" />
          <stop offset="100%" stopColor="#64e5b4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,220 ${points} 100,220`} fill="url(#chart-fill)" />
      <polyline points={points} fill="none" stroke="#64e5b4" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [chainStatusError, setChainStatusError] = useState(false);

  useEffect(() => {
    let active = true;
    getChainStatus()
      .then((status) => {
        if (active) setChainStatus(status);
      })
      .catch(() => {
        if (active) setChainStatusError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const chainStatusLabel = chainStatus
    ? ({
        not_configured: "RPC not configured",
        unreachable: "RPC unreachable",
        wrong_network: "Wrong network",
        verified: "Chain ID verified"
      } as const)[chainStatus.status]
    : chainStatusError
      ? "API unavailable"
      : "Checking RPC…";
  const chainStatusDetail = chainStatus?.status === "verified"
    ? "Read-only identity check; settlement unverified"
    : chainStatus?.status === "wrong_network"
      ? `Expected chain ID ${chainStatus.expectedChainId}; received ${chainStatus.chainId}`
      : chainStatus?.status === "unreachable"
        ? "Configured RPC did not respond"
        : chainStatus?.status === "not_configured"
          ? `Expected EVM chain ID ${chainStatus.expectedChainId}`
          : "Network integration not verified";

  const visibleMarkets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return referenceMarkets;
    return referenceMarkets.filter((market) =>
      [market.symbol, market.name, market.category].some((field) => field.toLowerCase().includes(query))
    );
  }, [searchTerm]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="PASTX home">
          <span className="brand-mark"><ChartCandlestick size={22} /></span>
          <span>PAST<span className="brand-x">X</span><small>ASSET EXCHANGE</small></span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#markets"><Compass size={17} /> Markets</a>
          <a className="nav-item" href="#portfolio"><Layers3 size={17} /> Portfolio <span className="nav-soon">SOON</span></a>
          <a className="nav-item" href="#activity"><Activity size={17} /> Activity <span className="nav-soon">SOON</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="network-card">
            <span className="network-dot" />
            <div><strong>Network status</strong><small>{chainStatusDetail}</small></div>
          </div>
          <a className="nav-item muted-link" href="#docs"><CircleHelp size={17} /> Documentation</a>
          <div className="sidebar-foot">PASTX PREVIEW <span>v0.1.0</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">PASTX <span>/</span> Markets</div>
          <div className="top-actions">
            <span className="preview-pill"><span /> PREVIEW · SAMPLE DATA</span>
            <button className="icon-button" aria-label="Notifications" type="button" disabled title="Notifications are not implemented in this preview"><Bell size={18} /></button>
            <button className="connect-button" type="button" disabled title="Wallet connection will be added after chain compatibility testing"><Wallet size={16} /> Wallet integration pending</button>
          </div>
        </header>

        <section className="page-intro" id="markets">
          <div>
            <div className="eyebrow">THE MARKET TERMINAL</div>
            <h1>Markets, <span>in perspective.</span></h1>
            <p>Explore reference instruments and prepare for on-chain markets built for Portaldot.</p>
          </div>
          <div className="search-box"><Search size={17} /><input aria-label="Search markets" placeholder="Search markets..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /><kbd>Search</kbd></div>
        </section>

        <div className="notice" role="note">
          <ShieldCheck size={18} />
          <div><strong>Preview environment</strong><span>Prices and chart below are illustrative fixtures, not live quotes. No trades or wallet transactions are enabled.</span></div>
        </div>

        <section className="summary-grid" aria-label="Market overview">
          <article className="summary-card">
            <div className="card-label">TRACKED INSTRUMENTS <span className="tiny-icon"><Layers3 size={15} /></span></div>
            <div className="summary-value">04 <span className="summary-sub">preview entries</span></div>
            <div className="summary-note">Reference catalogue only</div>
          </article>
          <article className="summary-card">
            <div className="card-label">NETWORK <span className="tiny-icon"><Activity size={15} /></span></div>
            <div className="summary-value network-value"><span className="status-ring" /> {chainStatusLabel}</div>
            <div className="summary-note">Read-only RPC identity check; no wallet or trades</div>
          </article>
          <article className="summary-card">
            <div className="card-label">TRADE EXECUTION <span className="tiny-icon"><ShieldCheck size={15} /></span></div>
            <div className="summary-value">Disabled</div>
            <div className="summary-note">Awaiting settlement verification</div>
          </article>
        </section>

        <section className="market-layout">
          <div className="panel market-panel">
            <div className="panel-heading">
              <div><h2>Watchlist</h2><p>Reference instruments · sample values</p></div>
              <button className="subtle-button" type="button" disabled title="This preview contains a curated reference watchlist">Reference list <ChevronDown size={14} /></button>
            </div>
            <div className="market-table">
              <div className="table-head"><span>INSTRUMENT</span><span>REFERENCE PRICE</span><span>24H CHANGE*</span></div>
              {visibleMarkets.map((market) => (
                <div className="market-row" key={market.symbol}>
                  <div className="instrument">
                    <span className={`instrument-icon icon-${market.symbol.toLowerCase()}`}>{market.initials}</span>
                    <span><strong>{market.symbol}</strong><small>{market.name}</small><em>{market.category}</em></span>
                  </div>
                  <strong className="market-price">{market.price}</strong>
                  <span className={`market-change ${market.positive ? "positive" : "negative"}`}>{market.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{market.change}</span>
                </div>
              ))}
              {visibleMarkets.length === 0 && <div className="empty-state">No reference instruments match “{searchTerm}”.</div>}
            </div>
            <div className="panel-foot">* Sample values for layout preview only. No external market-data provider is connected.</div>
          </div>

          <div className="panel chart-panel">
            <div className="panel-heading">
              <div><h2>Market overview</h2><p>Illustrative trend · no live feed</p></div>
              <button className="subtle-button" type="button" disabled title="Chart intervals are not connected to historical data yet">Preview <ChevronDown size={14} /></button>
            </div>
            <div className="chart-metric"><strong>Market trend preview</strong><span className="positive"><ArrowUpRight size={15} /> Illustrative</span></div>
            <div className="chart-wrap"><div className="chart-grid"><i /><i /><i /><i /></div><MiniChart /></div>
            <div className="chart-axis"><span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span></div>
            <div className="chart-legend"><span /><span>Illustrative index</span></div>
            <div className="chart-disclaimer">This graphic is a UI fixture, not a real index or a trading signal.</div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel bottom-card" id="portfolio"><div className="bottom-icon"><Wallet size={18} /></div><div><h3>Portfolio</h3><p>Connect a supported wallet after network and balance reads are verified.</p></div><span className="feature-status">PLANNED</span></div>
          <div className="panel bottom-card" id="activity"><div className="bottom-icon"><Activity size={18} /></div><div><h3>On-chain activity</h3><p>Transaction history will be based on verifiable chain evidence.</p></div><span className="feature-status">PLANNED</span></div>
        </section>

        <footer className="footer"><span>PASTX · Portaldot Asset & Stock Trading Exchange</span><span>Early preview · Not financial advice</span></footer>
      </main>
    </div>
  );
}

export default App;
