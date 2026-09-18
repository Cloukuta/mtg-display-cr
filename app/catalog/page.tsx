"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Box, PackageOpen, Plus, Shapes, Store } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import CatalogBinderHome from "@/components/CatalogBinderHome";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";

export default function CatalogPage(){
 const supabase=getSupabase();
 const router=useRouter();
 const[user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE),[createBinderSignal,setCreateBinderSignal]=useState(0);const es=language==="es";
 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const h=(e:Event)=>{const v=(e as CustomEvent<Language>).detail;if(v==="es"||v==="en")setLanguage(v)};window.addEventListener("mtg-language-change",h);return()=>window.removeEventListener("mtg-language-change",h)},[]);
 useEffect(()=>{if(!supabase){setLoading(false);return}supabase.auth.getUser().then(({data})=>{setUser(data.user);setLoading(false)});const{data}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));return()=>data.subscription.unsubscribe()},[supabase]);
 if(loading)return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">{es?"Cargando catálogo…":"Loading catalog…"}</main>;
 if(!user)return <main className="grid min-h-screen place-items-center bg-background text-foreground"><Store className="text-primary"/></main>;
 const futureRow=(label:string)=><div className="flex items-center justify-between border-t border-border px-5 py-4 first:border-t-0"><span className="font-semibold text-muted-foreground">{label}</span><span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{es?"Próximamente":"Coming soon"}</span></div>;
 const categoryButton=(label:string,disabled=false,onClick?:()=>void)=><button disabled={disabled} onClick={onClick} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"><Plus size={17}/>{label}</button>;
 return <main className="min-h-screen bg-background text-foreground"><AppHeader currentPath="/catalog"/><div className="mx-auto max-w-7xl px-5 py-8">
  <div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">{es?"INVENTARIO DEL VENDEDOR":"SELLER INVENTORY"}</p><h1 className="mt-2 font-serif text-4xl">{es?"Catálogo / Inventario":"Catalog / Inventory"}</h1><p className="mt-2 text-muted-foreground">{es?"Administra el inventario de tu tienda por categoría.":"Manage your store inventory by category."}</p></div>

  <section className="mt-8">
   <div className="mb-3 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><PackageOpen size={18}/></div><h2 className="font-serif text-2xl">Binders</h2></div>{categoryButton(es?"Crear Binder":"Create Binder",false,()=>setCreateBinderSignal(v=>v+1))}</div>
   <CatalogBinderHome sellerId={user.id} onOpen={binder=>router.push(`/catalog/binders/${binder.id}`)} createSignal={createBinderSignal} compact/>
  </section>

  <section className="mt-8">
   <div className="mb-3 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground"><Box size={18}/></div><h2 className="font-serif text-2xl">{es?"Producto sellado":"Sealed Products"}</h2></div>{categoryButton(es?"Agregar producto":"Add Product",true)}</div>
   <div className="overflow-hidden rounded-2xl border border-border bg-card">{futureRow("Booster Boxes")}{futureRow("Bundles")}{futureRow("Commander Decks")}</div>
  </section>

  <section className="mt-8 pb-10">
   <div className="mb-3 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground"><Shapes size={18}/></div><h2 className="font-serif text-2xl">{es?"Otros productos":"Other Products"}</h2></div>{categoryButton(es?"Agregar producto":"Add Product",true)}</div>
   <div className="overflow-hidden rounded-2xl border border-border bg-card">{futureRow(es?"Figuras":"Figures")}{futureRow(es?"Accesorios":"Accessories")}</div>
  </section>
 </div></main>
}
