import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, createWalletClient, custom, decodeEventLog, defineChain, formatUnits, getAddress, http, isAddress, parseAbi, type Address, type Hash, type Hex } from "viem";
import { ArrowDownUp, ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, ExternalLink, LoaderCircle, ShieldAlert, Wallet } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { textFor, type LanguageCode } from "./i18n";
import { chainIdHex, formatTokenUnits, parseDecimalUnits } from "./crossChainDemoUtils";

type Provider = { request(args: {method: string; params?: readonly unknown[] | object}): Promise<unknown>; on?(event:string,fn:(value:unknown)=>void):void; removeListener?(event:string,fn:(value:unknown)=>void):void };
declare global { interface Window { ethereum?: Provider } }
const PORTAL_ID=420420777, BNB_ID=97, TOKEN_DECIMALS=14, SHARE_DECIMALS=6;
const PORTAL_RPC=import.meta.env.VITE_PASTX_PORTALDOT_EVM_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev";
const BNB_RPC=import.meta.env.VITE_PASTX_BSC_TESTNET_RPC_URL || "https://bsc-testnet-dataseed.bnbchain.org";
const ESCROW=validAddress(import.meta.env.VITE_PASTX_PORTALDOT_ESCROW_ADDRESS);
const GATEWAY=validAddress(import.meta.env.VITE_PASTX_BNB_GATEWAY_ADDRESS);
const TOKEN=validAddress(import.meta.env.VITE_PASTX_PORTAL_TOKEN);
const FAUCET=validAddress(import.meta.env.VITE_PASTX_PORTAL_FAUCET);
const ISWAP=validAddress(import.meta.env.VITE_PASTX_PORTAL_ISWAP_ADDRESS);
const bridgeMaxRawText=import.meta.env.VITE_PASTX_BRIDGE_MAX_DEPOSIT_RAW || "";
const BRIDGE_MAX_RAW=/^[0-9]+$/.test(bridgeMaxRawText) && BigInt(bridgeMaxRawText)>0n ? BigInt(bridgeMaxRawText) : null;
const VALUE_CHECKED=import.meta.env.VITE_PASTX_SOURCE_VALUE_SEMANTICS_VERIFIED==="true";
const portalChain=defineChain({id:PORTAL_ID,name:"PortalDOT V3 Testnet",nativeCurrency:{name:"tPOTv3",symbol:"tPOTv3",decimals:14},rpcUrls:{default:{http:[PORTAL_RPC]}},testnet:true});
const bnbChain=defineChain({id:BNB_ID,name:"BNB Smart Chain Testnet",nativeCurrency:{name:"tBNB",symbol:"tBNB",decimals:18},rpcUrls:{default:{http:[BNB_RPC]}},blockExplorers:{default:{name:"BscScan Testnet",url:"https://testnet.bscscan.com"}},testnet:true});
const portalAbi=parseAbi([
 "function deposit(address destinationRecipient) payable returns (bytes32)",
 "event DepositInitiated(bytes32 indexed depositId,address indexed sender,address indexed destinationRecipient,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 nonce)",
 "event WithdrawalReleased(bytes32 indexed withdrawalId,address indexed recipient,uint256 amount)"
]);
const tokenAbi=parseAbi([
 "function balanceOf(address account) view returns (uint256)",
 "function approve(address spender,uint256 amount) returns (bool)"
]);
const faucetAbi=parseAbi(["function claim()"]);
const iswapAbi=parseAbi([
 "function token() view returns (address)",
 "function nativeRawPerWholePusd() view returns (uint256)",
 "function maxNativePerSwapRaw() view returns (uint256)",
 "function quoteNativeForPusd(uint256 pusdAmount) view returns (uint256)",
 "function quotePusdForNative(uint256 nativeAmountRaw) view returns (uint256)",
 "function swapPusdForNative(uint256 pusdAmount) returns (uint256)",
 "function swapNativeForPusd() payable returns (uint256)",
 "function fundNativeLiquidity() payable",
 "event SwappedPusdForNative(address indexed account,uint256 pusdIn,uint256 nativeOut)",
 "event SwappedNativeForPusd(address indexed account,uint256 nativeIn,uint256 pusdOut)"
]);
const gatewayAbi=parseAbi([
 "function balanceOf(address account) view returns (uint256)",
 "function bridgeBackedBalanceOf(address account) view returns (uint256)",
 "function totalBridgedIn() view returns (uint256)",
 "function totalWithdrawalRequested() view returns (uint256)",
 "function stockInfo(bytes32 stockSymbol) view returns (bool listed,uint256 pricePerShareTestUnits)",
 "function stockPositions(address account,bytes32 stockSymbol) view returns (uint256)",
 "function buyStock(bytes32 stockSymbol,uint256 shareUnits) returns (uint256 paymentAmount)",
 "function sellStock(bytes32 stockSymbol,uint256 shareUnits) returns (uint256 payoutAmount)",
 "function requestWithdrawal(uint256 amount,address portalRecipient) returns (bytes32)",
 "event DepositCompleted(bytes32 indexed depositId,address indexed recipient,uint256 amount,bytes32 indexed sourceTxHash,uint256 sourceLogIndex)",
 "event WithdrawalRequested(bytes32 indexed withdrawalId,address indexed sender,address indexed portalRecipient,uint256 amount,uint256 nonce)"
]);
const depositCompletedEvent=parseAbi(["event DepositCompleted(bytes32 indexed depositId,address indexed recipient,uint256 amount,bytes32 indexed sourceTxHash,uint256 sourceLogIndex)"])[0];
const withdrawalReleasedEvent=parseAbi(["event WithdrawalReleased(bytes32 indexed withdrawalId,address indexed recipient,uint256 amount)"])[0];
const STOCKS=[
 {symbol:"AAPL-TEST",label:"Apple (simulation)"},
 {symbol:"TSLA-TEST",label:"Tesla (simulation)"},
 {symbol:"NVDA-TEST",label:"NVIDIA (simulation)"},
 {symbol:"MSFT-TEST",label:"Microsoft (simulation)"}
] as const;
type Stock=typeof STOCKS[number]["symbol"];
function validAddress(v:string|undefined):Address|null{return v&&isAddress(v)?getAddress(v):null}
function provider():Provider{if(!window.ethereum)throw new Error("No injected EVM wallet was found.");return window.ethereum}
function chainFor(id:number){if(id===PORTAL_ID)return portalChain;if(id===BNB_ID)return bnbChain;throw new Error("Switch to PortalDOT V3 or BNB testnet.")}
function bytes32(v:string):Hex{return ("0x"+Array.from(new TextEncoder().encode(v),b=>b.toString(16).padStart(2,"0")).join("").padEnd(64,"0")) as Hex}
function errorText(e:unknown):string{if(typeof e==="object"&&e!==null&&"shortMessage" in e&&typeof e.shortMessage==="string")return e.shortMessage;return e instanceof Error?e.message:"Unknown wallet/network error."}
type DepositEvidence={depositId:Hex;amount:bigint;recipient:Address;sourceTxHash:Hash;destinationStartBlock:bigint;destinationTxHash?:Hash};
type ReturnEvidence={withdrawalId:Hex;amount:bigint;recipient:Address;sourceTxHash:Hash;sourceStartBlock:bigint;sourceTxHashReleased?:Hash};
function findEventArgs(abi:readonly unknown[], logs:readonly unknown[], name:string):Record<string,unknown>|null {
 for(const raw of logs){
  const log=raw as {data:Hex;topics:readonly Hex[]};
  try{const decoded:any=decodeEventLog({abi:abi as never,data:log.data,topics:log.topics as never,strict:false});if(decoded.eventName===name)return decoded.args as Record<string,unknown>}catch{}
 }
 return null;
}
type Props={language:LanguageCode;onLanguageChange:(v:LanguageCode)=>void;onOpenOverview:()=>void;onOpenTrade:()=>void};

