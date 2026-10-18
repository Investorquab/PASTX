import { isCandleInterval, MARKET_INSTRUMENTS, type MarketCandle, type MarketInstrument, type MarketQuote, type CandleInterval } from "@pastx/shared";
import { isMarketQuote } from "./marketQuote";

export type ApiHealth = {
  status: "ok";
  service: string;
  marketDataConfigured: boolean;
  marketDataDisplayEnabled: boolean;
  tradingEnabled: false;
};

export type ChainStatus = {
  configured: boolean;
  reachable: boolean;
  networkMatches: boolean;
  expectedChainId: number;
  chainId: number | null;
  blockNumber: string | null;
  status: "not_configured" | "unreachable" | "verified" | "wrong_network";
  verificationScope: "chain_id_and_latest_block_read";
};


export type ApiCapabilities = {
  service: "pastx-api";
  capabilities: {
    referenceCatalogue: { implemented: true; enabled: true };
    marketQuotes: { implemented: true; enabled: boolean };
    marketCandles: { implemented: true; enabled: boolean };
    chainIdentityProbe: { implemented: true; enabled: true; verificationScope: "chain_id_and_latest_block_read" };
    walletConnection: { implemented: false; enabled: false };
    onchainBalances: { implemented: false; enabled: false };
    orderPreview: { implemented: true; enabled: true; execution: false };
    orderSubmission: { implemented: false; enabled: false };
    transactionHistory: { implemented: false; enabled: false };
    atomicSettlement: { implemented: false; enabled: false };
  };
  safety: {
    tradingEnabled: false;
    externalStockQuotesAreReferenceData: true;
    marketDataDisplayRequiresProviderPermission: true;
  };
};

export class ApiClientError extends Error {
  constructor(message: string, public readonly statusCode: number | null = null) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function getChainStatus(fetchImpl: typeof fetch = fetch): Promise<ChainStatus> {
  let response: Response;
  try {
    response = await fetchImpl("/api/chain/status", { headers: { accept: "application/json" } });
  } catch {
    throw new ApiClientError("PASTX API is unavailable.");
  }

  if (!response.ok) throw new ApiClientError("PASTX API could not return chain status.", response.status);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError("PASTX API returned an invalid response.", response.status);
  }

  if (typeof payload !== "object" || payload === null || !("item" in payload)) {
    throw new ApiClientError("PASTX API returned an invalid chain status.");
  }

  const item = (payload as { item?: unknown }).item;
  if (typeof item !== "object" || item === null) throw new ApiClientError("PASTX API returned an invalid chain status.");
  const status = item as Record<string, unknown>;
  const allowed = ["not_configured", "unreachable", "verified", "wrong_network"];
  if (
    typeof status.configured !== "boolean" ||
    typeof status.reachable !== "boolean" ||
    typeof status.networkMatches !== "boolean" ||
    typeof status.expectedChainId !== "number" ||
    !Number.isSafeInteger(status.expectedChainId) ||
    !(status.chainId === null || (typeof status.chainId === "number" && Number.isSafeInteger(status.chainId) && status.chainId > 0)) ||
    !(status.blockNumber === null || (typeof status.blockNumber === "string" && /^\d+$/.test(status.blockNumber))) ||
    typeof status.status !== "string" ||
    !allowed.includes(status.status) ||
    status.verificationScope !== "chain_id_and_latest_block_read"
  ) {
    throw new ApiClientError("PASTX API returned an invalid chain status.");
  }

  const stateIsConsistent = status.status === "not_configured"
    ? status.configured === false && status.reachable === false && status.networkMatches === false && status.chainId === null && status.blockNumber === null
    : status.status === "unreachable"
      ? status.configured === true && status.reachable === false && status.networkMatches === false && status.chainId === null && status.blockNumber === null
      : status.status === "verified"
        ? status.configured === true && status.reachable === true && status.networkMatches === true && status.chainId === status.expectedChainId && typeof status.blockNumber === "string"
        : status.configured === true && status.reachable === true && status.networkMatches === false && status.chainId !== null && status.chainId !== status.expectedChainId && typeof status.blockNumber === "string";

  if (!stateIsConsistent) throw new ApiClientError("PASTX API returned an inconsistent chain status.");
  return status as unknown as ChainStatus;
}

