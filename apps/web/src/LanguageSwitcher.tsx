import {useState} from "react";
import {ChevronDown,Globe} from "lucide-react";
import {languageNames,type LanguageCode,type TranslationText} from "./i18n";
export function LanguageSwitcher({language,onChange,text}:{language:LanguageCode;onChange:(language:LanguageCode)=>void;text:TranslationText}) {
 const [open,setOpen]=useState(false);
 return <div className="language-control"><button className="language-button" type="button" aria-label={text.chooseLanguage} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Globe size={14}/>{language.toUpperCase()}<ChevronDown size={11}/></button>
 {open&&<div className="language-menu" role="menu">{(Object.keys(languageNames) as LanguageCode[]).map(code=><button key={code} type="button" role="menuitem" className={language===code?"selected":""} onClick={()=>{onChange(code);setOpen(false);}}><span>{languageNames[code]}</span><span className="language-code">{code.toUpperCase()}</span></button>)}</div>}</div>;
}