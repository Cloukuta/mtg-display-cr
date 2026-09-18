"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import InventoryEditModal from "@/components/InventoryEditModal";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";

type Binder={id:number;name:string;is_default:boolean;is_public:boolean};
type Item={id:number;quantity:number;condition:string;language:string;finish:string;pricing_mode:"default"|"custom"|"discount";custom_price_crc:number|null;binder_id:number|null;cards:{name:string;set_code:string;collector_number:string;image_uri:string|null}|null};

export default function CatalogInventoryEditor(){
 const supabase=getSupabase();
 const[items,setItems]=useState<Item[]>([]),[binders,setBinders]=useState<Binder[]>([]),[index,setIndex]=useState(-1),[loading,setLoading]=useState(false),[notice,setNotice]=useState("");
 const[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);const es=language==="es";
 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const h=(e:Event)=>{const v=(e as CustomEvent<Language>).detail;if(v==="es"||v==="en")setLanguage(v)};window.addEventListener("mtg-language-change",h);return()=>window.removeEventListener("mtg-language-change",h)},[]);
 async function load(){if(!supabase)return;setLoading(true);setNotice("");const{data:auth}=await supabase.auth.getUser();const user=auth.user;if(!user){setLoading(false);return}const[itemResult,binderResult]=await Promise.all([supabase.from("inventory_items").select("id,quantity,condition,language,finish,pricing_mode,custom_price_crc,binder_id,cards(name,set_code,collector_number,image_uri)").eq("seller_id",user.id).gt("quantity",0).order("updated_at",{ascending:false}),supabase.from("binders").select("id,name,is_default,is_public").eq("seller_id",user.id).order("is_default",{ascending:false}).order("name")]);if(itemResult.error)setNotice(itemResult.error.message);else setItems((itemResult.data||[]) as unknown as Item[]);if(binderResult.error)setNotice(binderResult.error.message);else setBinders((binderResult.data||[]) as Binder[]);setLoading(false)}
 useEffect(()=>{void load()},[supabase]);
 const item=useMemo(()=>index>=0?items[index]??null:null,[items,index]);
 async function save(next:Item){if(!supabase)return;const payload={quantity:next.quantity,condition:next.condition,language:next.language,finish:next.finish,pricing_mode:next.pricing_mode,custom_price_crc:next.pricing_mode==="custom"?next.custom_price_crc:null,binder_id:next.binder_id,available:next.quantity>0,updated_at:new Date().toISOString()};const{error}=await supabase.from("inventory_items").update(payload).eq("id",next.id);if(error){setNotice(error.message);return}setItems(current=>current.map(row=>row.id===next.id?{...row,...next}:row));setNotice(es?"Cambios guardados.":"Changes saved.")}
 async function createBinder(name:string):Promise<Binder|null>{if(!supabase)return null;const{data:auth}=await supabase.auth.getUser();if(!auth.user)return null;const clean=name.trim();if(!clean)return null;const{data,error}=await supabase.from("binders").insert({seller_id:auth.user.id,name:clean,is_default:false,is_public:true}).select("id,name,is_default,is_public").single();if(error){setNotice(error.message);return null}const created=data as Binder;setBinders(current=>[...current,created].sort((a,b)=>Number(b.is_default)-Number(a.is_default)||a.name.localeCompare(b.name)));return created}
 return <>{notice&&<div className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-2xl">{notice}</div>}<button type="button" disabled={loading||items.length===0} onClick={()=>setIndex(0)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-40"><Pencil size={17}/><span className="hidden sm:inline">{loading?(es?"Cargando…":"Loading…"):(es?"Editar inventario":"Edit inventory")}</span></button><InventoryEditModal open={index>=0} item={item} binders={binders} language={language} hasPrevious={index>0} hasNext={index>=0&&index<items.length-1} onClose={()=>setIndex(-1)} onPrevious={()=>setIndex(i=>Math.max(0,i-1))} onNext={()=>setIndex(i=>Math.min(items.length-1,i+1))} onSave={save} onCreateBinder={createBinder}/></>
}
