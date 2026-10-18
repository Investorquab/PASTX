import { useEffect, useMemo, useState } from "react";
import { getApiCapabilities, getChainStatus, getMarketCatalogue, getMarketCandles, getMarketQuote, getMarketSearch, type ChainStatus } from "./api";
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

type MarketItem=MarketInstrument&{category:string;price:string;change:string;positive:boolean;initials:string};

const referenceMarkets:MarketItem[]=[
 {symbol:"AAPL",name:"Apple Inc.",kind:"reference",description:"Listed stock quote data from an external provider; not a Portaldot-issued equity token.",providerSymbol:"AAPL",exchange:"NASDAQ",micCode:"XNAS",country:"United States",instrumentType:"Common Stock",category:"NASDAQ · LISTED STOCK",currency:"USD",price:"—",change:"—",positive:true,initials:"A"},
 {symbol:"NVDA",name:"NVIDIA Corporation",kind:"reference",description:"Listed stock quote data from an external provider; not a Portaldot-issued equity token.",providerSymbol:"NVDA",exchange:"NASDAQ",micCode:"XNAS",country:"United States",instrumentType:"Common Stock",category:"NASDAQ · LISTED STOCK",currency:"USD",price:"—",change:"—",positive:true,initials:"N"},
 {symbol:"TSLA",name:"Tesla, Inc.",kind:"reference",description:"Listed stock quote data from an external provider; not a Portaldot-issued equity token.",providerSymbol:"TSLA",exchange:"NASDAQ",micCode:"XNAS",country:"United States",instrumentType:"Common Stock",category:"NASDAQ · LISTED STOCK",currency:"USD",price:"—",change:"—",positive:true,initials:"T"},
 {symbol:"MSFT",name:"Microsoft Corporation",kind:"reference",description:"Listed stock quote data from an external provider; not a Portaldot-issued equity token.",providerSymbol:"MSFT",exchange:"NASDAQ",micCode:"XNAS",country:"United States",instrumentType:"Common Stock",category:"NASDAQ · LISTED STOCK",currency:"USD",price:"—",change:"—",positive:true,initials:"M"}];