export async function getApiHealth(fetchImpl: typeof fetch = fetch): Promise<ApiHealth> {
  const payload = await fetchJson(fetchImpl, "/api/health");
  if (typeof payload !== "object" || payload === null) throw new ApiClientError("PASTX API returned invalid health status.");
  const health = payload as Record<string, unknown>;
  if (
    health.status !== "ok" ||
    typeof health.service !== "string" ||
    typeof health.marketDataConfigured !== "boolean" ||
    typeof health.marketDataDisplayEnabled !== "boolean" ||
    health.tradingEnabled !== false
  ) throw new ApiClientError("PASTX API returned invalid health status.");
  return health as unknown as ApiHealth;
}


export async function getApiCapabilities(fetchImpl: typeof fetch = fetch): Promise<ApiCapabilities> {
  const payload = await fetchJson(fetchImpl, "/api/capabilities");
  if (typeof payload !== "object" || payload === null) throw new ApiClientError("PASTX API returned invalid capabilities.");
  const root = payload as Record<string, unknown>;
  const capabilities = root.capabilities;
  const safety = root.safety;
  if (typeof capabilities !== "object" || capabilities === null || typeof safety !== "object" || safety === null) {
    throw new ApiClientError("PASTX API returned invalid capabilities.");
  }
  const caps = capabilities as Record<string, unknown>;
  const safetyFlags = safety as Record<string, unknown>;
  const isFeature = (value: unknown, implemented: boolean, enabled?: boolean): boolean => {
    if (typeof value !== "object" || value === null) return false;
    const feature = value as Record<string, unknown>;
    return feature.implemented === implemented && typeof feature.enabled === "boolean" &&
      (enabled === undefined || feature.enabled === enabled);
  };
  if (
    root.service !== "pastx-api" ||
    !isFeature(caps.referenceCatalogue, true, true) ||
    !isFeature(caps.marketQuotes, true) ||
    !isFeature(caps.marketCandles, true) ||
    !isFeature(caps.chainIdentityProbe, true, true) ||
    (caps.chainIdentityProbe as Record<string, unknown>)?.verificationScope !== "chain_id_and_latest_block_read" ||
    !isFeature(caps.walletConnection, false, false) ||
    !isFeature(caps.onchainBalances, false, false) ||
    !isFeature(caps.orderPreview, true, true) ||
    (caps.orderPreview as Record<string, unknown>)?.execution !== false ||
    !isFeature(caps.orderSubmission, false, false) ||
    !isFeature(caps.transactionHistory, false, false) ||
    !isFeature(caps.atomicSettlement, false, false) ||
    safetyFlags.tradingEnabled !== false ||
    safetyFlags.externalStockQuotesAreReferenceData !== true ||
    safetyFlags.marketDataDisplayRequiresProviderPermission !== true
  ) {
    throw new ApiClientError("PASTX API returned invalid capabilities.");
  }
  return payload as ApiCapabilities;
}



