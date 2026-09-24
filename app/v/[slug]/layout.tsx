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

    setResolvingCatalogCard(true);let cancelled=false;let timer:ReturnType<typeof setInterval>|null=null;let observer:MutationObserver|null=null;
    const finish=()=>{if(!cancelled)setResolvingCatalogCard(false);if(timer){clearInterval(timer);timer=null}};
    const enforceExactPrinting=(exactSet:string,exactCollector:string)=>{
      const expected=`${exactSet.toUpperCase()} #${exactCollector}`.toLowerCase();
      const apply=()=>{
        const metadata=Array.from(document.querySelectorAll<HTMLParagraphElement>("p")).filter(p=>/^\s*[a-z0-9]+\s+#/i.test(p.textContent||""));
        for(const p of metadata){
          const text=(p.textContent||"").trim().toLowerCase();
          let node:HTMLElement|null=p.parentElement;
          while(node&&node!==document.body&&!node.querySelector("img"))node=node.parentElement;
          if(node&&node!==document.body)node.style.display=text.startsWith(expected)?"":"none";
        }
      };
      apply();
      observer=new MutationObserver(apply);
      observer.observe(document.body,{childList:true,subtree:true});
    };
    void(async()=>{
      const supabase=getSupabase();if(!supabase){finish();return}
      let query=supabase.from("cards").select("scryfall_id,name,set_code,collector_number");
      query=scryfallId?query.eq("scryfall_id",scryfallId):query.eq("set_code",setCode!).eq("collector_number",collectorNumber!);
      const{data}=await query.limit(1).maybeSingle();
      if(cancelled)return;if(!data){finish();return}

      // Old links may still arrive as ?card=<scryfall_id>. Once the exact printing
      // is resolved, make Set + Collector the canonical public URL without a reload.
      if(scryfallId&&data.set_code&&data.collector_number){
        const canonical=new URL(window.location.href);
        canonical.searchParams.delete("card");
        canonical.searchParams.set("set",String(data.set_code).toUpperCase());
        canonical.searchParams.set("collector",String(data.collector_number));
        window.history.replaceState(window.history.state,"",`${canonical.pathname}${canonical.search}${canonical.hash}`);
      }

      const exactSet=String(data.set_code||setCode||"");
      const exactCollector=String(data.collector_number||collectorNumber||"");
      let attempts=0;timer=setInterval(()=>{attempts+=1;const searchInput=document.querySelector<HTMLInputElement>('input[placeholder="Search by name or set…"], input[placeholder="Buscar por nombre o set…"]');const selects=Array.from(document.querySelectorAll<HTMLSelectElement>("select"));const setSelect=selects.find(select=>Array.from(select.options).some(option=>option.value.toLowerCase()===exactSet.toLowerCase()));if(searchInput&&setSelect){const inputSetter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;const selectSetter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;inputSetter?.call(searchInput,data.name);searchInput.dispatchEvent(new Event("input",{bubbles:true}));searchInput.dispatchEvent(new Event("change",{bubbles:true}));selectSetter?.call(setSelect,exactSet.toLowerCase());setSelect.dispatchEvent(new Event("change",{bubbles:true}));requestAnimationFrame(()=>requestAnimationFrame(()=>{enforceExactPrinting(exactSet,exactCollector);finish()}))}else if(attempts>=40)finish()},100)
    })();
    return()=>{cancelled=true;if(timer)clearInterval(timer);observer?.disconnect()};
  },[]);
  return <>{resolvingCatalogCard?<BrandLoader fullscreen/>:null}<div className={resolvingCatalogCard?"invisible":undefined}>{children}</div></>;
}
