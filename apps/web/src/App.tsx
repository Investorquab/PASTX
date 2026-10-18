import { useEffect, useMemo, useState } from "react";
import { getApiCapabilities, getChainStatus, getMarketCatalogue, getMarketCandles, getMarketQuote, type ChainStatus } from "./api";
import type { MarketCandle, MarketInstrument, MarketQuote } from "@pastx/shared";
import { calculateReferenceNotional } from "./orderPreview";
import { AssetLogo } from "./AssetLogo";
import { OverviewPage } from "./OverviewPage";
import { textFor, type LanguageCode } from "./i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChartCandlestick,
  Check,
  ChevronDown,
  Compass,
  ExternalLink,
  Layers3,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

type MarketItem = {
  symbol: string;
  name: string;
  category: string;
  currency: string;
  price: string;
  change: string;
  positive: boolean;
  initials: string;
};

const referenceMarkets: MarketItem[] = [
  { symbol: "AAPL", name: "Apple Inc.", category: "US EQUITY · REFERENCE", currency: "USD", price: "$247.96", change: "+1.24%", positive: true, initials: "A" },
  { symbol: "NVDA", name: "NVIDIA Corporation", category: "US EQUITY · REFERENCE", currency: "USD", price: "$181.42", change: "+2.86%", positive: true, initials: "N" },
  { symbol: "TSLA", name: "Tesla, Inc.", category: "US EQUITY · REFERENCE", currency: "USD", price: "$438.07", change: "−0.72%", positive: false, initials: "T" },
  { symbol: "MSFT", name: "Microsoft Corporation", category: "US EQUITY · REFERENCE", currency: "USD", price: "$514.21", change: "+0.38%", positive: true, initials: "M" },
];

const candles = [34, 42, 37, 51, 47, 43, 59, 55, 65, 60, 73, 67, 77, 70, 84, 79, 90, 82, 96, 88, 103, 95, 108, 101, 116, 110, 122, 113, 128, 121, 136, 130, 143, 135, 151, 145, 158, 149, 166, 158, 174, 166, 183, 175, 191, 182, 199, 191, 208, 200, 217, 210];

