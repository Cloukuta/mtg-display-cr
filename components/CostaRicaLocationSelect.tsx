"use client";

import {useEffect,useState} from "react";
import {MapPin} from "lucide-react";
import {COSTA_RICA_LOCATIONS,COSTA_RICA_PROVINCES,formatCostaRicaLocation,parseCostaRicaLocation,type CostaRicaProvince} from "@/lib/costaRicaLocations";

type Props={value:string;onChange:(value:string)=>void;language:"es"|"en"};

export default function CostaRicaLocationSelect({value,onChange,language}:Props){
 const parsed=parseCostaRicaLocation(value);
 const[province,setProvince]=useState(parsed.province);
 const[canton,setCanton]=useState(parsed.canton);
 const es=language==="es";
 useEffect(()=>{const next=parseCostaRicaLocation(value);if(next.province&&next.canton){setProvince(next.province);setCanton(next.canton)}},[value]);
 const cantons=province?(COSTA_RICA_LOCATIONS[province as CostaRicaProvince] as readonly string[]):[];
 function changeProvince(next:string){setProvince(next);setCanton("")}
 function changeCanton(next:string){setCanton(next);if(province&&next)onChange(formatCostaRicaLocation(province,next))}
 return <div className="grid gap-2">
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="grid gap-1.5 text-sm text-muted-foreground">{es?"Provincia":"Province"}<select value={province} onChange={e=>changeProvince(e.target.value)} className="h-11 rounded-xl border border-border bg-background px-4 text-foreground outline-none focus:border-primary"><option value="">{es?"Seleccionar provincia":"Select province"}</option>{COSTA_RICA_PROVINCES.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
   <label className="grid gap-1.5 text-sm text-muted-foreground">{es?"Cantón":"Canton"}<select value={canton} disabled={!province} onChange={e=>changeCanton(e.target.value)} className="h-11 rounded-xl border border-border bg-background px-4 text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"><option value="">{province?(es?"Seleccionar cantón":"Select canton"):(es?"Primero selecciona provincia":"Select province first")}</option>{cantons.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
  </div>
  <div className="flex min-h-10 items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 text-xs text-muted-foreground"><MapPin size={14} className="shrink-0 text-primary"/><span>{province&&canton?formatCostaRicaLocation(province,canton):(es?"La ubicación pública se mostrará como: Provincia, Cantón, Costa Rica":"Public location will display as: Province, Canton, Costa Rica")}</span></div>
  {value&&!parsed.province&&<p className="text-xs text-amber-500">{es?`Ubicación anterior: ${value}. Selecciona provincia y cantón para normalizarla.`:`Previous location: ${value}. Select province and canton to standardize it.`}</p>}
 </div>
}
