"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Layers3, Store } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import CatalogBinderHome from "@/components/CatalogBinderHome";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";

export default function SinglesPage(){
 const supabase=getSupabase();
 const[user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);const es=language==="es";
 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const h=(e:Event)=>{const v=(e as CustomEvent<Language>).detail;if(v==="es"||v==="en")setLanguage(v)};window.addEventListener("mtg-language-change",h);return()=>window.removeEventListener("mtg-language-change",h)},[]);
 useEffect(()=>{if(!supabase){setLoading(false);return}supabase.auth.getUser().then(({data})=>{setUser(data.user);setLoading(false)});const{data}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));return()=>data.subscription.unsubscribe()},[supabase]);
 if(loading)return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">{es?"Cargando…":"Loading…"}</main>;
 if(!user)return <main className="grid min-h-screen place-items-center bg-background text-foreground"><Store className="text-primary"/></main>;
 return <main className="min-h-screen bg-background text-foreground"><AppHeader currentPath="/catalog"/><div className="mx-auto max-w-7xl px-5 py-8"><a href="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={16}/>{es?"Tu catálogo":"Your Catalog"}</a><div className="mt-7 flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Layers3/></div><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">{es?"SINGLES":"SINGLES"}</p><h1 className="mt-1 font-serif text-4xl">{es?"Binders de Singles":"Singles Binders"}</h1><p className="mt-2 text-muted-foreground">{es?"Organiza tus cartas individuales por Binders.":"Organize your individual cards by Binders."}</p></div></div><CatalogBinderHome sellerId={user.id} onOpen={binder=>{window.location.href=`/catalog/singles/binders/${binder.id}`}}/></div></main>
}
