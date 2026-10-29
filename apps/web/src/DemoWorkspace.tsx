import { useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, Bell, CheckCircle2, CircleDot, ExternalLink, GitCompareArrows, Layers3, LayoutDashboard, ShieldCheck, Wallet, X } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getStoredLanguage, saveStoredLanguage, textFor, type LanguageCode } from "./i18n";
import { workspaceTextFor } from "./productI18n";
import { NativeDemoWorkspace } from "./NativeDemoWorkspace";

type RouteNetwork = "portal" | "ethereum" | "bnb" | "polygon";
type RouteAsset = "pUSD" | "native" | "USDT" | "USDC" | "ETH" | "BNB" | "POL";

export function DemoWorkspace() {
  const [tab, setTab] = useState<"markets" | "ibridge" | "activity" | "portfolio">("markets");
  const [walletConnected, setWalletConnected] = useState(false);
  const [faucetAlreadyClaimed, setFaucetAlreadyClaimed] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>(() => getStoredLanguage());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [from] = useState<RouteNetwork>("portal");
  const [to] = useState<RouteNetwork>("bnb");
  const [fromAsset, setFromAsset] = useState<RouteAsset>("native");
  const [amount, setAmount] = useState("100");
  const [previewing, setPreviewing] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [simulationToast, setSimulationToast] = useState(false);
  const t = textFor(language);
  const c = workspaceTextFor(language);
  const routeOptions = routeAssetOptionsFor(c);

  useEffect(() => { saveStoredLanguage(language); }, [language]);

  useEffect(() => {
    const handleWalletConnected = () => { setWalletConnected(true); setFaucetAlreadyClaimed(Object.keys(window.localStorage).some((key) => key.startsWith("pastx:faucet-claimed:") && window.localStorage.getItem(key) === "1")); };
    const handleFaucetClaimed = () => setFaucetAlreadyClaimed(true);
    window.addEventListener("pastx:native-wallet-connected", handleWalletConnected);
    window.addEventListener("pastx:native-faucet-claimed", handleFaucetClaimed);
    return () => { window.removeEventListener("pastx:native-wallet-connected", handleWalletConnected); window.removeEventListener("pastx:native-faucet-claimed", handleFaucetClaimed); };
  }, []);

  const previewRoute = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage(c.positiveRouteAmount);
      return;
    }
    setMessage("");
    setSimulationToast(false);
    setPreviewing(true);
    setSimulated(false);
    window.setTimeout(() => {
      setPreviewing(false);
      setSimulated(true);
      setSimulationToast(true);
      window.setTimeout(() => setSimulationToast(false), 4200);
    }, 900);
  };

