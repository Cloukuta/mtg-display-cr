"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import CatalogBinderHome from "@/components/CatalogBinderHome";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";

type Binder={id:number;name:string;is_default:boolean;is_public:boolean};

export default function CatalogBinderNavigation(){
 const supabase=getSupabase();
 const[userId,setUserId]=useState<string|null>(null),[binder,setBinder]=useState<Binder|null>(null),[ready,setReady]=useState(false),[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);const es=language==="es";
 const binderId=typeof window!=="undefined"?Number(new URLSearchParams(window.location.search).get("binder"))||null:null;
 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored)},[]);
 useEffect(()=>{if(!supabase){setReady(true);return}supabase.auth.getUser().then(async({data})=>{const id=data.user?.id||null;setUserId(id);if(id&&binderId){const{data:b}=await supabase.from("binders").select("id,name,is_default,is_public").eq("id",binderId).eq("seller_id",id).maybeSingle();setBinder((b as Binder|null)||null)}setReady(true)})},[supabase,binderId]);
 useEffect(()=>{if(!ready||!binderId||!binder)return;const original=new Map<HTMLElement,string>();function apply(){const root=document.querySelector("main");if(!root)return;const h1=root.querySelector("h1") as HTMLElement|null;if(h1){if(!original.has(h1))original.set(h1,h1.textContent||"");h1.textContent=`${es?"Tu catálogo":"Your Catalog"} [ ${binder.name} ]`}const articles=Array.from(root.querySelectorAll("article"));if(!supabase||!userId)return;supabase.from("inventory_items").select("id,cards(name,set_code,collector_number)").eq("seller_id",userId).eq("binder_id",binder.id).gt("quantity",0).then(({data})=>{const allowed=(data||[]).map((x:any)=>({name:x.cards?.name||"",set:(x.cards?.set_code||"").toUpperCase(),collector:String(x.cards?.collector_number||"")}));articles.forEach(article=>{const heading=article.querySelector("h2")?.textContent?.trim()||"";const detail=Array.from(article.querySelectorAll("p")).map(p=>p.textContent||"").join(" ");const match=allowed.some(a=>a.name===heading&&(!a.set||detail.includes(a.set))&&(!a.collector||detail.includes(`#${a.collector}`)));(article as HTMLElement).style.display=match?"":"none"})})}const timer=window.setTimeout(apply,0);return()=>{window.clearTimeout(timer);original.forEach((text,el)=>el.textContent=text);document.querySelectorAll("article").forEach(a=>(a as HTMLElement).style.display="")}},[ready,binderId,binder,userId,supabase,es]);
 if(!ready||!userId)return null;
 if(!binderId)return <div className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-background text-foreground"><div className="mx-auto max-w-7xl px-5 py-8"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">{es?"INVENTARIO DEL VENDEDOR":"SELLER INVENTORY"}</p><h1 className="mt-2 font-serif text-4xl">{es?"Tu catálogo":"Your Catalog"}</h1><p className="mt-2 text-muted-foreground">{es?"Organiza tu inventario por Binders.":"Organize your inventory by Binders."}</p><CatalogBinderHome sellerId={userId} onOpen={b=>{window.location.href=`/catalog?binder=${b.id}`}}/></div></div>;
 if(!binder)return <div className="fixed inset-x-0 top-16 z-40 border-b border-border bg-background px-5 py-3 text-center text-sm text-red-500">{es?"Binder no encontrado.":"Binder not found."}</div>;
 return <a href="/catalog" className="fixed left-5 top-[76px] z-[35] inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold shadow-lg hover:text-primary"><ArrowLeft size={16}/>{es?"Todos los Binders":"All Binders"}</a>;
}