function MiniChart({values}:{values?:number[]}){if(!values||values.length<2||values.some((v)=>!Number.isFinite(v)||v<=0))return <div className="chart-empty-state" role="status">Historical chart data appears here when an approved market-data feed is available.</div>;const min=Math.min(...values),max=Math.max(...values),range=max-min||1;const pts=values.map((v,i)=>(i/(values.length-1))*100+","+(200-((v-min)/range)*160)).join(" ");return <svg className="chart-line" viewBox="0 0 100 220" preserveAspectRatio="none" role="img" aria-label="Historical close prices from the configured market-data provider"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#00865f" stopOpacity=".15"/><stop offset="100%" stopColor="#00865f" stopOpacity="0"/></linearGradient></defs><polygon points={"0,220 "+pts+" 100,220"} fill="url(#chart-fill)"/><polyline points={pts} fill="none" stroke="#00865f" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/></svg>;}

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

function marketKey(i:Pick<MarketInstrument,"symbol"|"exchange"|"micCode">):string{return i.symbol.toUpperCase()+"::"+(i.micCode??i.exchange??"").toUpperCase();}

function formatQuoteChange(quote: MarketQuote | undefined, fixtureChange: string): string {
  if (!quote) return fixtureChange;
  const sign = quote.changePercent > 0 ? "+" : "";
  return sign + quote.changePercent.toFixed(2) + "%";
}

function App() {
  const [activePage, setActivePage] = useState<"overview" | "app">("overview");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const t = textFor(language);
  const [searchTerm,setSearchTerm]=useState("");
  const [remoteSearchResults,setRemoteSearchResults]=useState<MarketItem[]>([]);
  const [marketSearchLoading,setMarketSearchLoading]=useState(false);
  const [marketSearchError,setMarketSearchError]=useState(false);
  const [marketDataEnabled,setMarketDataEnabled]=useState({quotes:false,candles:false});
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [chainStatusError, setChainStatusError] = useState(false);
  const [marketCatalogue, setMarketCatalogue] = useState<MarketItem[]>(referenceMarkets);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, MarketQuote>>({});
  const [liveCandles, setLiveCandles] = useState<MarketCandle[] | null>(null);
  const [orderSymbol,setOrderSymbol]=useState("AAPL");
  const [orderExchange,setOrderExchange]=useState("NASDAQ");
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

  useEffect(()=>{let active=true;Promise.all([getApiCapabilities(),getMarketCatalogue()]).then(([contract,instruments])=>{if(!active)return;const rows=instruments.map((i:MarketInstrument)=>{const seed=referenceMarkets.find((m)=>m.symbol===i.symbol),exchange=i.exchange??seed?.exchange;return {...i,exchange,micCode:i.micCode??seed?.micCode,country:i.country??seed?.country,instrumentType:i.instrumentType??seed?.instrumentType??"Common Stock",category:(exchange??"EQUITY")+" · LISTED STOCK",price:"—",change:"—",positive:true,initials:i.symbol.slice(0,1)};});setMarketCatalogue(rows);const initial=rows.find((m)=>m.symbol==="AAPL");if(initial)setOrderExchange(initial.exchange??"NASDAQ");setMarketDataEnabled({quotes:contract.capabilities.marketQuotes.enabled,candles:contract.capabilities.marketCandles.enabled});}).catch(()=>{/* seed entries remain available when API is not reachable */});return()=>{active=false;};},[]);

  useEffect(()=>{const q=searchTerm.trim();if(!marketMenuOpen||q.length<2){setRemoteSearchResults([]);setMarketSearchLoading(false);setMarketSearchError(false);return;}let active=true;const timer=window.setTimeout(()=>{setMarketSearchLoading(true);setMarketSearchError(false);getMarketSearch(q,15).then((items)=>{if(active)setRemoteSearchResults(items.map((i)=>({...i,category:(i.exchange??"EQUITY")+" · "+(i.instrumentType??"LISTED STOCK").toUpperCase(),price:"—",change:"—",positive:true,initials:i.symbol.slice(0,1)})));}).catch(()=>{if(active){setRemoteSearchResults([]);setMarketSearchError(true);}}).finally(()=>{if(active)setMarketSearchLoading(false);});},300);return()=>{active=false;window.clearTimeout(timer);};},[searchTerm,marketMenuOpen]);

  const selectedOrderInstrument=marketCatalogue.find((m)=>m.symbol===orderSymbol&&(m.exchange??"")===orderExchange)??marketCatalogue.find((m)=>m.symbol===orderSymbol)??marketCatalogue[0]??referenceMarkets[0];
  useEffect(()=>{if(!marketDataEnabled.quotes)return;let active=true;const refresh=async()=>{try{const q=await getMarketQuote(selectedOrderInstrument);if(active)setLiveQuotes((current)=>({...current,[marketKey(selectedOrderInstrument)]:q}));}catch{/* no invented fallback; retain any last successful quote */}};void refresh();const timer=window.setInterval(()=>{void refresh();},60_000);return()=>{active=false;window.clearInterval(timer);};},[marketDataEnabled.quotes,selectedOrderInstrument]);
  useEffect(()=>{if(!marketDataEnabled.candles){setLiveCandles(null);return;}let active=true;setLiveCandles(null);getMarketCandles(selectedOrderInstrument,"1day",30).then((rows)=>{if(active)setLiveCandles(rows);}).catch(()=>{if(active)setLiveCandles(null);});return()=>{active=false;};},[marketDataEnabled.candles,selectedOrderInstrument]);
  const selectedOrderQuote=liveQuotes[marketKey(selectedOrderInstrument)];
  const hasLiveQuotes=Boolean(selectedOrderQuote),hasLiveCandles=Boolean(liveCandles&&liveCandles.length>1),hasAnyLiveData=hasLiveQuotes||hasLiveCandles;
  const orderUnitPrice = selectedOrderQuote?.price ?? Number(selectedOrderInstrument.price.replace(/[$,]/g, ""));
  const orderNotional = calculateReferenceNotional(orderQuantity, orderUnitPrice);
  const orderCurrency = selectedOrderQuote?.currency ?? selectedOrderInstrument.currency;
  const selectedChange = selectedOrderQuote?.changePercent;
  const selectedChangeText = selectedOrderQuote ? formatQuoteChange(selectedOrderQuote, selectedOrderInstrument.change) : selectedOrderInstrument.change;
  const chartAxisLabels = hasLiveCandles && liveCandles
    ? [0, Math.floor((liveCandles.length - 1) / 3), Math.floor(((liveCandles.length - 1) * 2) / 3), liveCandles.length - 1].map((index) => formatAxisDate(liveCandles[index].timestamp))
    : [];

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

  const visibleMarkets=useMemo(()=>{const q=searchTerm.trim().toLowerCase();if(q.length>=2)return remoteSearchResults;if(!q)return marketCatalogue;return marketCatalogue.filter((m)=>[m.symbol,m.name,m.category,m.exchange??"",m.country??""].some((v)=>v.toLowerCase().includes(q)));},[marketCatalogue,remoteSearchResults,searchTerm]);
  function selectMarket(m:MarketItem){const key=marketKey(m);setMarketCatalogue((current)=>current.some((i)=>marketKey(i)===key)?current:[...current,m].slice(-80));setOrderSymbol(m.symbol);setOrderExchange(m.exchange??"");setLiveCandles(null);setMarketMenuOpen(false);setSearchTerm("");setRemoteSearchResults([]);}

  if (activePage === "overview") {
    return <OverviewPage language={language} onLanguageChange={setLanguage} text={t} markets={marketCatalogue}
      chainStatusLabel={chainStatusLabel} chainStatusDetail={chainStatusDetail} networkTone={networkTone}
      notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen}
      onOpenApp={(symbol)=>{if(symbol){const m=marketCatalogue.find((i)=>i.symbol===symbol);setOrderSymbol(symbol);setOrderExchange(m?.exchange??"");}setActivePage("app");setMarketMenuOpen(false);}} />;
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
            <AssetLogo symbol={selectedOrderInstrument.symbol} name={selectedOrderInstrument.name} initials={selectedOrderInstrument.initials} exchange={selectedOrderInstrument.exchange} micCode={selectedOrderInstrument.micCode} country={selectedOrderInstrument.country} currency={selectedOrderInstrument.currency} className={"asset-mark mark-" + selectedOrderInstrument.symbol.toLowerCase()} />
            <div className="asset-title-wrap">
              <div className="asset-title-line">
                <h1>{selectedOrderInstrument.symbol}</h1>
                <button className="asset-picker-toggle" type="button" aria-expanded={marketMenuOpen} onClick={() => setMarketMenuOpen((open) => { if (open) setSearchTerm(""); return !open; })} aria-label="Choose market"><ChevronDown size={17} /></button>
              </div>
              <p>{selectedOrderInstrument.name} <span>·</span> Listed stock data</p>
              {marketMenuOpen && (
                <div className="market-picker">
                  <label className="market-search"><Search size={15}/><input autoFocus aria-label="Search listed stocks" placeholder="Search stocks by ticker or company" value={searchTerm} onChange={(event)=>setSearchTerm(event.target.value)}/><kbd>DIRECTORY</kbd></label>
                  <div className="market-picker-list">
                    {marketSearchLoading&&<div className="picker-empty">Searching stock directory…</div>}
                    {marketSearchError&&<div className="picker-empty">Stock search unavailable. Check provider configuration and retry.</div>}
                    {visibleMarkets.map((market)=><button className={"market-option "+(marketKey(market)===marketKey(selectedOrderInstrument)?"selected":"")} type="button" key={marketKey(market)} onClick={()=>selectMarket(market)}>
                      <AssetLogo symbol={market.symbol} name={market.name} initials={market.initials} exchange={market.exchange} micCode={market.micCode} country={market.country} currency={market.currency} className={"option-mark mark-"+market.symbol.toLowerCase()}/>
                      <span className="option-label"><strong>{market.symbol} <small>{market.exchange??""}</small></strong><small>{market.name}{market.country?" · "+market.country:""}</small></span>
                      {marketKey(market)===marketKey(selectedOrderInstrument)?<Check size={15}/>:<span className="option-price">{formatQuotePrice(liveQuotes[marketKey(market)],market.price)}</span>}
                    </button>)}
                    {!marketSearchLoading&&!marketSearchError&&visibleMarkets.length===0&&<div className="picker-empty">{searchTerm.trim().length>=2?"No matching listed stocks found.":"Type at least two characters to search stock directory."}</div>}
                  </div>
                  <div className="picker-foot">External stock directory · on-chain token availability checked separately</div>
                </div>
              )}
            </div>
          </div>

          <div className="asset-market-stats">
            <div className="chain-caption"><span className="small-status-dot" /> PORTALDOT · RPC STATUS</div>
            <div className="market-stats-row">
              <div className="market-stat"><span>LATEST QUOTE</span><strong>{formatQuotePrice(selectedOrderQuote,selectedOrderInstrument.price)}</strong><small>{selectedOrderQuote?"Twelve Data · "+formatTimestamp(selectedOrderQuote.observedAt)+" · delay status unknown":"No provider quote loaded"}</small></div>
              <div className="market-stat change-stat"><span>PROVIDER CHANGE</span><strong className={(selectedChange??0)>=0?"positive":"negative"}>{selectedOrderQuote?selectedChangeText:"—"}</strong><small>From latest provider response</small></div>
            </div>
          </div>
        </section>

        <div className="preview-notice" role="note">
          <ShieldCheck size={16} />
          <p><strong>{hasAnyLiveData?"Provider data available":"Market data not connected"}</strong><span>{hasAnyLiveData?"Timestamp is from provider response. Feed delay is not confirmed here. On-chain order execution is not implemented.":"No numeric price is fabricated when provider data is unavailable. Stock discovery is separate from quote access; on-chain order execution is not implemented."}</span></p>
        </div>

        <section className="trade-workspace" aria-label="Market chart and order preview">
          <div className="chart-panel surface">
            <div className="panel-topline">
              <div className="panel-tab"><ChartCandlestick size={16} /><strong>Chart</strong><span>MARKET / PORTALDOT</span></div>
              <span className={"data-badge " + (hasLiveCandles ? "data-badge-live" : "")}>{hasLiveCandles ? "PROVIDER DATA" : "SAMPLE PREVIEW"}</span>
            </div>
            <div className="chart-period-row"><span className="period-chip active">1D</span><span className="period-chip">1W</span><span className="period-chip">1M</span><span className="period-note">Historical feed when enabled</span></div>
            <div className="chart-summary"><div><span className="chart-symbol">{hasLiveCandles?selectedOrderInstrument.symbol+" · HISTORICAL CLOSE":selectedOrderInstrument.symbol+" · CHART DATA UNAVAILABLE"}</span><strong>{hasLiveCandles?"Historical market data":"No chart data yet"}</strong></div><span className="chart-return"><span className="chart-dot"/>{hasLiveCandles?"Twelve Data":"Awaiting feed"}</span></div>
            <div className="chart-stage">
              <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
              {hasLiveCandles&&<div className="chart-y-axis"><span>{liveCandles?.[liveCandles.length-1]?.high.toFixed(2)}</span><span>{liveCandles?.[Math.floor((liveCandles.length-1)/2)]?.close.toFixed(2)}</span><span>{liveCandles?.[0]?.low.toFixed(2)}</span></div>}
              <MiniChart values={hasLiveCandles ? liveCandles?.map((candle) => candle.close) : undefined} />
            </div>
            <div className="chart-x-axis">{chartAxisLabels.map((label, index) => <span key={label + "-" + index}>{label}</span>)}</div>
            <div className="chart-footer"><span>{hasLiveCandles?selectedOrderInstrument.symbol+" · 1 DAY":"NO HISTORICAL SERIES"}</span><span>{hasLiveCandles?"SOURCE: TWELVE DATA":"NO CHART FIXTURES DISPLAYED"}</span></div>
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
            <div className="available-row"><span>Available</span><strong>Wallet balance not implemented</strong></div>
            <div className="receive-row"><span>Estimated value at latest quote</span><strong>{selectedOrderQuote&&orderNotional!==null&&Number.isFinite(orderNotional)?new Intl.NumberFormat("en-US",{style:"currency",currency:orderCurrency,maximumFractionDigits:2}).format(orderNotional):"—"}</strong></div>
            <p className="trade-hint">This is a quote-based estimate only. PASTX does not submit stock orders or settle trades yet.</p>
            <div className="trade-actions"><button className="cancel-button" type="button" onClick={() => { setOrderQuantity("1"); setOrderSide("buy"); }}>Reset</button><button className="submit-button" type="button" disabled title="Order submission is not implemented">{orderSide === "buy" ? "Buy" : "Sell"} · Preview</button></div>
            <div className="trade-card-links"><a href="#asset-details">Asset details <ExternalLink size={12} /></a><a href="https://github.com/Investorquab/PASTX#readme" target="_blank" rel="noreferrer">Documentation <ExternalLink size={12} /></a></div>
          </aside>
        </section>

        <section className="asset-details surface" id="asset-details" aria-label="Asset and network details">
          <div className="details-topline"><span>PASTX / LISTED STOCK DATA</span><span>NETWORK CHECK: {chainStatusLabel.toUpperCase()}</span></div>
          <div className="details-grid">
            <div className="detail-item"><span>Latest provider quote</span><strong>{formatQuotePrice(selectedOrderQuote,selectedOrderInstrument.price)}</strong><small>{selectedOrderQuote?"Observed "+formatTimestamp(selectedOrderQuote.observedAt)+"; feed delay unknown":"No provider quote loaded"}</small></div>
            <div className="detail-item"><span>Asset classification</span><strong>Listed stock · external market</strong><small>On-chain token and settlement remain unverified</small></div>
            <div className="detail-item network-detail"><span><Activity size={13} /> Network status</span><strong>{chainStatusLabel}</strong><small>{chainStatusDetail}</small></div>
          </div>
          <p className="details-disclaimer">External stock quotes do not prove token ownership or provide an executable order. Feed-delay status depends on provider entitlements and is not yet verified.</p>
        </section>

        <section className="watchlist-section" aria-label="Listed stock watchlist">
          <div className="watchlist-heading"><div><span className="section-kicker">STOCK DIRECTORY</span><h2>Featured and selected stocks</h2></div><span>{visibleMarkets.length} visible</span></div>
          <div className="watchlist-rows">
            {visibleMarkets.map((market) => (
              <button key={marketKey(market)} className={"watchlist-row "+(marketKey(market)===marketKey(selectedOrderInstrument)?"chosen":"")} type="button" onClick={()=>selectMarket(market)}>
                <AssetLogo symbol={market.symbol} name={market.name} initials={market.initials} exchange={market.exchange} micCode={market.micCode} country={market.country} currency={market.currency} className={"option-mark mark-"+market.symbol.toLowerCase()}/>
                <span className="watchlist-name"><strong>{market.symbol}</strong><small>{market.name}</small><em>{market.category}</em></span>
                <span className="watchlist-price"><strong>{formatQuotePrice(liveQuotes[marketKey(market)],market.price)}</strong><small>{liveQuotes[marketKey(market)]?"Twelve Data · "+formatTimestamp(liveQuotes[marketKey(market)].observedAt):"Awaiting quote"}</small></span>
                <span className={"watchlist-change "+((liveQuotes[marketKey(market)]?.changePercent??0)>=0?"positive":"negative")}>{liveQuotes[marketKey(market)]?(liveQuotes[marketKey(market)].changePercent>=0?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>):null}{formatQuoteChange(liveQuotes[marketKey(market)],market.change)}</span>
              </button>
            ))}
          </div>
          <p className="watchlist-disclaimer">Search by ticker or company name in the asset picker to discover more listed stocks. Market data and on-chain order execution are separate capabilities.</p>
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
