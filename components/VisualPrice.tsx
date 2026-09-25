"use client";

type PricingMode="default"|"custom"|"discount";

type Props={
  priceCrc:number|null;
  pricingMode:PricingMode;
  referenceCrc?:number|null;
  discountPercent?:number|null;
  pendingLabel?:string;
  referenceLabel?:string;
  customLabel?:string;
  compact?:boolean;
  className?:string;
};

const crc=new Intl.NumberFormat("es-CR",{style:"currency",currency:"CRC",maximumFractionDigits:0});

export default function VisualPrice({priceCrc,pricingMode,referenceCrc=null,discountPercent=null,pendingLabel="Precio pendiente",referenceLabel="Referencia",customLabel="Precio personalizado",compact=false,className=""}:Props){
  if(priceCrc==null)return <span className={`font-semibold text-muted-foreground ${className}`}>{pendingLabel}</span>;
  const hasReference=referenceCrc!=null&&referenceCrc>0;
  const isDiscount=pricingMode==="discount"&&hasReference&&priceCrc<referenceCrc!;
  const isCustom=pricingMode==="custom";
  return <div className={`flex ${compact?"items-center gap-2":"flex-col items-start gap-0.5"} ${className}`}>
    {isDiscount&&<div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="line-through decoration-1">{crc.format(referenceCrc!)}</span>{discountPercent!=null&&discountPercent>0&&<span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-500">-{Math.round(discountPercent)}%</span>}</div>}
    {isCustom&&hasReference&&<div className="text-xs text-muted-foreground"><span>{referenceLabel}: </span><span className="line-through decoration-1">{crc.format(referenceCrc!)}</span></div>}
    <div className="flex items-center gap-2"><strong className="text-base font-extrabold text-foreground">{crc.format(priceCrc)}</strong>{isCustom&&<span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{customLabel}</span>}</div>
  </div>;
}
