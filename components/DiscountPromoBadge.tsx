type Props={discountPercent:number|null|undefined;className?:string};

export default function DiscountPromoBadge({discountPercent,className=""}:Props){
  if(discountPercent==null||discountPercent<=0)return null;
  return <span className={`pointer-events-none absolute left-2 top-2 z-20 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-lg ring-1 ring-white/20 ${className}`}>-{Math.round(discountPercent)}% OFF</span>;
}