function MiniChart({ values }: { values?: number[] }) {
  const series = values && values.length > 1 ? values : candles;
  const minimum = Math.min(...series);
  const maximum = Math.max(...series);
  const range = maximum - minimum || 1;
  const points = series.map((value, index) => (index / (series.length - 1)) * 100 + "," + (200 - ((value - minimum) / range) * 160)).join(" ");
  return (
    <svg className="chart-line" viewBox="0 0 100 220" preserveAspectRatio="none" role="img" aria-label={values && values.length > 1 ? "Historical AAPL closing prices from Twelve Data" : "Illustrative market chart, not live price data"}>
      <defs>
        <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#00865f" stopOpacity=".15" />
          <stop offset="100%" stopColor="#00865f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={"0,220 " + points + " 100,220"} fill="url(#chart-fill)" />
      <polyline points={points} fill="none" stroke="#00865f" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function formatQuotePrice(quote: MarketQuote | undefined, fixturePrice: string): string {
  if (!quote) return fixturePrice;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: quote.currency,
    maximumFractionDigits: 2
  }).format(quote.price);
}

function formatAxisDate(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(5, 10);
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function formatQuoteChange(quote: MarketQuote | undefined, fixtureChange: string): string {
  if (!quote) return fixtureChange;
  const sign = quote.changePercent > 0 ? "+" : "";
  return sign + quote.changePercent.toFixed(2) + "%";
}

function App() {
  const [activePage, setActivePage] = useState<"overview" | "app">("overview");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const t = textFor(language);
  const [searchTerm, setSearchTerm] = useState("");
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [chainStatusError, setChainStatusError] = useState(false);
  const [marketCatalogue, setMarketCatalogue] = useState<MarketItem[]>(referenceMarkets);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, MarketQuote>>({});
  const [liveCandles, setLiveCandles] = useState<MarketCandle[] | null>(null);
  const [orderSymbol, setOrderSymbol] = useState("AAPL");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [marketMenuOpen, setMarketMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  useEffect(() => {
    let active = true;
    Promise.all([getApiCapabilities(), getMarketCatalogue()])
      .then(async ([contract, instruments]) => {
        if (!active) return;
        const displayItems = instruments.map((instrument: MarketInstrument) => {
          const fixture = referenceMarkets.find((market) => market.symbol === instrument.symbol);
          return {
            symbol: instrument.symbol,
            name: instrument.name,
            category: instrument.kind.toUpperCase() + " · " + (instrument.kind === "reference" ? "REFERENCE" : instrument.kind === "simulated" ? "SIMULATED" : "ON-CHAIN"),
            currency: instrument.currency,
            price: fixture?.price ?? "—",
            change: fixture?.change ?? "—",
            positive: fixture?.positive ?? true,
            initials: instrument.symbol.slice(0, 1)
          };
        });
        setMarketCatalogue(displayItems);
        const quotePromise = contract.capabilities.marketQuotes.enabled
          ? Promise.allSettled(displayItems.map((market) => getMarketQuote(market.symbol)))
          : Promise.resolve([]);
        const candlePromise = contract.capabilities.marketCandles.enabled
          ? getMarketCandles("AAPL", "1day", 30).then(
              (items) => ({ ok: true as const, items }),
              () => ({ ok: false as const, items: [] as MarketCandle[] })
            )
          : Promise.resolve({ ok: false as const, items: [] as MarketCandle[] });
        const [quoteResults, candleResult] = await Promise.all([quotePromise, candlePromise]);
        if (!active) return;
        const quotes = quoteResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        setLiveQuotes(Object.fromEntries(quotes.map((quote) => [quote.symbol, quote])));
        setLiveCandles(candleResult.ok ? candleResult.items : null);
      })
      .catch(() => {
        // Keep clearly labelled preview fixtures if the API or provider is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  const hasLiveQuotes = Object.keys(liveQuotes).length > 0;
  const hasLiveCandles = Boolean(orderSymbol === "AAPL" && liveCandles && liveCandles.length > 1);
  const hasAnyLiveData = hasLiveQuotes || hasLiveCandles;
  const selectedOrderInstrument = marketCatalogue.find((market) => market.symbol === orderSymbol) ?? marketCatalogue[0] ?? referenceMarkets[0];
  const selectedOrderQuote = liveQuotes[orderSymbol];
  const orderUnitPrice = selectedOrderQuote?.price ?? Number(selectedOrderInstrument.price.replace(/[$,]/g, ""));
  const orderNotional = calculateReferenceNotional(orderQuantity, orderUnitPrice);
  const orderCurrency = selectedOrderQuote?.currency ?? selectedOrderInstrument.currency;
  const selectedChange = selectedOrderQuote?.changePercent;
  const selectedChangeText = selectedOrderQuote ? formatQuoteChange(selectedOrderQuote, selectedOrderInstrument.change) : selectedOrderInstrument.change;
  const chartAxisLabels = hasLiveCandles && liveCandles
    ? [0, Math.floor((liveCandles.length - 1) / 3), Math.floor(((liveCandles.length - 1) * 2) / 3), liveCandles.length - 1].map((index) => formatAxisDate(liveCandles[index].timestamp))
    : ["Oct 16", "Oct 16", "Oct 17", "Oct 18"];

  const chainStatusLabel = chainStatus
    ? ({
        not_configured: "RPC not configured",
        unreachable: "RPC unreachable",
        wrong_network: "Wrong network",
        verified: "Chain + block verified"
      } as const)[chainStatus.status]
    : chainStatusError
      ? "API unavailable"
      : "Checking RPC…";
  const chainStatusDetail = chainStatus?.status === "verified"
    ? "Read-only chain and latest-block check (block " + chainStatus.blockNumber + "); settlement unverified"
    : chainStatus?.status === "wrong_network"
      ? "Expected chain ID " + chainStatus.expectedChainId + "; received " + chainStatus.chainId
      : chainStatus?.status === "unreachable"
        ? "Configured RPC did not respond"
        : chainStatus?.status === "not_configured"
          ? "Expected EVM chain ID " + chainStatus.expectedChainId
          : "Network integration not verified";
  const networkTone = chainStatus?.status === "verified" ? "online" : chainStatusError || chainStatus?.status === "unreachable" || chainStatus?.status === "wrong_network" ? "warning" : "pending";

  const visibleMarkets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return marketCatalogue;
    return marketCatalogue.filter((market) =>
      [market.symbol, market.name, market.category].some((field) => field.toLowerCase().includes(query))
    );
  }, [marketCatalogue, searchTerm]);

  function selectMarket(symbol: string) {
    setOrderSymbol(symbol);
    setMarketMenuOpen(false);
    setSearchTerm("");
  }

  if (activePage === "overview") {
    return <OverviewPage language={language} onLanguageChange={setLanguage} text={t} markets={marketCatalogue}
      chainStatusLabel={chainStatusLabel} chainStatusDetail={chainStatusDetail} networkTone={networkTone}
      notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen}
      onOpenApp={(symbol) => { if (symbol) setOrderSymbol(symbol); setActivePage("app"); setMarketMenuOpen(false); }} />;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#markets" aria-label="PASTX home">
          <span className="brand-mark"><ChartCandlestick size={21} strokeWidth={2.2} /></span>
          <span className="brand-word">PAST<span>X</span><small>ASSET EXCHANGE</small></span>
        </a>

        <nav className="top-nav" aria-label="Main navigation">
          <button className="top-nav-item" type="button" onClick={() => setActivePage("overview")}><Compass size={15} /> {t.overview}</button><button className="top-nav-item active" type="button" onClick={() => setActivePage("app")}><ChartCandlestick size={15} /> {t.trade}</button>
          <a className="top-nav-item" href="#portfolio"><Layers3 size={15} /> {t.portfolio}</a>
          <a className="top-nav-item" href="#activity"><Activity size={15} /> {t.activity}</a>
        </nav>

        <div className="header-actions">
          <div className="network-status" title={chainStatusDetail} aria-label={"Network status: " + chainStatusLabel}>
            <span className={"network-dot " + networkTone} />
            <span className="network-label">Network</span>
            <strong>{chainStatusLabel}</strong>
          </div>
          <div className="notification-wrap">
            <LanguageSwitcher language={language} onChange={setLanguage} text={t} /><button className="icon-button" type="button" aria-label={t.notifications} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)} title={t.notifications}>
              <Bell size={17} />
            </button>
            {notificationsOpen && (
              <div className="notification-popover" role="status">
                <div className="popover-heading"><strong>{t.notifications}</strong><button type="button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}><X size={14} /></button></div>
                <p>{t.notificationsEmpty}</p>
                <span>{t.notificationsDisabled}</span>
              </div>
            )}
          </div>
          <button className="wallet-button" type="button" disabled title="Wallet connection is not implemented yet"><Wallet size={15} /> {t.walletPending}</button>
        </div>
      </header>

      <main className="page-container">
        <div className="page-meta">
          <span>PASTX <span className="meta-slash">/</span> TRADE</span>
          <span className="meta-right">PORTALDOT V3 <span className="meta-slash">/</span> READ-ONLY PREVIEW</span>
        </div>

        <section className="asset-heading" id="markets">
          <div className="asset-identity">
            <AssetLogo symbol={selectedOrderInstrument.symbol} name={selectedOrderInstrument.name} initials={selectedOrderInstrument.initials} className={"asset-mark mark-" + selectedOrderInstrument.symbol.toLowerCase()} />
            <div className="asset-title-wrap">
              <div className="asset-title-line">
                <h1>{selectedOrderInstrument.symbol}</h1>
                <button className="asset-picker-toggle" type="button" aria-expanded={marketMenuOpen} onClick={() => setMarketMenuOpen((open) => !open)} aria-label="Choose market"><ChevronDown size={17} /></button>
              </div>
              <p>{selectedOrderInstrument.name} <span>·</span> External reference</p>
              {marketMenuOpen && (
                <div className="market-picker">
                  <label className="market-search"><Search size={15} /><input autoFocus aria-label="Search assets" placeholder="Search name or ticker" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /><kbd>FILTER</kbd></label>
                  <div className="market-picker-list">
                    {visibleMarkets.map((market) => (
                      <button className={"market-option " + (market.symbol === orderSymbol ? "selected" : "")} type="button" key={market.symbol} onClick={() => selectMarket(market.symbol)}>
                        <AssetLogo symbol={market.symbol} name={market.name} initials={market.initials} className={"option-mark mark-" + market.symbol.toLowerCase()} />
                        <span className="option-label"><strong>{market.symbol}</strong><small>{market.name}</small></span>
                        {market.symbol === orderSymbol ? <Check size={15} /> : <span className="option-price">{formatQuotePrice(liveQuotes[market.symbol], market.price)}</span>}
                      </button>
                    ))}
                    {visibleMarkets.length === 0 && <div className="picker-empty">No assets match “{searchTerm}”.</div>}
                  </div>
                  <div className="picker-foot">Reference instruments only · No tokenized stock is verified</div>
                </div>
              )}
            </div>
          </div>

          <div className="asset-market-stats">
            <div className="chain-caption"><span className="small-status-dot" /> PORTALDOT · RPC STATUS</div>
            <div className="market-stats-row">
              <div className="market-stat"><span>REFERENCE PRICE</span><strong>{formatQuotePrice(selectedOrderQuote, selectedOrderInstrument.price)}</strong><small>{selectedOrderQuote ? "Twelve Data · " + formatTimestamp(selectedOrderQuote.observedAt) : "Illustrative sample value"}</small></div>
              <div className="market-stat change-stat"><span>CHANGE</span><strong className={(selectedChange ?? (selectedOrderInstrument.positive ? 1 : -1)) >= 0 ? "positive" : "negative"}>{selectedChangeText}</strong><small>Reference only</small></div>
            </div>
          </div>
        </section>

        <div className="preview-notice" role="note">
          <ShieldCheck size={16} />
          <p><strong>{hasAnyLiveData ? "External provider data · partial availability" : "Preview environment"}</strong><span>{hasAnyLiveData ? "Only individually timestamped successful quotes are live. Other values remain labelled samples. No wallet transactions or trades are enabled." : "Prices and chart are illustrative fixtures, not live quotes. No wallet transactions or trades are enabled."}</span></p>
        </div>

        <section className="trade-workspace" aria-label="Market chart and order preview">
          <div className="chart-panel surface">
            <div className="panel-topline">
              <div className="panel-tab"><ChartCandlestick size={16} /><strong>Chart</strong><span>MARKET / PORTALDOT</span></div>
              <span className={"data-badge " + (hasLiveCandles ? "data-badge-live" : "")}>{hasLiveCandles ? "PROVIDER DATA" : "SAMPLE PREVIEW"}</span>
            </div>
            <div className="chart-period-row"><span className="period-chip active">1D</span><span className="period-chip">1W</span><span className="period-chip">1M</span><span className="period-note">Historical feed when enabled</span></div>
            <div className="chart-summary">
              <div><span className="chart-symbol">{hasLiveCandles ? "AAPL · HISTORICAL CLOSE" : selectedOrderInstrument.symbol + " · REFERENCE PREVIEW"}</span><strong>{hasLiveCandles ? "Historical reference" : "Illustrative trend"}</strong></div>
              <span className="chart-return"><span className="chart-dot" />{hasLiveCandles ? "Twelve Data" : "Not live"}</span>
            </div>
            <div className="chart-stage">
              <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
              <div className="chart-y-axis"><span>$400.00</span><span>$300.00</span><span>$200.00</span><span>$100.00</span><span>$0.00</span></div>
              <MiniChart values={hasLiveCandles ? liveCandles?.map((candle) => candle.close) : undefined} />
            </div>
            <div className="chart-x-axis">{chartAxisLabels.map((label, index) => <span key={label + "-" + index}>{label}</span>)}</div>
            <div className="chart-footer"><span>{hasLiveCandles ? "AAPL · 1 DAY" : "ILLUSTRATIVE SERIES"}</span><span>{hasLiveCandles ? "SOURCE: TWELVE DATA" : "NO LIVE PRICE FEED"}</span></div>
          </div>

          <aside className="trade-card surface" aria-labelledby="trade-title">
            <div className="trade-card-heading"><h2 id="trade-title">{t.trade}</h2><span>{selectedOrderInstrument.symbol}</span></div>
            <div className="side-switch" role="group" aria-label="Order side">
              <button className={orderSide === "buy" ? "active buy-active" : ""} type="button" onClick={() => setOrderSide("buy")}>{t.buy}</button>
              <button className={orderSide === "sell" ? "active sell-active" : ""} type="button" onClick={() => setOrderSide("sell")}>{t.sell}</button>
            </div>
            <div className="order-type-row"><span>Order type</span><strong>Market</strong></div>
            <label className="amount-label" htmlFor="order-quantity">{t.quantity.toUpperCase()}</label>
            <div className="amount-input-wrap"><input id="order-quantity" type="number" min="0.0001" max="1000000" step="0.0001" value={orderQuantity} onChange={(event) => setOrderQuantity(event.target.value)} /><span>{orderCurrency}</span></div>
            <div className="available-row"><span>Available</span><strong>Log in to see your balance</strong></div>
            <div className="receive-row"><span>Estimated reference value</span><strong>{orderNotional !== null && Number.isFinite(orderNotional) ? new Intl.NumberFormat("en-US", { style: "currency", currency: orderCurrency, maximumFractionDigits: 2 }).format(orderNotional) : "—"}</strong></div>
            <p className="trade-hint">Enter an amount to preview the reference value. No order is submitted.</p>
            <div className="trade-actions"><button className="cancel-button" type="button" onClick={() => { setOrderQuantity("1"); setOrderSide("buy"); }}>Reset</button><button className="submit-button" type="button" disabled title="Order submission is not implemented">{orderSide === "buy" ? "Buy" : "Sell"} · Preview</button></div>
            <div className="trade-card-links"><a href="#asset-details">Asset details <ExternalLink size={12} /></a><a href="https://github.com/Investorquab/PASTX#readme" target="_blank" rel="noreferrer">Documentation <ExternalLink size={12} /></a></div>
          </aside>
        </section>

        <section className="asset-details surface" id="asset-details" aria-label="Asset and network details">
          <div className="details-topline"><span>PASTX / REFERENCE DATA</span><span>NETWORK CHECK: {chainStatusLabel.toUpperCase()}</span></div>
          <div className="details-grid">
            <div className="detail-item"><span>Reference price</span><strong>{formatQuotePrice(selectedOrderQuote, selectedOrderInstrument.price)}</strong><small>{selectedOrderQuote ? "Twelve Data · observed " + formatTimestamp(selectedOrderQuote.observedAt) : "Sample only · not an execution quote"}</small></div>
            <div className="detail-item"><span>Asset classification</span><strong>External stock reference</strong><small>Not verified as tokenized equity on Portaldot</small></div>
            <div className="detail-item network-detail"><span><Activity size={13} /> Network status</span><strong>{chainStatusLabel}</strong><small>{chainStatusDetail}</small></div>
          </div>
          <p className="details-disclaimer">External reference prices do not establish token ownership, backing, exchange listing or an executable trading price.</p>
        </section>

        <section className="watchlist-section" aria-label="Reference market watchlist">
          <div className="watchlist-heading"><div><span className="section-kicker">MARKET DISCOVERY</span><h2>Reference markets</h2></div><span>{marketCatalogue.length} instruments</span></div>
          <div className="watchlist-rows">
            {visibleMarkets.map((market) => (
              <button key={market.symbol} className={"watchlist-row " + (market.symbol === orderSymbol ? "chosen" : "")} type="button" onClick={() => selectMarket(market.symbol)}>
                <AssetLogo symbol={market.symbol} name={market.name} initials={market.initials} className={"option-mark mark-" + market.symbol.toLowerCase()} />
                <span className="watchlist-name"><strong>{market.symbol}</strong><small>{market.name}</small><em>{market.category}</em></span>
                <span className="watchlist-price"><strong>{formatQuotePrice(liveQuotes[market.symbol], market.price)}</strong><small>{liveQuotes[market.symbol] ? "Twelve Data" : "Sample value"}</small></span>
                <span className={"watchlist-change " + ((liveQuotes[market.symbol]?.changePercent ?? (market.positive ? 1 : -1)) >= 0 ? "positive" : "negative")}>{(liveQuotes[market.symbol]?.changePercent ?? (market.positive ? 1 : -1)) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{formatQuoteChange(liveQuotes[market.symbol], market.change)}</span>
              </button>
            ))}
          </div>
          <p className="watchlist-disclaimer">These are reference instruments, not verified on-chain equities. Selecting a row updates the preview ticket only.</p>
        </section>

        <section className="below-grid">
          <div className="below-card" id="portfolio"><span className="below-icon"><Wallet size={17} /></span><div><strong>Portfolio</strong><p>Wallet connection and verified balance reads are not available yet.</p></div><span className="feature-tag">PLANNED</span></div>
          <div className="below-card" id="activity"><span className="below-icon"><Activity size={17} /></span><div><strong>On-chain activity</strong><p>Transaction history will be added after a verified transaction flow exists.</p></div><span className="feature-tag">PLANNED</span></div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-brand" href="#markets"><span className="brand-mark"><ChartCandlestick size={19} /></span><span>PAST<span>X</span><small>ASSET EXCHANGE</small></span></a>
        <span className="footer-tagline">Markets for the Portaldot ecosystem.</span>
        <div className="footer-links"><a href="https://github.com/Investorquab/PASTX#readme" target="_blank" rel="noreferrer">Documentation <ExternalLink size={12} /></a><a href="https://github.com/Investorquab/PASTX" target="_blank" rel="noreferrer">GitHub <ExternalLink size={12} /></a></div>
        <span className="footer-copy">© 2026 PASTX · EARLY PREVIEW</span>
      </footer>
    </div>
  );
}

export default App;
