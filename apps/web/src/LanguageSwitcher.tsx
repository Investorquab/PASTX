import {useEffect,useRef,useState} from "react";
import {ChevronDown,Globe} from "lucide-react";
import {languageNames,type LanguageCode,type TranslationText} from "./i18n";

export function LanguageSwitcher({language,onChange,text}:{language:LanguageCode;onChange:(language:LanguageCode)=>void;text:TranslationText}) {
 const [open,setOpen]=useState(false);
 const controlRef=useRef<HTMLDivElement>(null);
 const triggerRef=useRef<HTMLButtonElement>(null);

 useEffect(()=>{
  if(!open) return;
  const closeOnOutsidePointer=(event:PointerEvent)=>{
   const target=event.target;
   if(target instanceof Node&&!controlRef.current?.contains(target)) setOpen(false);
  };
  const closeOnOutsideFocus=(event:FocusEvent)=>{
   const target=event.target;
   if(target instanceof Node&&!controlRef.current?.contains(target)) setOpen(false);
  };
  const closeOnEscape=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){
    setOpen(false);
    triggerRef.current?.focus();
   }
  };
  document.addEventListener("pointerdown",closeOnOutsidePointer);
  document.addEventListener("focusin",closeOnOutsideFocus);
  document.addEventListener("keydown",closeOnEscape);
  return()=>{
   document.removeEventListener("pointerdown",closeOnOutsidePointer);
   document.removeEventListener("focusin",closeOnOutsideFocus);
   document.removeEventListener("keydown",closeOnEscape);
  };
 },[open]);

 return <div className="language-control" ref={controlRef}>
  <button ref={triggerRef} className="language-button" type="button" aria-label={text.chooseLanguage} aria-haspopup="menu" aria-expanded={open} aria-controls="pastx-language-menu" onClick={()=>setOpen(v=>!v)}>
   <Globe size={14}/><span>{language.toUpperCase()}</span><ChevronDown size={11}/>
  </button>
  {open&&<div className="language-menu" id="pastx-language-menu" role="menu" aria-label={text.chooseLanguage}>
   {(Object.keys(languageNames) as LanguageCode[]).map(code=><button key={code} type="button" role="menuitemradio" aria-checked={language===code} className={language===code?"selected":""} onClick={()=>{onChange(code);setOpen(false);triggerRef.current?.focus();}}>
    <span>{languageNames[code]}</span><span className="language-code">{code.toUpperCase()}</span>
   </button>)}
  </div>}
 </div>;
}