return <div lang={language} className="workspace-shell"><header className="workspace-header"><a className="product-brand" href="/"><span className="brand-glyph">P</span><span>PASTX<small>{c.brandSubtitle}</small></span></a><nav>{[["markets",c.navMarkets,BarChart3],["ibridge",c.navBridge,GitCompareArrows],["activity",c.navActivity,Activity],["portfolio",c.navPortfolio,LayoutDashboard]].map(([id,label,Icon]:any)=><button key={id} className={tab===id?"selected":""} onClick={()=>setTab(id)}><Icon size={14}/>{label}{id==="ibridge"&&<span className="sim-dot">SIM</span>}</button>)}</nav><div className="workspace-tools"><label className="workspace-network-switch" aria-label="Network selector"><span className="workspace-network-label"><i/> Network</span><select className="workspace-network-dropdown" value="testnet" onChange={()=>{}} aria-label="Choose network"><option value="testnet">Testnet</option><option value="mainnet" disabled>Mainnet (coming soon)</option></select></label><div className="workspace-wallet-actions"><button className={"workspace-wallet-button workspace-icon-action"+(walletConnected?" is-connected":"")} type="button" title={walletConnected?"Wallet connected":"Connect wallet"} onClick={() => window.dispatchEvent(new Event("pastx:connect-native-wallet"))}><Wallet size={15}/><span>{walletConnected?"Connected":"Connect"}</span></button><button className="workspace-wallet-button workspace-faucet-button workspace-icon-action" type="button" title="Claim testnet faucet" disabled={faucetAlreadyClaimed} onClick={() => window.dispatchEvent(new Event("pastx:claim-native-faucet"))}><ShieldCheck size={15}/><span>Faucet</span></button></div><LanguageSwitcher language={language} onChange={(next)=>{setLanguage(next);saveStoredLanguage(next);setMessage("")}} text={t}/><div className="notification-wrap"><button className="icon-button" type="button" aria-label={t.notifications} aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={15}/></button>{notificationsOpen&&<div className="notification-popover" role="status"><div className="popover-heading"><strong>{t.notifications}</strong><button type="button" aria-label={c.closeNotifications} onClick={()=>setNotificationsOpen(false)}><X size={13}/></button></div><p>{t.notificationsEmpty}</p><span>{t.notificationsDisabled}</span></div>}</div></div></header>{message&&<div className="workspace-notice"><span>{message}</span><button onClick={()=>setMessage("")}><X size={13}/></button></div>}<main className="workspace-main"><div className="workspace-heading"><div><div className="eyebrow">PASTX / PORTALDOT MARKET</div><h1>{tab==="markets"?c.navMarkets:tab==="portfolio"?c.navPortfolio:tab==="ibridge"?c.navBridge:c.navActivity}</h1><p>{c.headingDescription}</p></div></div>
{(tab==="markets"||tab==="portfolio"||tab==="activity")&&<NativeDemoWorkspace view={tab as "markets"|"portfolio"|"activity"}/>}