function marketIdentityQuery(i:MarketInstrument):string{const p=new URLSearchParams();if(i.exchange)p.set("exchange",i.exchange);if(i.micCode)p.set("mic_code",i.micCode);if(i.country)p.set("country",i.country);if(i.currency)p.set("currency",i.currency);const q=p.toString();return q?"?"+q:"";}
function parseMarketInstrument(v:unknown):MarketInstrument|null{
 if(typeof v!=="object"||v===null||Array.isArray(v))return null;const x=v as Record<string,unknown>;
 if(typeof x.symbol!=="string"||!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(x.symbol)||typeof x.name!=="string"||!x.name.trim()||x.kind!=="reference"||typeof x.description!=="string"||!x.description.trim()||typeof x.currency!=="string"||!/^[A-Z]{3}$/.test(x.currency)||
 !(x.providerSymbol===undefined||(typeof x.providerSymbol==="string"&&x.providerSymbol.trim().toUpperCase()===x.symbol))||
 !(x.exchange===undefined||(typeof x.exchange==="string"&&x.exchange.trim().length>0&&x.exchange.length<=100))||
 !(x.micCode===undefined||(typeof x.micCode==="string"&&/^[A-Z0-9]{4}$/.test(x.micCode)))||
 !(x.country===undefined||(typeof x.country==="string"&&x.country.length<=80))||
 !(x.instrumentType===undefined||(typeof x.instrumentType==="string"&&x.instrumentType.trim().length>0)))return null;
 return {symbol:x.symbol,name:x.name,kind:"reference",description:x.description,currency:x.currency,...(typeof x.providerSymbol==="string"?{providerSymbol:x.providerSymbol}:{}),...(typeof x.exchange==="string"?{exchange:x.exchange}:{}),...(typeof x.micCode==="string"?{micCode:x.micCode}:{}),...(typeof x.country==="string"?{country:x.country}:{}),...(typeof x.instrumentType==="string"?{instrumentType:x.instrumentType}:{})};
}
export async function getMarketSearch(query:string,limit=15,fetchImpl:typeof fetch=fetch):Promise<MarketInstrument[]>{
 const q=query.trim();if(q.length<2||q.length>80||!Number.isInteger(limit)||limit<1||limit>20)throw new ApiClientError("Stock search needs 2–80 characters and a result limit from 1 to 20.");
 const payload=await fetchJson(fetchImpl,"/api/markets/search?q="+encodeURIComponent(q)+"&limit="+limit);if(typeof payload!=="object"||payload===null)throw new ApiClientError("PASTX API returned invalid stock search.");
 const root=payload as Record<string,unknown>;if(root.query!==q||!Array.isArray(root.items)||root.count!==root.items.length||root.classification!=="external listed-stock directory; not proof of a Portaldot-issued equity token")throw new ApiClientError("PASTX API returned invalid stock search.");
 const seen=new Set<string>();const items=root.items.map((v):MarketInstrument|null=>{const i=parseMarketInstrument(v);if(!i||!i.exchange)return null;const key=i.symbol+":"+(i.micCode??i.exchange.toUpperCase())+":"+(i.country??"").trim().toUpperCase()+":"+i.currency.toUpperCase();if(seen.has(key))return null;seen.add(key);return i;});
 if(items.some((i)=>i===null))throw new ApiClientError("PASTX API returned malformed stock search results.");return items as MarketInstrument[];
}
export async function getMarketLogoUrl(i:MarketInstrument,fetchImpl:typeof fetch=fetch):Promise<string|null>{
 if(!i.exchange)return null;const payload=await fetchJson(fetchImpl,"/api/markets/"+encodeURIComponent(i.symbol)+"/logo"+marketIdentityQuery(i));
 if(typeof payload!=="object"||payload===null||!("url" in payload))throw new ApiClientError("PASTX API returned invalid company logo response.");
 const raw=(payload as {url?:unknown}).url;if(raw===null)return null;if(typeof raw!=="string"||raw.length>2048)throw new ApiClientError("PASTX API returned invalid company logo URL.");
 try{const u=new URL(raw);if(u.protocol!=="https:"||u.username||u.password||!u.hostname)throw new Error("unsafe");return u.toString();}catch{throw new ApiClientError("PASTX API returned unsafe company logo URL.");}
}

export async function getMarketCatalogue(fetchImpl: typeof fetch = fetch): Promise<MarketInstrument[]> {
  const payload = await fetchJson(fetchImpl, "/api/markets");
  if (typeof payload !== "object" || payload === null) throw new ApiClientError("PASTX API returned an invalid market catalogue.");
  const root = payload as Record<string, unknown>;
  if (
    !Array.isArray(root.items) ||
    root.count !== root.items.length ||
    root.classification !== "reference catalogue; not proof of tokenized equity or executable market"
  ) {
    throw new ApiClientError("PASTX API returned an invalid market catalogue.");
  }

  const seen = new Set<string>();
  const items = root.items.map((value): MarketInstrument | null => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.symbol !== "string" ||
      !/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(item.symbol) ||
      typeof item.name !== "string" || !item.name.trim() ||
      (item.kind !== "reference" && item.kind !== "simulated" && item.kind !== "onchain") ||
      typeof item.description !== "string" || !item.description.trim() ||
      typeof item.currency !== "string" || !/^[A-Z]{3,8}$/.test(item.currency) ||
      !(item.providerSymbol === undefined || (typeof item.providerSymbol === "string" && item.providerSymbol.trim().length > 0))
    ) return null;
    const parsed = parseMarketInstrument(item);
    if (!parsed) return null;
    // A ticker can be listed on multiple exchanges. Reject duplicate listings,
    // not distinct instruments that happen to share the same symbol.
    const identity = parsed.symbol.toUpperCase() + ":" + (parsed.micCode ?? parsed.exchange?.toUpperCase() ?? "") + ":" + (parsed.country ?? "").trim().toUpperCase() + ":" + parsed.currency.toUpperCase();
    if (seen.has(identity)) return null;
    seen.add(identity);
    return parsed;
  });
  if (items.some((item) => item === null) || items.length === 0) {
    throw new ApiClientError("PASTX API returned an invalid market catalogue.");
  }
  return items as MarketInstrument[];
}

