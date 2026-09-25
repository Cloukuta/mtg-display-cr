"use client";

import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {getRememberedMarketPriceUsd} from "@/lib/visual-pricing";

type PricingMode="default"|"custom"|"discount";
type PriceSource="cardkingdom"|"tcgplayer"|null;

type Props={
  priceCrc:number|null;
  pricingMode:PricingMode;
  referenceCrc?:number|null;
  marketPriceUsd?:number|null;
  discountPercent?:number|null;
  pendingLabel?:string;
  referenceLabel?:string;
  customLabel?:string;
  source?:PriceSource;
  compact?:boolean;
  className?:string;
};

const crc=new Intl.NumberFormat("es-CR",{style:"currency",currency:"CRC",maximumFractionDigits:0});
const usd=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2});

function CastleIcon({className="h-3.5 w-3.5"}:{className?:string}){
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor"><path d="M4 3h3v3h3V3h4v3h3V3h3v6l-2 2v8h2v2H4v-2h2v-8L4 9V3Zm5 8v8h2v-5h2v5h2v-8H9Z"/></svg>;
}

export function PriceSourceBadge({source="cardkingdom",compact=false}:{source?:Exclude<PriceSource,null>;compact?:boolean}){
  if(source==="tcgplayer")return <span className={`inline-flex items-center gap-1 font-semibold text-muted-foreground ${compact?"text-[9px]":"text-[10px]"}`} title="TCGplayer price reference"><span className="font-black">TCG</span></span>;
  return <span className={`inline-flex items-center gap-1 font-semibold text-muted-foreground ${compact?"text-[9px]":"text-[10px]"}`} title="Card Kingdom price reference"><CastleIcon className={compact?"h-3 w-3":"h-3.5 w-3.5"}/><span>CK</span></span>;
}

export default function VisualPrice({priceCrc,pricingMode,referenceCrc=null,marketPriceUsd=null,discountPercent=null,pendingLabel="Precio pendiente",referenceLabel="Referencia",customLabel="Precio del vendedor",source="cardkingdom",compact=false,className=""}:Props){
  const hasReference=referenceCrc!=null&&referenceCrc>0;
  const effectiveMarketPriceUsd=marketPriceUsd??getRememberedMarketPriceUsd(priceCrc,referenceCrc,pricingMode);
  const canFlip=effectiveMarketPriceUsd!=null&&effectiveMarketPriceUsd>0;
  const[showCrc,setShowCrc]=useState(false);
  const[hovered,setHovered]=useState(false);
  const[promoHost,setPromoHost]=useState<HTMLElement|null>(null);
  const rootRef=useRef<HTMLElement|null>(null);

  useEffect(()=>{
    if(!canFlip)return;
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    if(media.matches){setShowCrc(true);return}
    const timer=window.setInterval(()=>{if(!hovered)setShowCrc(v=>!v)},3500);
    return()=>window.clearInterval(timer);
  },[canFlip,hovered]);

  const isDiscount=priceCrc!=null&&pricingMode==="discount"&&hasReference&&priceCrc<referenceCrc!;
  const isCustom=pricingMode==="custom";
  const discountValue=isDiscount&&discountPercent!=null&&discountPercent>0?Math.round(discountPercent):null;

  useEffect(()=>{
    if(discountValue==null){setPromoHost(null);return}
    const root=rootRef.current;
    if(!root)return;
    const host=root.closest("article, a.group") as HTMLElement|null;
    if(!host)return;
    const previousPosition=host.style.position;
    if(getComputedStyle(host).position==="static")host.style.position="relative";
    setPromoHost(host);
    return()=>{setPromoHost(null);host.style.position=previousPosition};
  },[discountValue]);

  const saleBadge=discountValue!=null&&promoHost?createPortal(<span className="pointer-events-none absolute right-2 top-2 z-30 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-lg ring-1 ring-white/20">-{discountValue}% OFF</span>,promoHost):null;

  if(priceCrc==null)return <div ref={el=>{rootRef.current=el}} className={`flex items-center gap-1.5 font-semibold text-muted-foreground ${className}`}>{source&&<PriceSourceBadge source={source} compact={compact}/>}<span>{pendingLabel}</span></div>;
  const labelRow=<span className="flex items-center gap-1.5 text-xs text-muted-foreground">{source&&<PriceSourceBadge source={source} compact={compact}/>}<span>{referenceLabel}</span></span>;
  const crcFace=<div className="flex min-h-[3.25rem] flex-col justify-center">
    {isDiscount?<div className="flex items-center gap-2 text-xs text-muted-foreground">{source&&<PriceSourceBadge source={source} compact={compact}/>}<span>{referenceLabel}</span><span className="line-through decoration-1">{crc.format(referenceCrc!)}</span>{discountValue!=null&&<span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-500">-{discountValue}%</span>}</div>:isCustom&&hasReference?<div className="flex items-center gap-1.5 text-xs text-muted-foreground">{source&&<PriceSourceBadge source={source} compact={compact}/>}<span>{referenceLabel}</span><span className="line-through decoration-1">{crc.format(referenceCrc!)}</span></div>:labelRow}
    <div className="mt-0.5 flex items-center gap-2"><strong className="text-base font-extrabold leading-none text-primary">{crc.format(priceCrc)}</strong>{isCustom&&<span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{customLabel}</span>}</div>
  </div>;

  if(!canFlip)return <div ref={el=>{rootRef.current=el}} className={className}>{saleBadge}{crcFace}</div>;
  return <button ref={el=>{rootRef.current=el}} type="button" className={`block min-h-[3.25rem] cursor-pointer appearance-none bg-transparent p-0 text-left [perspective:700px] ${className}`} onClick={e=>{e.preventDefault();e.stopPropagation();setShowCrc(v=>!v)}} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} aria-label="Alternar precio USD y CRC" title="Alternar USD / CRC">
    {saleBadge}
    <span className={`relative block min-h-[3.25rem] min-w-[7rem] transition-transform duration-300 [transform-style:preserve-3d] motion-reduce:transition-none ${showCrc?"[transform:rotateX(180deg)]":""}`}>
      <span className="absolute inset-0 flex min-h-[3.25rem] flex-col justify-center [backface-visibility:hidden]">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">{source&&<PriceSourceBadge source={source} compact={compact}/>}<span>{referenceLabel}</span>{discountValue!=null&&<span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-500">-{discountValue}%</span>}</span>
        <strong className={`mt-0.5 text-base font-extrabold leading-none text-primary ${isDiscount?"line-through decoration-1 decoration-muted-foreground/70":""}`}>{usd.format(effectiveMarketPriceUsd!)}</strong>
      </span>
      <span className="absolute inset-0 flex min-h-[3.25rem] flex-col justify-center [backface-visibility:hidden] [transform:rotateX(180deg)]">{crcFace}</span>
    </span>
  </button>;
}