{tab==="ibridge"&&<div className={"ibridge-workspace"+(previewing?" is-processing":"")+(simulated?" is-complete":"")}>{!simulated&&<section className={"bridge-card bridge-form-card"+(previewing?" is-processing":"")}><div className="bridge-form-top"><span className="bridge-step-label">{c.transferDetails}</span><span className="simulation-pill"><CircleDot size={11}/> {c.simulationOnly}</span></div><div className="bridge-network-pair"><label className="trade-field"><span>{c.fromNetwork}</span><select value={from} disabled><option value="portal">{c.networkPortal}</option><option value="bnb">{c.networkBnb}</option></select></label><span className="bridge-reverse" aria-hidden="true"><ArrowRight size={15}/></span><label className="trade-field"><span>{c.toNetwork}</span><select value={to} disabled><option value="bnb">{c.networkBnb}</option></select></label></div><div className="bridge-amount"><label className="trade-field"><span>{c.assetLabel}</span><select value={fromAsset} disabled={previewing} onChange={e=>{setFromAsset(e.target.value as RouteAsset);setSimulated(false)}}>{routeOptions[from].map(asset=><option key={asset.value} value={asset.value}>{asset.label}</option>)}</select></label><label className="trade-field"><span>{c.amount}</span><input value={amount} disabled={previewing} onChange={e=>{setAmount(e.target.value);setSimulated(false)}} inputMode="decimal" placeholder={c.amount}/></label></div><div className="bridge-asset-preview"><span className="asset-preview-icon"><Layers3 size={16}/></span><div><strong>{routeAssetName(from,fromAsset,c)}</strong><small>{c.destinationIllustrative}</small></div><span className="simulation-pill">{c.noLiveRoute}</span></div><button className="button button-green full-button bridge-preview-button" disabled={previewing} onClick={previewRoute}>{previewing?<><span className="button-spinner"/> {c.preparingSimulation}</>:c.previewRoute}<ArrowRight size={15}/></button><p className="bridge-form-disclaimer"><ShieldCheck size={14}/> {c.noWalletSignature}</p></section>}{simulated&&<section className="bridge-result-card"><span className="panel-kicker">{c.localReceipt}</span><h3>{c.routeComplete}</h3><div><span>{c.from}</span><strong>{routeNetworkName(from,c)}</strong></div><div><span>{c.to}</span><strong>{routeNetworkName(to,c)}</strong></div><div><span>{c.assetAmount}</span><strong>{amount} · {routeAssetName(from,fromAsset,c)}</strong></div><p>{c.localReceiptNotice}</p><button className="button button-light full-button" onClick={()=>{setSimulated(false);setSimulationToast(false)}}>{c.adjustRoute}</button></section>}{(previewing||simulated)&&<aside className={"bridge-side-card simulation-side-card"+(simulated?" is-success":"")} aria-live="polite"><div className="simulation-side-top"><span className="routing-icon"><GitCompareArrows size={20}/></span><span className="simulation-pill"><CircleDot size={11}/> {simulated?c.simulationSuccessful:c.preparingSimulation}</span></div><span className="panel-kicker">{c.bridgeVision}</span><h3>{c.bridgeVisionTitle}<br/>{c.bridgeVisionLine2}</h3><p>{c.bridgeVisionDescription}</p><div className="simulation-checklist"><div><CheckCircle2 size={16}/><span><strong>{c.sourceDestinationCaptured}</strong><small>{routeNetworkName(from,c)} → {routeNetworkName(to,c)}</small></span></div><div><CheckCircle2 size={16}/><span><strong>{c.assetAmountRecorded}</strong><small>{amount} · {routeAssetName(from,fromAsset,c)}</small></span></div><div><CheckCircle2 size={16}/><span><strong>{c.routeReversalAvailable}</strong><small>{c.reverseDescription}</small></span></div><div><CheckCircle2 size={16}/><span><strong>{c.routeCompleteLabel}</strong><small>{c.routeNotQuote}</small></span></div><div className={simulated?"simulation-check-complete":"simulation-check-pending"}>{simulated?<CheckCircle2 size={16}/>:<CircleDot size={16}/>}<span><strong>{simulated?c.simulationRecorded:c.preparingResult}</strong><small>{simulated?c.noFundsMoved:c.preparingLocally}</small></span></div></div><div className="simulation-warning"><ShieldCheck size={17}/><div><strong>{c.simulationWarningTitle}</strong><p>{c.simulationWarningBody}</p></div></div></aside>}{simulationToast&&<div className="simulation-toast" role="status"><span className="toast-success-icon"><CheckCircle2 size={19}/></span><div><strong>{c.simulationSuccessful}</strong><p>{c.simulationToastBody}</p></div><button type="button" aria-label={c.dismissSimulation} onClick={()=>setSimulationToast(false)}>×</button></div>}</div>}

<footer className="workspace-footer"><span>{c.footerTestnet}</span><span>{c.footerDisclaimer}</span><a href="https://github.com/Investorquab/PASTX/blob/ui/firstbell-inspired-market-terminal/docs/PASTX-MARKET-IMPLEMENTATION.md" target="_blank" rel="noreferrer">{c.technicalNotes} <ExternalLink size={11}/></a><a href="/">{c.backOverview}</a></footer></main></div>}

type RouteOption = {value:RouteAsset;label:string};
function routeAssetOptionsFor(c:Record<string,string>):Record<RouteNetwork,RouteOption[]> {
 const external=(symbols:RouteAsset[])=>symbols.map(value=>({value,label:value+" ("+c.illustrative+")"}));
 return {
  portal:[{value:"native",label:c.nativePortalOption}],
  ethereum:external(["USDT","USDC","ETH"]),
  bnb:external(["USDT","USDC","BNB"]),
  polygon:external(["USDT","USDC","POL"])
 };
}
const routeNetworkName=(network:RouteNetwork,c:Record<string,string>)=>({portal:c.networkPortal,ethereum:c.networkEthereum,bnb:c.networkBnb,polygon:c.networkPolygon}[network]);
const routeAssetName=(network:RouteNetwork,asset:RouteAsset,c:Record<string,string>)=>routeAssetOptionsFor(c)[network].find(option=>option.value===asset)?.label??String(asset);
