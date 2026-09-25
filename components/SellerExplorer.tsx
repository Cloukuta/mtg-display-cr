"use client";

import {useMemo,useState} from "react";
import {ArrowRight,MapPin,Search} from "lucide-react";

type Seller={id:string;public_name:string|null;slug:string|null;location:string|null};

type Props={sellers:Seller[];es:boolean};

function shuffled<T>(items:T[]){
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }
  return copy;
}

export default function SellerExplorer({sellers,es}:Props){
  const[query,setQuery]=useState("");
  const[location,setLocation]=useState("all");
  const randomOrder=useMemo(()=>shuffled(sellers),[sellers]);
  const locations=useMemo(()=>Array.from(new Set(sellers.map(s=>s.location?.trim()).filter((v):v is string=>Boolean(v)))).sort((a,b)=>a.localeCompare(b)),[sellers]);
  const filtering=query.trim().length>0||location!=="all";
  const filtered=useMemo(()=>{
    if(!filtering)return randomOrder;
    const q=query.trim().toLowerCase();
    return sellers.filter(s=>{
      const matchesQuery=!q||`${s.public_name||""} ${s.location||""}`.toLowerCase().includes(q);
      const matchesLocation=location==="all"||s.location===location;
      return matchesQuery&&matchesLocation;
    }).sort((a,b)=>(a.public_name||"").localeCompare(b.public_name||""));
  },[filtering,location,query,randomOrder,sellers]);

  // The home page uses four columns on desktop, so 12 cards = exactly three rows.
  const visible=filtered.slice(0,12);

  return <div className="mt-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={es?"Buscar vendedor o ubicación…":"Search seller or location…"} className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none transition focus:border-primary"/>
      </label>
      <select value={location} onChange={e=>setLocation(e.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none transition focus:border-primary">
        <option value="all">{es?"Todas las ubicaciones":"All locations"}</option>
        {locations.map(value=><option key={value} value={value}>{value}</option>)}
      </select>
    </div>

    {visible.length?<>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map(s=><a key={s.id} href={`/v/${s.slug}`} className="group rounded-3xl border border-border bg-card p-5 transition hover:border-primary/50">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 font-serif text-lg font-bold text-primary">{(s.public_name||"M").slice(0,2).toUpperCase()}</div>
          <h3 className="mt-5 font-semibold">{s.public_name||"Seller"}</h3>
          <p className="mt-1 text-sm text-muted-foreground"><MapPin className="mr-1 inline" size={12}/>{s.location||"Costa Rica"}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary">{es?"Ver vitrina":"View display"}<ArrowRight size={15}/></span>
        </a>)}
      </div>
      {filtered.length>visible.length&&<p className="mt-5 text-center text-xs text-muted-foreground">{es?`${filtered.length-visible.length} vendedores adicionales. Usa la búsqueda o los filtros para encontrarlos.`:`${filtered.length-visible.length} additional sellers. Use search or filters to find them.`}</p>}
    </>:<div className="mt-5 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{es?"No encontramos vendedores con esos filtros.":"No sellers match those filters."}</div>}
  </div>;
}