export async function getMarketQuote(input:string|MarketInstrument,fetchImpl:typeof fetch=fetch):Promise<MarketQuote>{
 const instrument=typeof input==="string"?MARKET_INSTRUMENTS.find((i)=>i.symbol===input.trim().toUpperCase()):input;
 if(!instrument)throw new ApiClientError("Unsupported market instrument.");const symbol=instrument.symbol.trim().toUpperCase(),identity=typeof input==="string"?"":marketIdentityQuery(instrument);
 const payload=await fetchJson(fetchImpl,"/api/markets/"+encodeURIComponent(symbol)+"/quote"+identity);
 if(typeof payload!=="object"||payload===null||!("item" in payload))throw new ApiClientError("PASTX API returned an invalid market quote.");
 const item=(payload as {item?:unknown}).item;if(!isMarketQuote(item)||item.source!=="twelve_data"||item.symbol!==symbol||item.currency!==instrument.currency)throw new ApiClientError("PASTX API returned an invalid market quote.");return item;
}

export async function getMarketCandles(input:string|MarketInstrument,interval:CandleInterval="1day",outputsize=30,fetchImpl:typeof fetch=fetch):Promise<MarketCandle[]>{
 if(!isCandleInterval(interval))throw new ApiClientError("Unsupported candle interval.");if(!Number.isInteger(outputsize)||outputsize<1||outputsize>500)throw new ApiClientError("Candle output size must be an integer between 1 and 500.");
 const instrument=typeof input==="string"?MARKET_INSTRUMENTS.find((i)=>i.symbol===input.trim().toUpperCase()):input;if(!instrument)throw new ApiClientError("Unsupported market instrument.");
 const symbol=instrument.symbol.trim().toUpperCase(),p=new URLSearchParams(marketIdentityQuery(instrument).replace(/^\?/,""));p.set("interval",interval);p.set("outputsize",String(outputsize));
 const payload=await fetchJson(fetchImpl,"/api/markets/"+encodeURIComponent(symbol)+"/candles?"+p.toString());
 if(typeof payload!=="object"||payload===null||!("items" in payload)||!Array.isArray((payload as {items?:unknown}).items)||!("symbol" in payload)||(payload as {symbol?:unknown}).symbol!==symbol||!("interval" in payload)||(payload as {interval?:unknown}).interval!==interval)throw new ApiClientError("PASTX API returned invalid candle data.");
 const rows=(payload as {items:unknown[]}).items;const candles=rows.map((v):MarketCandle|null=>{if(typeof v!=="object"||v===null)return null;const c=v as Record<string,unknown>;if(typeof c.timestamp!=="string"||!Number.isFinite(Date.parse(c.timestamp)))return null;const nums=[c.open,c.high,c.low,c.close];if(!nums.every((n)=>typeof n==="number"&&Number.isFinite(n)&&n>0))return null;const open=c.open as number,high=c.high as number,low=c.low as number,close=c.close as number,volume=c.volume;if(high<Math.max(open,close,low)||low>Math.min(open,close,high))return null;if(!(volume===null||(typeof volume==="number"&&Number.isFinite(volume)&&volume>=0)))return null;return {timestamp:c.timestamp as string,open,high,low,close,volume};});
 if(candles.some((c)=>c===null))throw new ApiClientError("PASTX API returned malformed candle data.");return candles as MarketCandle[];
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { accept: "application/json" } });
  } catch {
    throw new ApiClientError("PASTX API is unavailable.");
  }
  if (!response.ok) throw new ApiClientError("PASTX API request failed.", response.status);
  try {
    return await response.json();
  } catch {
    throw new ApiClientError("PASTX API returned an invalid response.", response.status);
  }
}