export function CrossChainDemoPage({language,onLanguageChange,onOpenOverview,onOpenTrade}:Props){
 const t=textFor(language);
 const [account,setAccount]=useState<Address|null>(null),[chainId,setChainId]=useState<number|null>(null);
 const [nativeBalance,setNativeBalance]=useState("—"),[wrappedBalance,setWrappedBalance]=useState("—"),[backedBalance,setBackedBalance]=useState("—");
 const [pusdBalance,setPusdBalance]=useState("—"),[iswapPoolBalance,setIswapPoolBalance]=useState("—");
 const [stock,setStock]=useState<Stock>("AAPL-TEST"),[price,setPrice]=useState("—"),[position,setPosition]=useState("—");
 const [depositAmount,setDepositAmount]=useState("0.01"),[shareQty,setShareQty]=useState("0.001"),[withdrawAmount,setWithdrawAmount]=useState("0.01");
 const [pusdSwapAmount,setPusdSwapAmount]=useState("1000"),[nativeSwapAmount,setNativeSwapAmount]=useState("0.01");
 const [pendingDeposit,setPendingDeposit]=useState<DepositEvidence|null>(null),[pendingReturn,setPendingReturn]=useState<ReturnEvidence|null>(null);
 const [message,setMessage]=useState("Connect an EVM-compatible wallet to begin."),[tone,setTone]=useState<"info"|"success"|"error">("info");
 const [lastTx,setLastTx]=useState<{chainId:number;hash:Hash}|null>(null),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
 const isPortal=chainId===PORTAL_ID,isBnb=chainId===BNB_ID,stockKey=useMemo(()=>bytes32(stock),[stock]);
 const explorer=lastTx&&lastTx.chainId===BNB_ID?"https://testnet.bscscan.com/tx/"+lastTx.hash:null;
 const portalRead=createPublicClient({chain:portalChain,transport:http(PORTAL_RPC)});
 const bnbRead=createPublicClient({chain:bnbChain,transport:http(BNB_RPC)});
 const clients=useCallback((id:number)=>{const p=provider(),chain=chainFor(id);return {pub:createPublicClient({chain,transport:custom(p as never)}),wallet:createWalletClient({chain,transport:custom(p as never)})}},[]);
 async function assertRpcChain(expected:number){
  const actual=expected===PORTAL_ID?await portalRead.getChainId():await bnbRead.getChainId();
  if(actual!==expected)throw new Error("RPC chain ID mismatch: expected "+expected+", received "+actual+". No transaction should be treated as verified.");
 }
 const connect=useCallback(async()=>{const p=provider(),a=await p.request({method:"eth_requestAccounts"}),c=await p.request({method:"eth_chainId"});if(!Array.isArray(a)||typeof a[0]!=="string"||!isAddress(a[0]))throw new Error("Wallet returned no valid EVM account.");if(typeof c!=="string"||!/^0x[0-9a-f]+$/i.test(c))throw new Error("Wallet returned an invalid chain ID.");setAccount(getAddress(a[0]));setChainId(Number.parseInt(c,16));setMessage("Wallet connected. Confirm the testnet before sending transactions.");setTone("success")},[]);
 const run=useCallback(async(fn:()=>Promise<void>)=>{setBusy(true);setMessage("Waiting for wallet approval and transaction confirmation…");setTone("info");try{await fn()}catch(e){setMessage(errorText(e));setTone("error")}finally{setBusy(false)}},[]);
 const refresh=useCallback(async()=>{
  if(!account||(chainId!==PORTAL_ID&&chainId!==BNB_ID))return;
  setRefreshing(true);
  try{
   const {pub}=clients(chainId),native=await pub.getBalance({address:account});
   if(chainId===PORTAL_ID){
    setNativeBalance(formatTokenUnits(native,TOKEN_DECIMALS,4));
    setWrappedBalance("Switch to BNB testnet to view wtPOTv3");
    setBackedBalance("Switch to BNB testnet to view return eligibility");
    if(TOKEN){
     const bal=await pub.readContract({address:TOKEN,abi:tokenAbi,functionName:"balanceOf",args:[account]});
     setPusdBalance(formatUnits(bal,18));
    }else setPusdBalance("pUSD token not configured");
    if(ISWAP){
     const pool=await pub.getBalance({address:ISWAP});
     setIswapPoolBalance(formatTokenUnits(pool,TOKEN_DECIMALS,6));
    }else setIswapPoolBalance("iSwap not configured");
   }else{
    setNativeBalance(formatUnits(native,18));
    setPusdBalance("Switch to Portaldot to view pUSD");
    setIswapPoolBalance("Switch to Portaldot to view iSwap pool");
    if(!GATEWAY){setWrappedBalance("Gateway not configured");setBackedBalance("Gateway not configured");setPrice("—");setPosition("—")}
    else{
     const [bal,backed,info,held]=await Promise.all([
      pub.readContract({address:GATEWAY,abi:gatewayAbi,functionName:"balanceOf",args:[account]}),
      pub.readContract({address:GATEWAY,abi:gatewayAbi,functionName:"bridgeBackedBalanceOf",args:[account]}),
      pub.readContract({address:GATEWAY,abi:gatewayAbi,functionName:"stockInfo",args:[stockKey]}),
      pub.readContract({address:GATEWAY,abi:gatewayAbi,functionName:"stockPositions",args:[account,stockKey]})
     ]);
     setWrappedBalance(formatTokenUnits(bal,TOKEN_DECIMALS,4));setBackedBalance(formatTokenUnits(backed,TOKEN_DECIMALS,4));
     setPrice(info[0]?formatTokenUnits(info[1],TOKEN_DECIMALS,4):"Not listed");setPosition(formatUnits(held,SHARE_DECIMALS));
    }
   }
  }finally{setRefreshing(false)}
 },[account,chainId,clients,stockKey]); useEffect(()=>{const p=window.ethereum;if(!p)return;let active=true;const update=async()=>{const [a,c]=await Promise.all([p.request({method:"eth_accounts"}),p.request({method:"eth_chainId"})]);if(!active)return;setAccount(Array.isArray(a)&&typeof a[0]==="string"&&isAddress(a[0])?getAddress(a[0]):null);if(typeof c==="string"&&/^0x[0-9a-f]+$/i.test(c))setChainId(Number.parseInt(c,16))};const onA=(v:unknown)=>setAccount(Array.isArray(v)&&typeof v[0]==="string"&&isAddress(v[0])?getAddress(v[0]):null);const onC=(v:unknown)=>{if(typeof v==="string"&&/^0x[0-9a-f]+$/i.test(v))setChainId(Number.parseInt(v,16))};p.on?.("accountsChanged",onA);p.on?.("chainChanged",onC);void update().catch(()=>undefined);return()=>{active=false;p.removeListener?.("accountsChanged",onA);p.removeListener?.("chainChanged",onC)}},[]);
 useEffect(()=>{void refresh().catch(e=>{setMessage(errorText(e));setTone("error")})},[refresh]);
 async function switchNetwork(target:"portal"|"bnb"){const p=provider(),chain=target==="portal"?portalChain:bnbChain;try{await p.request({method:"wallet_switchEthereumChain",params:[{chainId:chainIdHex(chain.id)}]})}catch(e){if(!(typeof e==="object"&&e!==null&&"code" in e&&e.code===4902))throw e;await p.request({method:"wallet_addEthereumChain",params:[{chainId:chainIdHex(chain.id),chainName:chain.name,nativeCurrency:{name:chain.nativeCurrency.name,symbol:chain.nativeCurrency.symbol,decimals:chain.nativeCurrency.decimals},rpcUrls:[target==="portal"?PORTAL_RPC:BNB_RPC],...(target==="bnb"?{blockExplorerUrls:["https://testnet.bscscan.com"]}:{})}]})}const c=await p.request({method:"eth_chainId"});if(typeof c!=="string"||!/^0x[0-9a-f]+$/i.test(c))throw new Error("Wallet returned invalid chain ID.");setChainId(Number.parseInt(c,16));setMessage("Network changed. Refresh balance before the next action.");setTone("success")}
 async function deposit(){
  await assertRpcChain(PORTAL_ID);
  if(!account||chainId!==PORTAL_ID)throw new Error("Connect your wallet and switch to PortalDOT V3 testnet.");
  if(!ESCROW)throw new Error("Configure VITE_PASTX_PORTALDOT_ESCROW_ADDRESS after deployment.");
  if(!VALUE_CHECKED)throw new Error("Deposit locked until Portaldot EVM msg.value units have been independently verified.");
  if(!BRIDGE_MAX_RAW)throw new Error("Bridge deposit cap is not configured.");
  const value=parseDecimalUnits(depositAmount,TOKEN_DECIMALS);
  if(value!==BRIDGE_MAX_RAW)throw new Error("For the judge round trip, deposit exactly the configured capped amount ("+formatTokenUnits(BRIDGE_MAX_RAW,TOKEN_DECIMALS,8)+" tPOT).");
  const destinationStartBlock=(await bnbRead.getBlockNumber())+1n;
  const {wallet,pub}=clients(PORTAL_ID);
  const tx=await wallet.writeContract({account,address:ESCROW,abi:portalAbi,functionName:"deposit",args:[account],value});
  setLastTx({chainId:PORTAL_ID,hash:tx});
  const rec=await pub.waitForTransactionReceipt({hash:tx,confirmations:1});
  if(rec.status!=="success")throw new Error("Source deposit reverted: "+tx);
  const ev=findEventArgs(portalAbi,rec.logs,"DepositInitiated");
  if(!ev||typeof ev.depositId!=="string"||typeof ev.amount!=="bigint"||typeof ev.destinationRecipient!=="string")throw new Error("Source deposit is confirmed, but its DepositInitiated event could not be decoded.");
  if(ev.amount!==value||getAddress(ev.destinationRecipient)!==account)throw new Error("Source deposit event amount/recipient does not match the reviewed transaction.");
  setPendingDeposit({depositId:ev.depositId as Hex,amount:ev.amount,recipient:getAddress(ev.destinationRecipient),sourceTxHash:tx,destinationStartBlock});
  setMessage("Source deposit confirmed on Portaldot. Switch to BNB testnet and verify the matching DepositCompleted event before treating the bridge as complete.");setTone("success");await refresh();
 }
 async function claimDemoPusd(){
  await assertRpcChain(PORTAL_ID);
  if(!account||chainId!==PORTAL_ID)throw new Error("Connect your wallet and switch to Portaldot V3 testnet.");
  if(!FAUCET||!TOKEN)throw new Error("Configure the deployed PASTX pUSD token and faucet addresses.");
  const {wallet,pub}=clients(PORTAL_ID);
  const tx=await wallet.writeContract({account,address:FAUCET,abi:faucetAbi,functionName:"claim"});
  setLastTx({chainId:PORTAL_ID,hash:tx});
  const rec=await pub.waitForTransactionReceipt({hash:tx,confirmations:1});
  if(rec.status!=="success")throw new Error("pUSD faucet claim reverted: "+tx);
  setMessage("Confirmed on Portaldot: the pUSD faucet credited 1,000 demo tokens. They are not fiat or stablecoin value.");setTone("success");await refresh();
 }
 async function swapPusdForNative(){
  await assertRpcChain(PORTAL_ID);
  if(!account||chainId!==PORTAL_ID)throw new Error("Connect your wallet and switch to Portaldot V3 testnet.");
  if(!TOKEN||!ISWAP)throw new Error("Configure the deployed pUSD token and iSwap contract.");
  if(!VALUE_CHECKED)throw new Error("iSwap locked until Portaldot EVM msg.value units are independently verified.");
  const amount=parseDecimalUnits(pusdSwapAmount,18);
  const {wallet,pub}=clients(PORTAL_ID);
  const quote=await pub.readContract({address:ISWAP,abi:iswapAbi,functionName:"quoteNativeForPusd",args:[amount]});
  const cap=await pub.readContract({address:ISWAP,abi:iswapAbi,functionName:"maxNativePerSwapRaw"});
  if(quote===0n||quote>cap)throw new Error("This pUSD amount exceeds the iSwap per-transaction cap. Use a maximum of 1,000 pUSD for the judge route.");
  const approveTx=await wallet.writeContract({account,address:TOKEN,abi:tokenAbi,functionName:"approve",args:[ISWAP,amount]});
  const approveReceipt=await pub.waitForTransactionReceipt({hash:approveTx,confirmations:1});
  if(approveReceipt.status!=="success")throw new Error("iSwap approval failed: "+approveTx);
  const tx=await wallet.writeContract({account,address:ISWAP,abi:iswapAbi,functionName:"swapPusdForNative",args:[amount]});
  setLastTx({chainId:PORTAL_ID,hash:tx});
  const rec=await pub.waitForTransactionReceipt({hash:tx,confirmations:1});
  if(rec.status!=="success")throw new Error("iSwap pUSD-to-tPOT swap reverted: "+tx);
  setMessage("iSwap confirmed on Portaldot: "+formatUnits(amount,18)+" pUSD was burned and "+formatTokenUnits(quote,TOKEN_DECIMALS,8)+" tPOT was paid from the funded test pool.");setTone("success");await refresh();
 }
 async function swapNativeForPusd(){
  await assertRpcChain(PORTAL_ID);
  if(!account||chainId!==PORTAL_ID)throw new Error("Connect your wallet and switch to Portaldot V3 testnet.");
  if(!TOKEN||!ISWAP)throw new Error("Configure the deployed pUSD token and iSwap contract.");
  if(!VALUE_CHECKED)throw new Error("iSwap locked until Portaldot EVM msg.value units are independently verified.");
  const value=parseDecimalUnits(nativeSwapAmount,TOKEN_DECIMALS);
  const {wallet,pub}=clients(PORTAL_ID);
  const cap=await pub.readContract({address:ISWAP,abi:iswapAbi,functionName:"maxNativePerSwapRaw"});
  if(value>cap)throw new Error("This native input exceeds the iSwap per-transaction cap.");
  const quote=await pub.readContract({address:ISWAP,abi:iswapAbi,functionName:"quotePusdForNative",args:[value]});
  if(quote===0n)throw new Error("The native amount rounds to zero pUSD.");
  const tx=await wallet.writeContract({account,address:ISWAP,abi:iswapAbi,functionName:"swapNativeForPusd",value});
  setLastTx({chainId:PORTAL_ID,hash:tx});
  const rec=await pub.waitForTransactionReceipt({hash:tx,confirmations:1});
  if(rec.status!=="success")throw new Error("iSwap native-to-pUSD swap reverted: "+tx);
  setMessage("iSwap confirmed on Portaldot: "+formatTokenUnits(value,TOKEN_DECIMALS,8)+" tPOT entered the pool and "+formatUnits(quote,18)+" pUSD was minted.");setTone("success");await refresh();
 }
 async function verifyBnbArrival(){
  await assertRpcChain(BNB_ID);
  if(!account||chainId!==BNB_ID)throw new Error("Switch the connected wallet to BNB testnet before verifying the destination.");
  if(!GATEWAY||!pendingDeposit)throw new Error("No pending source deposit or BNB gateway is configured.");
  const logs=await bnbRead.getLogs({address:GATEWAY,event:depositCompletedEvent,args:{depositId:pendingDeposit.depositId},fromBlock:pendingDeposit.destinationStartBlock,toBlock:"latest"});
  const log=logs.find(item=>item.args.depositId?.toLowerCase()===pendingDeposit.depositId.toLowerCase());
  if(!log)throw new Error("No matching DepositCompleted event is visible on BNB testnet yet. Ensure the trusted relayer is running, then retry.");
  if(log.args.depositId===undefined||log.args.amount===undefined||log.args.recipient===undefined||log.args.sourceTxHash===undefined)throw new Error("BNB destination event is missing required verification fields.");
  if(log.args.amount!==pendingDeposit.amount||getAddress(log.args.recipient)!==pendingDeposit.recipient)throw new Error("BNB destination event does not match the source deposit amount/recipient.");
  if(log.args.sourceTxHash.toLowerCase()!==pendingDeposit.sourceTxHash.toLowerCase())throw new Error("BNB destination event does not reference the exact confirmed Portaldot source transaction.");
  const receipt=await bnbRead.getTransactionReceipt({hash:log.transactionHash});
  if(receipt.status!=="success")throw new Error("BNB destination transaction did not succeed.");
  const balance=await bnbRead.readContract({address:GATEWAY,abi:gatewayAbi,functionName:"balanceOf",args:[pendingDeposit.recipient]});
  setPendingDeposit({...pendingDeposit,destinationTxHash:log.transactionHash});
  setLastTx({chainId:BNB_ID,hash:log.transactionHash});
  setMessage("iBridge verified on BNB testnet (chain ID 97): DepositCompleted event and successful destination receipt match the source deposit. Current wtPOTv3 balance: "+formatTokenUnits(balance,TOKEN_DECIMALS,8)+".");setTone("success");await refresh();
 }
 async function trade(side:"buy"|"sell"){
  await assertRpcChain(BNB_ID);if(!account||chainId!==BNB_ID)throw new Error("Connect your wallet and switch to BNB testnet.");if(!GATEWAY)throw new Error("Configure VITE_PASTX_BNB_GATEWAY_ADDRESS after deployment.");const quantity=parseDecimalUnits(shareQty,SHARE_DECIMALS),{wallet,pub}=clients(BNB_ID);const tx=await wallet.writeContract({account,address:GATEWAY,abi:gatewayAbi,functionName:side==="buy"?"buyStock":"sellStock",args:[stockKey,quantity]});setLastTx({chainId:BNB_ID,hash:tx});const rec=await pub.waitForTransactionReceipt({hash:tx,confirmations:1});if(rec.status!=="success")throw new Error("Mock stock transaction reverted: "+tx);setMessage("Mock "+side+" confirmed. This is simulated stock exposure only.");setTone("success");await refresh()}
 async function withdraw(){
  await assertRpcChain(BNB_ID);
  if(!account||chainId!==BNB_ID)throw new Error("Connect your wallet and switch to BNB testnet.");
  if(!GATEWAY)throw new Error("Configure VITE_PASTX_BNB_GATEWAY_ADDRESS after deployment.");
  const amount=parseDecimalUnits(withdrawAmount,TOKEN_DECIMALS);
  const sourceStartBlock=(await portalRead.getBlockNumber())+1n;
  const {wallet,pub}=clients(BNB_ID);
  const [backed,totalIn,totalOut]=await Promise.all([
   pub.readContract({address:GATEWAY,abi:gatewayAbi,functionName:"bridgeBackedBalanceOf",args:[account]}),
   pub.readContract({address:GATEWAY,abi:gatewayAbi,functionName:"totalBridgedIn"}),
   pub.readContract({address:GATEWAY,abi:gatewayAbi,functionName:"totalWithdrawalRequested"})
  ]);
  if(amount>backed)throw new Error("Only "+formatTokenUnits(backed,TOKEN_DECIMALS,8)+" wtPOTv3 of this account’s balance is bridge-backed and eligible for return.");
  if(totalOut+amount>totalIn)throw new Error("This amount exceeds the aggregate bridge-backed withdrawal limit.");
  const tx=await wallet.writeContract({account,address:GATEWAY,abi:gatewayAbi,functionName:"requestWithdrawal",args:[amount,account]});
  setLastTx({chainId:BNB_ID,hash:tx});
  const rec=await pub.waitForTransactionReceipt({hash:tx,confirmations:1});
  if(rec.status!=="success")throw new Error("Withdrawal request reverted: "+tx);
  const ev=findEventArgs(gatewayAbi,rec.logs,"WithdrawalRequested");
  if(!ev||typeof ev.withdrawalId!=="string"||typeof ev.amount!=="bigint"||typeof ev.portalRecipient!=="string")throw new Error("Withdrawal request confirmed, but its event could not be decoded.");
  if(ev.amount!==amount||getAddress(ev.portalRecipient)!==account)throw new Error("Withdrawal request event amount/recipient did not match the reviewed transaction.");
  setPendingReturn({withdrawalId:ev.withdrawalId as Hex,amount:ev.amount,recipient:getAddress(ev.portalRecipient),sourceTxHash:tx,sourceStartBlock});
  setMessage("Return request confirmed on BNB. Switch to Portaldot and verify the matching WithdrawalReleased event before treating the round trip as complete.");setTone("success");await refresh();
 }
 async function verifyPortalReturn(){
  await assertRpcChain(PORTAL_ID);
  if(!account||chainId!==PORTAL_ID)throw new Error("Switch the connected wallet to Portaldot V3 before verifying the return.");
  if(!ESCROW||!pendingReturn)throw new Error("No pending BNB withdrawal or Portaldot escrow is configured.");
  const logs=await portalRead.getLogs({address:ESCROW,event:withdrawalReleasedEvent,args:{withdrawalId:pendingReturn.withdrawalId},fromBlock:pendingReturn.sourceStartBlock,toBlock:"latest"});
  const log=logs.find(item=>item.args.withdrawalId?.toLowerCase()===pendingReturn.withdrawalId.toLowerCase());
  if(!log)throw new Error("No matching WithdrawalReleased event is visible on Portaldot yet. Ensure the trusted relayer is running, then retry.");
  if(log.args.withdrawalId===undefined||log.args.amount===undefined||log.args.recipient===undefined)throw new Error("Portaldot release event is missing required verification fields.");
  if(log.args.amount!==pendingReturn.amount||getAddress(log.args.recipient)!==pendingReturn.recipient)throw new Error("Portaldot release event does not match the BNB withdrawal amount/recipient.");
  const receipt=await portalRead.getTransactionReceipt({hash:log.transactionHash});
  if(receipt.status!=="success")throw new Error("Portaldot release transaction did not succeed.");
  const balance=await portalRead.getBalance({address:pendingReturn.recipient});
  setPendingReturn({...pendingReturn,sourceTxHashReleased:log.transactionHash});
  setLastTx({chainId:PORTAL_ID,hash:log.transactionHash});
  setMessage("iBridge round trip verified on Portaldot: the successful WithdrawalReleased event returned "+formatTokenUnits(log.args.amount,TOKEN_DECIMALS,8)+" tPOT to the wallet. Current EVM-mapped balance: "+formatTokenUnits(balance,TOKEN_DECIMALS,8)+".");setTone("success");await refresh();
 }
 return <div className="app-shell">
  <header className="site-header"><a className="brand" href="#cross-chain" aria-label="PASTX overview" onClick={e=>{e.preventDefault();onOpenOverview()}}><span className="brand-mark"><ArrowDownUp size={21}/></span><span className="brand-word">PAST<span>X</span><small>TESTNET BRIDGE</small></span></a><nav className="top-nav" aria-label="Main navigation"><button className="top-nav-item" onClick={onOpenOverview}><ArrowLeft size={15}/>{t.overview}</button><button className="top-nav-item" onClick={onOpenTrade}>Trade terminal</button><button className="top-nav-item active" aria-current="page"><ArrowDownUp size={15}/>Cross-chain demo</button></nav><div className="header-actions"><span className="network-status"><span className="network-dot neutral"/><span className="network-label">Mode</span><strong>TESTNET</strong></span><LanguageSwitcher language={language} onChange={onLanguageChange} text={t}/><button className="wallet-button" disabled={!window.ethereum||busy} onClick={()=>{void run(connect)}}><Wallet size={15}/>{account?account.slice(0,6)+"…"+account.slice(-4):"Connect wallet"}</button></div></header>
  <main className="page-container cross-chain-page" id="cross-chain">
   <div className="page-meta"><span>PASTX <span className="meta-slash">/</span> CROSS-CHAIN</span><span className="meta-right">PORTALDOT V3 <span className="meta-slash">/</span> BNB TESTNET</span></div>
   <section className="cross-chain-intro"><div><span className="eyebrow">CROSS-CHAIN PROTOTYPE</span><h1>Move test value.<br/><span>Trade test stocks.</span></h1><p>Demo PASTX across PortalDOT V3 and BNB Smart Chain testnet. This prototype uses a trusted relayer and mock stock instruments; it is not an official bridge or real stock market. wtPOTv3 is a test representation, not native tBNB or USDT.</p></div><div className="cross-chain-status-card"><span className="cross-chain-status-title"><ShieldAlert size={15}/>Prototype status</span><strong>{ESCROW&&GATEWAY?"Contracts configured":"Awaiting deployment addresses"}</strong><p>{ESCROW&&GATEWAY?"Confirm both network IDs and addresses before sending test transactions.":"Deploy the testnet contracts and set public VITE_PASTX_* addresses to enable on-chain actions."}</p><div className="cross-chain-config-row"><span>PortalDOT source</span><code>{ESCROW?ESCROW.slice(0,8)+"…"+ESCROW.slice(-5):"Not configured"}</code></div><div className="cross-chain-config-row"><span>BNB gateway</span><code>{GATEWAY?GATEWAY.slice(0,8)+"…"+GATEWAY.slice(-5):"Not configured"}</code></div></div></section>
   <section className="cross-chain-flow" aria-label="Cross-chain flow"><article className={"cross-chain-step"+(isPortal?" current":"")}><span className="cross-chain-step-number">01</span><span className="cross-chain-step-icon"><Wallet size={19}/></span><h2>PortalDOT V3</h2><p>Initiate a wallet-signed source test deposit.</p><div className="cross-chain-step-meta"><span>Chain ID</span><code>420420777</code></div><div className="cross-chain-step-meta"><span>Native balance</span><strong>{isPortal?nativeBalance:"Switch network to read"}</strong></div><button className="cross-chain-secondary-button" disabled={!account||busy} onClick={()=>{void run(()=>switchNetwork("portal"))}}>Switch to PortalDOT <ArrowRight size={14}/></button></article><div className="cross-chain-flow-connector"><ArrowDownUp size={18}/><span>Trusted testnet relayer</span></div><article className={"cross-chain-step"+(isBnb?" current":"")}><span className="cross-chain-step-number">02</span><span className="cross-chain-step-icon"><ArrowDownUp size={19}/></span><h2>BNB testnet</h2><p>Receive a test representation after relay processing.</p><div className="cross-chain-step-meta"><span>Chain ID</span><code>97</code></div><div className="cross-chain-step-meta"><span>wtPOTv3 balance</span><strong>{isBnb?wrappedBalance:"Switch network to read"}</strong></div><button className="cross-chain-secondary-button" disabled={!account||busy} onClick={()=>{void run(()=>switchNetwork("bnb"))}}>Switch to BNB testnet <ArrowRight size={14}/></button></article></section>
   <div className={"cross-chain-message "+tone} role="status" aria-live="polite">{tone==="success"?<CheckCircle2 size={17}/>:tone==="error"?<CircleAlert size={17}/>:<ShieldAlert size={17}/>}<div><strong>Transaction status</strong><p>{message}</p>{lastTx&&<code className="cross-chain-tx-hash">{lastTx.hash}</code>}{explorer&&<a href={explorer} target="_blank" rel="noreferrer">View BNB testnet transaction <ExternalLink size={12}/></a>}{lastTx&&lastTx.chainId===PORTAL_ID&&<a href="https://node-console.portaldot.dev/" target="_blank" rel="noreferrer">Open Portaldot node console; use the hash above <ExternalLink size={12}/></a>}</div></div>
   <div className="cross-chain-toolbar"><div className="cross-chain-button-row"><button className="cross-chain-secondary-button" disabled={!account||busy||refreshing} onClick={()=>{void run(refresh)}}>{refreshing?<LoaderCircle size={14}/>:null}Refresh current-chain balances</button>{pendingDeposit&&!pendingDeposit.destinationTxHash&&isBnb&&<button className="cross-chain-primary-button" disabled={busy} onClick={()=>{void run(verifyBnbArrival)}}>Verify wtPOTv3 arrived</button>}{pendingReturn&&!pendingReturn.sourceTxHashReleased&&isPortal&&<button className="cross-chain-primary-button" disabled={busy} onClick={()=>{void run(verifyPortalReturn)}}>Verify tPOT returned</button>}</div><span>{chainId?"Connected chain ID: "+chainId:"No wallet network connected"}{pendingDeposit?.destinationTxHash?" · BNB deposit event verified":""}{pendingReturn?.sourceTxHashReleased?" · Portaldot return event verified":""}</span></div>
   {(pendingDeposit||pendingReturn)&&<section className="cross-chain-evidence-card" aria-live="polite"><div className="cross-chain-evidence-head"><div><span className="eyebrow">ON-CHAIN EVIDENCE</span><h2>Bridge transaction trail</h2><p>Statuses below are based on receipts and matching contract events fetched from each chain's RPC.</p></div><span className="cross-chain-evidence-state">{pendingReturn?.sourceTxHashReleased?"ROUND TRIP VERIFIED":pendingDeposit?.destinationTxHash?"DEPOSIT VERIFIED ON BNB":"WAITING FOR DESTINATION PROOF"}</span></div><div className="cross-chain-evidence-grid">{pendingDeposit&&<><div><span>1 · Portaldot source deposit</span><strong>{pendingDeposit.sourceTxHash?"Confirmed":"Pending"}</strong><code>{pendingDeposit.sourceTxHash}</code></div><div><span>2 · BNB wtPOTv3 mint</span><strong>{pendingDeposit.destinationTxHash?"Receipt confirmed":"Awaiting matching event"}</strong><code>{pendingDeposit.destinationTxHash||"Switch to BNB testnet and verify arrival"}</code></div></>}{pendingReturn&&<><div><span>3 · BNB return request / burn</span><strong>{pendingReturn.sourceTxHash?"Confirmed":"Pending"}</strong><code>{pendingReturn.sourceTxHash}</code></div><div><span>4 · Portaldot tPOT release</span><strong>{pendingReturn.sourceTxHashReleased?"Receipt confirmed":"Awaiting matching event"}</strong><code>{pendingReturn.sourceTxHashReleased||"Switch to Portaldot and verify return"}</code></div></>}</div><p className="cross-chain-evidence-note">A tx hash alone is not proof of a completed bridge. A leg becomes verified here only after the expected event fields and a successful receipt match.</p></section>}
   <section className="cross-chain-actions-grid">
    <article className="cross-chain-action-card"><span className="eyebrow">SOURCE → DESTINATION</span><h2>Deposit test value</h2><p>The capped source escrow emits an event. Verify the matching destination receipt on BNB testnet after the trusted relayer processes it.</p><label htmlFor="cross-chain-deposit">Amount in tPOTv3 display units</label><input id="cross-chain-deposit" inputMode="decimal" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} disabled={busy}/><button className="cross-chain-primary-button" disabled={busy||!account||!ESCROW||!isPortal||!VALUE_CHECKED} onClick={()=>{void run(deposit)}}>{busy?<LoaderCircle size={15}/>:<ArrowDownUp size={15}/>}Initiate test deposit</button>{!VALUE_CHECKED&&<p className="cross-chain-gate-note">Locked until a small manual test verifies V3 tPOTv3 EVM value/decimal semantics. Keep VITE_PASTX_SOURCE_VALUE_SEMANTICS_VERIFIED=false until confirmed.</p>}{!ESCROW&&<p className="cross-chain-gate-note">Source escrow address is not configured; no transaction can be sent.</p>}</article>
    <article className="cross-chain-action-card"><span className="eyebrow">DESTINATION MARKET</span><h2>Trade mock stocks</h2><p>Simulated prices and liquidity only; these are not live quotes or official tokenized shares.</p><label htmlFor="cross-chain-stock">Stock instrument</label><select id="cross-chain-stock" value={stock} disabled={busy} onChange={e=>setStock(e.target.value as Stock)}>{STOCKS.map(item=><option key={item.symbol} value={item.symbol}>{item.label}</option>)}</select><div className="cross-chain-market-stats"><div><span>Demo price / share</span><strong>{price} wtPOTv3</strong></div><div><span>Your position</span><strong>{position} shares</strong></div><div><span>Your wtPOTv3</span><strong>{isBnb?wrappedBalance:"Switch to BNB testnet"}</strong></div></div><label htmlFor="cross-chain-quantity">Share quantity (fractional)</label><input id="cross-chain-quantity" inputMode="decimal" value={shareQty} disabled={busy} onChange={e=>setShareQty(e.target.value)}/><div className="cross-chain-button-row"><button className="cross-chain-primary-button" disabled={busy||!account||!GATEWAY||!isBnb} onClick={()=>{void run(()=>trade("buy"))}}>Buy test stock</button><button className="cross-chain-secondary-button" disabled={busy||!account||!GATEWAY||!isBnb} onClick={()=>{void run(()=>trade("sell"))}}>Sell test stock</button></div>{!GATEWAY&&<p className="cross-chain-gate-note">BNB gateway is not configured; no trade can be sent.</p>}</article>
    <article className="cross-chain-action-card"><span className="eyebrow">DESTINATION → SOURCE</span><h2>Return test value</h2><p>Burn wtPOTv3 and request a source release. The UI can verify the matching WithdrawalReleased event and its successful Portaldot transaction.</p><div className="cross-chain-return-eligible"><span>Eligible to return</span><strong>{isBnb ? backedBalance : "Switch to BNB testnet" } wtPOTv3</strong></div><label htmlFor="cross-chain-withdraw">Amount in wtPOTv3 display units</label><input id="cross-chain-withdraw" inputMode="decimal" value={withdrawAmount} disabled={busy} onChange={e=>setWithdrawAmount(e.target.value)}/><button className="cross-chain-secondary-button" disabled={busy||!account||!GATEWAY||!isBnb} onClick={()=>{void run(withdraw)}}>Request return to PortalDOT <ArrowRight size={14}/></button></article>
    <article className="cross-chain-action-card"><span className="eyebrow">iSWAP · PORTALDOT</span><h2>Swap pUSD ↔ tPOT</h2><p>Claim demo pUSD, then exchange it at the configured fixed rate against a tiny, funded native-value pool. pUSD is not fiat-redeemable; payouts stop when the pool is empty.</p><div className="cross-chain-market-stats"><div><span>Your pUSD balance</span><strong>{isPortal?pusdBalance:"Switch to Portaldot"}</strong></div><div><span>iSwap pool</span><strong>{isPortal?iswapPoolBalance+" tPOT":"Switch to Portaldot"}</strong></div><div><span>Per-swap cap</span><strong>{BRIDGE_MAX_RAW?formatTokenUnits(BRIDGE_MAX_RAW,TOKEN_DECIMALS,6)+" tPOT":"Not configured"}</strong></div></div><label htmlFor="iswap-pusd-amount">pUSD to swap for tPOT</label><input id="iswap-pusd-amount" inputMode="decimal" value={pusdSwapAmount} onChange={e=>setPusdSwapAmount(e.target.value)} disabled={busy}/><div className="cross-chain-button-row"><button className="cross-chain-secondary-button" disabled={busy||!account||!FAUCET||!isPortal} onClick={()=>{void run(claimDemoPusd)}}>Claim 1,000 pUSD</button><button className="cross-chain-primary-button" disabled={busy||!account||!TOKEN||!ISWAP||!isPortal||!VALUE_CHECKED} onClick={()=>{void run(swapPusdForNative)}}>Swap pUSD → tPOT</button></div><label htmlFor="iswap-native-amount">tPOT to swap into pUSD</label><input id="iswap-native-amount" inputMode="decimal" value={nativeSwapAmount} onChange={e=>setNativeSwapAmount(e.target.value)} disabled={busy}/><button className="cross-chain-secondary-button" disabled={busy||!account||!TOKEN||!ISWAP||!isPortal||!VALUE_CHECKED} onClick={()=>{void run(swapNativeForPusd)}}>Swap tPOT → pUSD</button>{(!TOKEN||!FAUCET||!ISWAP)&&<p className="cross-chain-gate-note">The iSwap is unavailable until the pUSD, faucet and iSwap deployment addresses are configured.</p>}{!VALUE_CHECKED&&<p className="cross-chain-gate-note">Swaps stay locked until raw Portaldot EVM native-value units are independently verified.</p>}</article>
   </section>
   <section className="cross-chain-disclaimer"><ShieldAlert size={17}/><div><strong>Testnet only — read before using</strong><p>Use tPOTv3 and faucet test BNB only. wtPOTv3 and *-TEST instruments have no redeemable value. A trusted relayer attests to source events; no on-chain light-client proof is verified. Mock-market gains are not cross-chain redeemable. Never use mainnet keys or valuable funds.</p></div></section>
  </main>
  <footer className="site-footer"><a className="footer-brand" href="#cross-chain" onClick={e=>{e.preventDefault();onOpenOverview()}}><span className="brand-mark"><ArrowDownUp size={19}/></span><span>PAST<span>X</span><small>ASSET EXCHANGE</small></span></a><span className="footer-tagline">Cross-chain RWA access prototype.</span><div className="footer-links"><a href="https://github.com/Investorquab/PASTX#readme" target="_blank" rel="noreferrer">{t.documentation} <ExternalLink size={12}/></a><a href="https://github.com/Investorquab/PASTX" target="_blank" rel="noreferrer">GitHub <ExternalLink size={12}/></a></div><span className="footer-copy">© 2026 PASTX · TESTNET PROTOTYPE</span></footer>
 </div>
}
