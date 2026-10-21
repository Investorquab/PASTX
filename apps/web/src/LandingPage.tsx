import { useEffect, useState } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getStoredLanguage, saveStoredLanguage, textFor, type LanguageCode } from "./i18n";
import { landingTextFor } from "./productI18n";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Blocks, CheckCircle2, CircleDot, GitBranch, Layers3, ShieldCheck, TrendingUp, Wallet, Zap } from "lucide-react";

const ecosystemLinks = [
  { labelKey: "portaldotSite", href: "https://www.portaldot.io", noteIndex: 0 },
  { labelKey: "portaldotGithub", href: "https://github.com/portaldotVolunteer/Portaldot", noteIndex: 1 },
  { labelKey: "developerDocs", href: "https://portaldot-dev.readthedocs.io/en/latest/", noteIndex: 2 },
  { labelKey: "nodeConsole", href: "https://node-console.portaldot.dev/", noteIndex: 3 },
  { labelKey: "portalExplorer", href: "https://portalscan.portaldot.io/", noteIndex: 4 },
  { labelKey: "portaldotX", href: "https://x.com/PortaldotL0", noteIndex: 5 }
];
const ecosystemNotes: Record<LanguageCode, string[]> = {
  en: ["Project and ecosystem", "Protocol source code", "Build and integrate", "Testnet network tools", "Inspect network activity", "Official ecosystem updates"],
  fr: ["Projet et écosystème", "Code source du protocole", "Construire et intégrer", "Outils réseau testnet", "Consulter l’activité réseau", "Actualités officielles de l’écosystème"],
  es: ["Proyecto y ecosistema", "Código fuente del protocolo", "Crear e integrar", "Herramientas de red testnet", "Consultar actividad de red", "Novedades oficiales del ecosistema"],
  pt: ["Projeto e ecossistema", "Código-fonte do protocolo", "Construir e integrar", "Ferramentas de rede testnet", "Inspecionar atividade da rede", "Atualizações oficiais do ecossistema"],
  id: ["Proyek dan ekosistem", "Kode sumber protokol", "Bangun dan integrasikan", "Alat jaringan testnet", "Periksa aktivitas jaringan", "Pembaruan resmi ekosistem"],
  vi: ["Dự án và hệ sinh thái", "Mã nguồn giao thức", "Xây dựng và tích hợp", "Công cụ mạng testnet", "Kiểm tra hoạt động mạng", "Cập nhật hệ sinh thái chính thức"],
  zh: ["项目与生态", "协议源代码", "构建与集成", "测试网工具", "查看网络活动", "生态官方动态"]
};

