import {useEffect,useState} from "react";
import {getMarketLogoUrl} from "./api";
import type {MarketInstrument} from "@pastx/shared";
const known:Record<string,string>={AAPL:"apple",NVDA:"nvidia",TSLA:"tesla",MSFT:"microsoft"};
type Props={symbol:string;name:string;initials:string;className?:string;exchange?:string;micCode?:string;country?:string;currency?:string};
export function AssetLogo({symbol,name,initials,className="",exchange,micCode,country,currency}:Props){
 const slug=known[symbol.toUpperCase()];const [remote,setRemote]=useState<string|null>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;setFailed(false);setRemote(null);if(slug||!exchange||!currency)return()=>{active=false;};
  const instrument:MarketInstrument={symbol,name,kind:"reference",description:"Listed company-logo lookup.",currency,providerSymbol:symbol,exchange,...(micCode?{micCode}:{}),...(country?{country}:{})};
  getMarketLogoUrl(instrument).then((url)=>{if(active){setRemote(url);if(!url)setFailed(true);}}).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;};
 },[symbol,name,slug,exchange,micCode,country,currency]);
 const src=slug?"https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/"+slug+".svg":remote;const fallback=failed||!src;
 return <span className={"asset-logo "+className+(fallback?" logo-failed":"")} role="img" aria-label={name+" logo"}>{src&&<img src={src} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>}<span className="logo-fallback" aria-hidden="true">{initials}</span></span>;
}
