import {useState} from "react";
const slugs:Record<string,string>={AAPL:"apple",NVDA:"nvidia",TSLA:"tesla",MSFT:"microsoft"};
export function AssetLogo({symbol,name,initials,className=""}:{symbol:string;name:string;initials:string;className?:string}) {
 const slug=slugs[symbol.toUpperCase()]; const [failed,setFailed]=useState(!slug);
 return <span className={"asset-logo "+className+(failed?" logo-failed":"")} role="img" aria-label={name+" logo"}>
 {slug&&<img src={"https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/"+slug+".svg"} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>}<span className="logo-fallback" aria-hidden="true">{initials}</span></span>;
}