"use client";

import { useEffect, useState, type ReactNode } from "react";
import BrandLoader from "@/components/BrandLoader";
import { getSupabase } from "@/lib/supabase";

export default function SellerDisplayLayout({ children }: { children: ReactNode }) {
  const [resolvingCatalogCard, setResolvingCatalogCard] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scryfallId = params.get("card")?.trim();
    const setCode = params.get("set")?.trim().toLowerCase();
    const collectorNumber = params.get("collector")?.trim();
    if (!scryfallId && !(setCode && collectorNumber)) return;

    setResolvingCatalogCard(true);let cancelled=false;let timer:ReturnType<typeof setInterval>|null=null;
    const finish=()=>{if(!cancelled)setResolvingCatalogCard(false);if(timer){clearInterval(timer);timer=null}};
    void(async()=>{
      const supabase=getSupabase();if(!supabase){finish();return}
      let query=supabase.from("cards").select("scryfall_id,name,set_code,collector_number");
      query=scryfallId?query.eq("scryfall_id",scryfallId):query.eq("set_code",setCode!).eq("collector_number",collectorNumber!);
      const{data}=await query.limit(1).maybeSingle();
      if(cancelled)return;if(!data){finish();return}
      let attempts=0;timer=setInterval(()=>{attempts+=1;const searchInput=document.querySelector<HTMLInputElement>('input[placeholder="Search by name or set…"], input[placeholder="Buscar por nombre o set…"]');const selects=Array.from(document.querySelectorAll<HTMLSelectElement>("select"));const setSelect=selects.find(select=>Array.from(select.options).some(option=>option.value.toLowerCase()===String(data.set_code).toLowerCase()));if(searchInput&&setSelect){const inputSetter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;const selectSetter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;inputSetter?.call(searchInput,data.name);searchInput.dispatchEvent(new Event("input",{bubbles:true}));searchInput.dispatchEvent(new Event("change",{bubbles:true}));selectSetter?.call(setSelect,String(data.set_code).toLowerCase());setSelect.dispatchEvent(new Event("change",{bubbles:true}));requestAnimationFrame(()=>requestAnimationFrame(finish))}else if(attempts>=40)finish()},100)
    })();
    return()=>{cancelled=true;if(timer)clearInterval(timer)};
  },[]);
  return <>{resolvingCatalogCard?<BrandLoader fullscreen/>:null}<div className={resolvingCatalogCard?"invisible":undefined}>{children}</div></>;
}
