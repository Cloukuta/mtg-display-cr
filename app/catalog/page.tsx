"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Box, PackageOpen, Shapes, Store } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import CatalogBinderHome from "@/components/CatalogBinderHome";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";

export default function CatalogPage(){
 const supabase=getSupabase();
 const[user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);const es=language==="es";
 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const h=(e:Event)=>{const v=(e as CustomEvent<Language>).detail;if(v==="es"||v==="en")setLanguage(v)};window.addEventListener("mtg-language-change",h);return()=>window.removeEventListener("mtg-language-change",h)},[]);
 useEffect(()=>{if(!supabase){setLoading(false);return}supabase.auth.getUser().then(({data})=>{setUser(data.user);setLoading(false)});const{data}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));return()=>data.subscription.unsubscribe()},[supabase]);
 if(loading)return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">{es?"Cargando catálogo…":"Loading catalog…"}</main>;
 if(!user)return <main className="grid min-h-screen place-items-center bg-background text-foreground"><Store className="text-primary"/></main>;
 return <main className="min-h-screen bg-background text-foreground"><AppHeader currentPath="/catalog"/><div className="mx-auto max-w-7xl px-5 py-8">
  <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">{es?"INVENTARIO DEL VENDEDOR":"SELLER INVENTORY"}</p>
  <h1 className="mt-2 font-serif text-4xl">{es?"Tu catálogo":"Your Catalog"}</h1>
  <p className="mt-2 max-w-2xl text-muted-foreground">{es?"Administra tus Binders y los diferentes tipos de productos disponibles en tu tienda.":"Manage your Binders and the different product types available in your store."}</p>

  <section className="mt-8">
   <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><PackageOpen size={20}/></div><div><h2 className="font-serif text-2xl">Binders</h2><p className="text-sm text-muted-foreground">{es?"Tus cartas organizadas por Binder.":"Your cards organized by Binder."}</p></div></div>
   <CatalogBinderHome sellerId={user.id} onOpen={binder=>{window.location.href=`/catalog/singles/binders/${binder.id}`}}/>
  </section>

  <section className="mt-10 grid gap-5 md:grid-cols-2">
   <div className="rounded-3xl border border-border bg-card p-6 opacity-75"><div className="flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Box/></div><span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">{es?"PRÓXIMAMENTE":"COMING SOON"}</span></div><h2 className="mt-6 font-serif text-3xl">{es?"Producto sellado":"Sealed Products"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{es?"Booster boxes, bundles, Commander decks y otros productos sellados tendrán su propio inventario.":"Booster boxes, bundles, Commander decks and other sealed products will have their own inventory."}</p></div>
   <div className="rounded-3xl border border-border bg-card p-6 opacity-75"><div className="flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Shapes/></div><span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">{es?"PRÓXIMAMENTE":"COMING SOON"}</span></div><h2 className="mt-6 font-serif text-3xl">{es?"Otros productos":"Other Products"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{es?"Figuras, accesorios y otros artículos adicionales de la tienda.":"Figures, accessories and other additional store items."}</p></div>
  </section>
 </div></main>
}