export function LandingPage() {
  const [language, setLanguage] = useState<LanguageCode>(() => getStoredLanguage());
  const l = landingTextFor(language);
  const switcherText = textFor(language);
  const [revealReady, setRevealReady] = useState(false);
  useEffect(() => { saveStoredLanguage(language); }, [language]);
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
    <div lang={language} className={"pastx-landing landing-redesign" + (revealReady ? " reveal-enabled" : "")}>
      <header className="landing-nav">
        <a className="product-brand" href="/" aria-label="PASTX home"><span className="brand-glyph">P</span><span>PASTX<small>PORTALDOT ASSET &amp; STOCK EXCHANGE</small></span></a>
        <nav aria-label="Main navigation">
          <a href="#product">{l.navProduct}</a><a href="#testnet">{l.navTestnet}</a><a href="#mainnet">{l.navMainnet}</a><a href="#iswap">{l.navSwapBridge}</a><a href="#resources">{l.navResources}</a>
        </nav>
        <div className="landing-nav-actions"><LanguageSwitcher language={language} onChange={(next)=>{setLanguage(next);saveStoredLanguage(next)}} text={switcherText} /><a className="button button-dark nav-cta" href="/demo">{l.openDemo} <ArrowRight size={15} /></a></div>
      </header>
      <main>
        <section className="landing-hero landing-hero-wide" data-reveal>
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> {l.heroBadge} <span className="eyebrow-divider" /> {l.heroBadgeRight}</div>
            <h1>{l.heroLine1}<br /><em>{l.heroLine2}</em></h1>
            <p className="hero-lede">{l.heroDescription}</p>
            <div className="hero-status-tags"><span><CircleDot size={13} /> {l.tagTestnet}</span><span><ShieldCheck size={13} /> {l.tagAssets}</span><span><GitBranch size={13} /> {l.tagRoadmap}</span></div>
            <div className="hero-actions"><a className="button button-green" href="/demo">{l.exploreDemo} <ArrowRight size={16} /></a><a className="text-link" href="#testnet">{l.seeAvailable} <ArrowDownRight size={15} /></a></div>
            <p className="hero-caveat">{l.heroCaveat}</p>
          </div>
          <div className="hero-art-wrap" aria-hidden="true">
            <img src="/pastx-market-hero.svg" alt="" width="760" height="610" decoding="async" />
          </div>
        </section>
        <section className="product-status-strip" aria-label="PASTX product principles" data-reveal>
          <div><span className="status-number">01</span><strong>{l.statusTitle1}</strong><small>{l.statusBody1}</small></div>
          <div><span className="status-number">02</span><strong>{l.statusTitle2}</strong><small>{l.statusBody2}</small></div>
          <div><span className="status-number">03</span><strong>{l.statusTitle3}</strong><small>{l.statusBody3}</small></div>
        </section>
        <section className="landing-section product-section landing-section-rich" id="product" data-reveal>
          <div className="section-intro">
            <div className="eyebrow">{l.productEyebrow}</div><h2>{l.productTitle1}<br /><em>{l.productTitle2}</em></h2>
            <p>{l.productBody1}</p>
            <p>{l.productBody2}</p>
            <a className="text-link" href="/demo">{l.openWorkspace} <ArrowRight size={15} /></a>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-dark"><div className="feature-icon"><BarChart3 size={19} /></div><span className="feature-index">{l.discoverIndex}</span><h3>{l.discoverTitle}</h3><p>{l.discoverBody}</p><span className="feature-foot"><CircleDot size={12} /> {l.discoverFoot}</span></article>
            <article className="feature-card"><div className="feature-icon green-icon"><Wallet size={19} /></div><span className="feature-index">{l.tradeIndex}</span><h3>{l.tradeTitle}</h3><p>{l.tradeBody}</p><span className="feature-foot"><CheckCircle2 size={12} /> {l.tradeFoot}</span></article>
            <article className="feature-card"><div className="feature-icon purple-icon"><Layers3 size={19} /></div><span className="feature-index">{l.trackIndex}</span><h3>{l.trackTitle}</h3><p>{l.trackBody}</p><span className="feature-foot"><CheckCircle2 size={12} /> {l.trackFoot}</span></article>
          </div>
        </section>
        <section className="landing-section testnet-section" id="testnet" data-reveal>
          <div className="section-heading-row"><div><div className="eyebrow">{l.testnetEyebrow}</div><h2>{l.testnetTitle1}<br /><em>{l.testnetTitle2}</em></h2></div><p className="section-heading-copy">{l.testnetDescription}</p></div>
          <div className="capability-grid">
            <article className="capability-card"><span className="capability-icon"><BarChart3 size={18} /></span><span className="capability-number">01</span><h3>{l.capStockTitle}</h3><p>{l.capStockBody}</p><span className="capability-status status-available">{l.statusAvailable}</span></article>
            <article className="capability-card"><span className="capability-icon"><Wallet size={18} /></span><span className="capability-number">02</span><h3>{l.capTradeTitle}</h3><p>{l.capTradeBody}</p><span className="capability-status status-gated">{l.statusContract}</span></article>
            <article className="capability-card"><span className="capability-icon"><TrendingUp size={18} /></span><span className="capability-number">03</span><h3>{l.capPositionsTitle}</h3><p>{l.capPositionsBody}</p><span className="capability-status status-gated">{l.statusConfigured}</span></article>
            <article className="capability-card"><span className="capability-icon"><Layers3 size={18} /></span><span className="capability-number">04</span><h3>{l.capPortfolioTitle}</h3><p>{l.capPortfolioBody}</p><span className="capability-status status-gated">{l.statusSupported}</span></article>
            <article className="capability-card"><span className="capability-icon"><ShieldCheck size={18} /></span><span className="capability-number">05</span><h3>{l.capActivityTitle}</h3><p>{l.capActivityBody}</p><span className="capability-status status-available">{l.statusSession}</span></article>
            <article className="capability-card"><span className="capability-icon"><GitBranch size={18} /></span><span className="capability-number">06</span><h3>{l.capBridgeTitle}</h3><p>{l.capBridgeBody}</p><span className="capability-status status-demo">{l.statusSimulation}</span></article>
          </div>
          <div className="truth-note"><ShieldCheck size={18} /><div><strong>{l.truthTitle}</strong><p>{l.truthBody}</p></div></div>
        </section>
        <section className="landing-section mainnet-section" id="mainnet" data-reveal>
          <div className="section-heading-row"><div><div className="eyebrow">{l.mainnetEyebrow}</div><h2>{l.mainnetTitle1}<br /><em>{l.mainnetTitle2}</em></h2></div><p className="section-heading-copy">{l.mainnetDescription}</p></div>
          <div className="future-grid">
            <article className="future-card"><span className="future-label">{l.futureFoundationTag}</span><h3>{l.futureFoundationTitle}</h3><p>{l.futureFoundationBody}</p></article>
            <article className="future-card"><span className="future-label">{l.futureAssetTag}</span><h3>{l.futureAssetTitle}</h3><p>{l.futureAssetBody}</p></article>
            <article className="future-card"><span className="future-label">{l.futureDataTag}</span><h3>{l.futureDataTitle}</h3><p>{l.futureDataBody}</p></article>
            <article className="future-card"><span className="future-label">{l.futurePortfolioTag}</span><h3>{l.futurePortfolioTitle}</h3><p>{l.futurePortfolioBody}</p></article>
            <article className="future-card"><span className="future-label">{l.futureExecutionTag}</span><h3>{l.futureExecutionTitle}</h3><p>{l.futureExecutionBody}</p></article>
            <article className="future-card"><span className="future-label">{l.futureVisionTag}</span><h3>{l.futureVisionTitle}</h3><p>{l.futureVisionBody}</p></article>
          </div>
        </section>
        <section className="landing-section routing-section" id="iswap" data-reveal>
          <div className="section-heading-row"><div><div className="eyebrow">{l.routingEyebrow}</div><h2>{l.routingTitle1}<br /><em>{l.routingTitle2}</em></h2></div><p className="section-heading-copy">{l.routingDescription}</p></div>
          <div className="routing-grid">
            <article className="routing-card routing-iswap"><div className="routing-card-head"><span className="routing-icon"><Zap size={20} /></span><span className="roadmap-status status-future">{l.planned}</span></div><h3>iSwap</h3><p className="routing-lede">{l.iswapBody}</p><ul><li><CheckCircle2 size={15} /> {l.iswapBullet1}</li><li><CheckCircle2 size={15} /> {l.iswapBullet2}</li><li><CheckCircle2 size={15} /> {l.iswapBullet3}</li></ul><p className="routing-footnote">{l.iswapNote}</p></article>
            <article className="routing-card routing-ibridge"><div className="routing-card-head"><span className="routing-icon"><GitBranch size={20} /></span><span className="roadmap-status status-demo">{l.bridgeStatus}</span></div><h3>iBridge</h3><p className="routing-lede">{l.bridgeBody}</p><ul><li><CheckCircle2 size={15} /> {l.bridgeBullet1}</li><li><CheckCircle2 size={15} /> {l.bridgeBullet2}</li><li><CheckCircle2 size={15} /> {l.bridgeBullet3}</li></ul><p className="routing-footnote">{l.bridgeNote}</p></article>
          </div>
        </section>
        <section className="landing-section roadmap-section roadmap-section-rich" id="roadmap" data-reveal>
          <div className="roadmap-copy"><div className="eyebrow">{l.roadmapEyebrow}</div><h2>{l.roadmapTitle1}<br /><em>{l.roadmapTitle2}</em></h2><p>{l.roadmapDescription}</p><a className="button button-dark" href="/demo">{l.exploreDemo} <ArrowRight size={15} /></a></div>
          <div className="roadmap-list">
            <div className="roadmap-item"><span className="roadmap-status status-current">NOW</span><div><strong>{l.roadmapNowTitle}</strong><p>{l.roadmapNowBody}</p></div></div>
            <div className="roadmap-item"><span className="roadmap-status status-demo">{l.roadmapNextLabel}</span><div><strong>Verified Portaldot deployment</strong><p>{l.roadmapNextBody}</p></div></div>
            <div className="roadmap-item"><span className="roadmap-status status-future">LATER</span><div><strong>{l.roadmapLaterTitle}</strong><p>{l.roadmapLaterBody}</p></div></div>
            <div className="roadmap-item"><span className="roadmap-status status-future">{l.roadmapVisionLabel}</span><div><strong>{l.roadmapVisionTitle}</strong><p>{l.roadmapVisionBody}</p></div></div>
          </div>
        </section>
        <section className="landing-section resources-section" id="resources" data-reveal>
          <div className="section-heading-row"><div><div className="eyebrow">{l.resourcesEyebrow}</div><h2>{l.resourcesTitle1}<br /><em>{l.resourcesTitle2}</em></h2></div><p className="section-heading-copy">{l.resourcesDescription}</p></div>
          <div className="resource-grid">
            <a className="resource-card resource-primary" href="https://github.com/Investorquab/PASTX" target="_blank" rel="noreferrer"><span><Blocks size={19} /></span><strong>{l.pastxGithub}</strong><small>{l.pastxGithubBody}</small><ArrowUpRight size={15} /></a>
            <a className="resource-card" href="https://github.com/Investorquab" target="_blank" rel="noreferrer"><span><GitBranch size={19} /></span><strong>{l.builderProfile}</strong><small>{l.builderBody}</small><ArrowUpRight size={15} /></a>
            {ecosystemLinks.map((link) => <a className="resource-card" href={link.href} key={link.href} target="_blank" rel="noreferrer"><span><Layers3 size={19} /></span><strong>{l[link.labelKey]}</strong><small>{ecosystemNotes[language][link.noteIndex]}</small><ArrowUpRight size={15} /></a>)}
            <a className="resource-card" href="https://github.com/Investorquab/PASTX/blob/ui/firstbell-inspired-market-terminal/docs/PASTX-MARKET-IMPLEMENTATION.md" target="_blank" rel="noreferrer"><span><ShieldCheck size={19} /></span><strong>{l.techNotes}</strong><small>{l.techNotesBody}</small><ArrowUpRight size={15} /></a>
          </div>
        </section>
        <section className="landing-cta landing-cta-rich" data-reveal><div><span className="eyebrow">{l.ctaEyebrow}</span><h2>{l.ctaTitle}</h2><p>{l.ctaBody}</p></div><a className="button button-green" href="/demo">{l.openDemo} <ArrowRight size={16} /></a></section>
      </main>
      <footer className="landing-footer landing-footer-rich"><a className="product-brand" href="/"><span className="brand-glyph">P</span><span>PASTX<small>PORTALDOT ASSET &amp; STOCK EXCHANGE</small></span></a><p>{l.ctaDisclaimer}</p><div><a href="https://github.com/Investorquab/PASTX" target="_blank" rel="noreferrer">{l.pastxGithub} <ArrowUpRight size={12} /></a><a href="https://www.portaldot.io" target="_blank" rel="noreferrer">{l.portaldotSite} <ArrowUpRight size={12} /></a><a href="/demo">{l.openDemo}</a></div></footer>
    </div>
  );
}
