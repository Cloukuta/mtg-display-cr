"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type Country={code:string;name:string;dial:string;flag:string};

const COUNTRIES:Country[]=[
 {code:"CR",name:"Costa Rica",dial:"506",flag:"🇨🇷"},{code:"US",name:"United States",dial:"1",flag:"🇺🇸"},{code:"CA",name:"Canada",dial:"1",flag:"🇨🇦"},{code:"MX",name:"México",dial:"52",flag:"🇲🇽"},{code:"PA",name:"Panamá",dial:"507",flag:"🇵🇦"},{code:"NI",name:"Nicaragua",dial:"505",flag:"🇳🇮"},{code:"HN",name:"Honduras",dial:"504",flag:"🇭🇳"},{code:"SV",name:"El Salvador",dial:"503",flag:"🇸🇻"},{code:"GT",name:"Guatemala",dial:"502",flag:"🇬🇹"},{code:"BZ",name:"Belize",dial:"501",flag:"🇧🇿"},{code:"CO",name:"Colombia",dial:"57",flag:"🇨🇴"},{code:"VE",name:"Venezuela",dial:"58",flag:"🇻🇪"},{code:"EC",name:"Ecuador",dial:"593",flag:"🇪🇨"},{code:"PE",name:"Perú",dial:"51",flag:"🇵🇪"},{code:"BR",name:"Brasil",dial:"55",flag:"🇧🇷"},{code:"AR",name:"Argentina",dial:"54",flag:"🇦🇷"},{code:"CL",name:"Chile",dial:"56",flag:"🇨🇱"},{code:"UY",name:"Uruguay",dial:"598",flag:"🇺🇾"},{code:"PY",name:"Paraguay",dial:"595",flag:"🇵🇾"},{code:"BO",name:"Bolivia",dial:"591",flag:"🇧🇴"},{code:"DO",name:"República Dominicana",dial:"1",flag:"🇩🇴"},{code:"PR",name:"Puerto Rico",dial:"1",flag:"🇵🇷"},{code:"CU",name:"Cuba",dial:"53",flag:"🇨🇺"},{code:"ES",name:"España",dial:"34",flag:"🇪🇸"},{code:"GB",name:"United Kingdom",dial:"44",flag:"🇬🇧"},{code:"FR",name:"France",dial:"33",flag:"🇫🇷"},{code:"DE",name:"Deutschland",dial:"49",flag:"🇩🇪"},{code:"IT",name:"Italia",dial:"39",flag:"🇮🇹"},{code:"PT",name:"Portugal",dial:"351",flag:"🇵🇹"},{code:"NL",name:"Nederland",dial:"31",flag:"🇳🇱"},{code:"CH",name:"Schweiz",dial:"41",flag:"🇨🇭"},{code:"JP",name:"日本",dial:"81",flag:"🇯🇵"},{code:"KR",name:"대한민국",dial:"82",flag:"🇰🇷"},{code:"CN",name:"中国",dial:"86",flag:"🇨🇳"},{code:"IN",name:"India (भारत)",dial:"91",flag:"🇮🇳"},{code:"AU",name:"Australia",dial:"61",flag:"🇦🇺"},{code:"NZ",name:"New Zealand",dial:"64",flag:"🇳🇿"}
];

function parse(value:string){
 const digits=value.replace(/\D/g,"");
 if(!digits)return {country:COUNTRIES[0],local:""};
 const candidates=COUNTRIES.filter(c=>digits.startsWith(c.dial)).sort((a,b)=>b.dial.length-a.dial.length);
 const country=candidates[0]||COUNTRIES[0];
 return {country,local:digits.startsWith(country.dial)?digits.slice(country.dial.length):digits};
}
function pretty(digits:string){return digits.replace(/\D/g,"").replace(/(.{4})/g,"$1 ").trim();}

export default function InternationalPhoneInput({value,onChange,placeholder="8888 8888",ariaLabel}:{value:string;onChange:(value:string)=>void;placeholder?:string;ariaLabel?:string}){
 const initial=useMemo(()=>parse(value),[]);
 const [country,setCountry]=useState(initial.country),[local,setLocal]=useState(initial.local),[open,setOpen]=useState(false),[query,setQuery]=useState("");
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const p=parse(value);if(value&&(`+${country.dial}${local}`!==value&&`${country.dial}${local}`!==value)){setCountry(p.country);setLocal(p.local)}},[value]);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 const filtered=COUNTRIES.filter(c=>`${c.name} ${c.dial}`.toLowerCase().includes(query.toLowerCase()));
 function choose(c:Country){setCountry(c);setOpen(false);setQuery("");onChange(local?`+${c.dial}${local}`:"")}
 function change(raw:string){const next=raw.replace(/\D/g,"").slice(0,15-country.dial.length);setLocal(next);onChange(next?`+${country.dial}${next}`:"")}
 return <div ref={root} className="relative">
  <div className="flex h-11 overflow-visible rounded-xl border border-border bg-background focus-within:border-primary">
   <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} className="flex shrink-0 items-center gap-2 rounded-l-xl border-r border-border px-3 text-foreground hover:bg-secondary/40"><span className="text-lg leading-none">{country.flag}</span><span className="text-xs text-muted-foreground">+{country.dial}</span><ChevronDown size={14}/></button>
   <input aria-label={ariaLabel} inputMode="tel" autoComplete="tel" value={pretty(local)} onChange={e=>change(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 text-foreground outline-none"/>
  </div>
  {open&&<div className="absolute left-0 top-12 z-50 w-full min-w-[300px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:w-[390px]">
   <div className="border-b border-border p-2"><div className="flex h-9 items-center gap-2 rounded-lg bg-background px-3"><Search size={15} className="text-muted-foreground"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search country or code..." className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></div></div>
   <div className="max-h-64 overflow-y-auto p-1">{filtered.map(c=><button key={c.code} type="button" onClick={()=>choose(c)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary/50"><span className="text-lg">{c.flag}</span><span className="min-w-0 flex-1 truncate">{c.name}</span><span className="text-muted-foreground">+{c.dial}</span>{country.code===c.code&&<Check size={15} className="text-primary"/>}</button>)}</div>
  </div>}
 </div>
}
