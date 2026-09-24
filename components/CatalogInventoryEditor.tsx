"use client";

import { useEffect, useMemo, useState } from "react";
import InventoryEditModal from "@/components/InventoryEditModal";
import ManualCardAddModal from "@/components/ManualCardAddModal";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";

type Binder={id:number;name:string;is_default:boolean;is_public:boolean};
type Item={id:number;quantity:number;condition:string;language:string;finish:string;pricing_mode:"default"|"custom"|"discount";custom_price_crc:number|null;binder_id:number|null;cards:{name:string;set_code:string;collector_number:string;image_uri:string|null}|null};

export default function CatalogInventoryEditor(){
 const supabase=getSupabase();
 const[items,setItems]=useState<Item[]>([]),[binders,setBinders]=useState<Binder[]>([]),[index,setIndex]=useState(-1),[notice,setNotice]=useState(""),[selectedBinderId,setSelectedBinderId]=useState<number|null>(null);
 const[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);const es=language==="es";

 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const h=(e:Event)=>{const v=(e as CustomEvent<Language>).detail;if(v==="es"||v==="en")setLanguage(v)};window.addEventListener("mtg-language-change",h);return()=>window.removeEventListener("mtg-language-change",h)},[]);

 useEffect(()=>{if(!supabase)return;let cancelled=false;(async()=>{const path=window.location.pathname;const match=path.match(/^\/catalog\/(?:singles\/binders|binders)\/(\d+)\/?$/);if(match){const id=Number(match[1]);if(!cancelled)setSelectedBinderId(Number.isFinite(id)?id:null);return}if(path==="/catalog/binders"){const{data:auth}=await supabase.auth.getUser();if(!auth.user||cancelled)return;const{data,error}=await supabase.from("binders").select("id").eq("seller_id",auth.user.id).eq("is_default",true).maybeSingle();if(!cancelled&&!error)setSelectedBinderId(data?.id??null);return}if(!cancelled)setSelectedBinderId(null)})();return()=>{cancelled=true}},[supabase]);

 async function load(){if(!supabase||selectedBinderId==null){setItems([]);return}setNotice("");const{data:auth}=await supabase.auth.getUser();const user=auth.user;if(!user)return;const[itemResult,binderResult]=await Promise.all([supabase.from("inventory_items").select("id,quantity,condition,language,finish,pricing_mode,custom_price_crc,binder_id,cards(name,set_code,collector_number,image_uri)").eq("seller_id",user.id).eq("binder_id",selectedBinderId).gt("quantity",0).order("updated_at",{ascending:false}),supabase.from("binders").select("id,name,is_default,is_public").eq("seller_id",user.id).order("is_default",{ascending:false}).order("name")]);if(itemResult.error)setNotice(itemResult.error.message);else setItems((itemResult.data||[]) as unknown as Item[]);if(binderResult.error)setNotice(binderResult.error.message);else setBinders((binderResult.data||[]) as Binder[])}
 useEffect(()=>{void load()},[supabase,selectedBinderId]);

 useEffect(()=>{if(selectedBinderId==null)return;function identifyHeading(target:EventTarget|null){const el=target instanceof Element?target:null;if(!el)return null;const heading=el.closest("article h2");if(!(heading instanceof HTMLElement))return null;const article=heading.closest("article");if(!article)return null;return{heading,article}}function findIndex(heading:HTMLElement,article:Element){const rawId=article.getAttribute("data-inventory-item-id");if(rawId){const directId=Number(rawId),direct=items.findIndex(item=>item.id===directId);if(direct>=0)return direct}const name=(heading.textContent||"").trim();const detail=Array.from(article.querySelectorAll("p")).map(p=>p.textContent||"").join(" ");const matches=items.map((item,i)=>({item,i})).filter(x=>x.item.cards?.name===name);const exact=matches.find(x=>{const c=x.item.cards;if(!c)return false;return detail.includes(c.set_code.toUpperCase())&&detail.includes(`#${c.collector_number}`)});return exact?.i??matches[0]?.i??-1}function onClick(e:MouseEvent){const found=identifyHeading(e.target);if(!found)return;const i=findIndex(found.heading,found.article);if(i<0)return;e.preventDefault();e.stopPropagation();setIndex(i)}function onKey(e:KeyboardEvent){if(e.key!=="Enter"&&e.key!==" ")return;const found=identifyHeading(e.target);if(!found)return;const i=findIndex(found.heading,found.article);if(i<0)return;e.preventDefault();e.stopPropagation();setIndex(i)}function decorate(){document.querySelectorAll("article h2").forEach(node=>{if(!(node instanceof HTMLElement))return;node.style.cursor="pointer";node.style.textDecoration="underline";node.style.textDecorationColor="rgba(163,230,53,.45)";node.style.textUnderlineOffset="3px";node.setAttribute("role","button");node.setAttribute("tabindex","0");node.setAttribute("title",es?"Editar esta carta":"Edit this card");node.closest("article")?.classList.add("binder-inventory-card")})}decorate();const observer=new MutationObserver(decorate);observer.observe(document.body,{childList:true,subtree:true});document.addEventListener("click",onClick);document.addEventListener("keydown",onKey);return()=>{observer.disconnect();document.removeEventListener("click",onClick);document.removeEventListener("keydown",onKey)}},[items,es,selectedBinderId]);

 const item=useMemo(()=>index>=0?items[index]??null:null,[items,index]);
 async function save(next:Item){if(!supabase)return;const payload={quantity:next.quantity,condition:next.condition,language:next.language,finish:next.finish,pricing_mode:next.pricing_mode,custom_price_crc:next.pricing_mode==="custom"?next.custom_price_crc:null,binder_id:next.binder_id,available:next.quantity>0,updated_at:new Date().toISOString()};const{error}=await supabase.from("inventory_items").update(payload).eq("id",next.id);if(error){setNotice(error.message);return}setNotice(es?"Cambios guardados.":"Changes saved.");setIndex(-1);window.location.reload()}
 async function createBinder(name:string):Promise<Binder|null>{if(!supabase)return null;const{data:auth}=await supabase.auth.getUser();if(!auth.user)return null;const clean=name.trim();if(!clean)return null;const{data,error}=await supabase.from("binders").insert({seller_id:auth.user.id,name:clean,is_default:false,is_public:false}).select("id,name,is_default,is_public").single();if(error){setNotice(error.message);return null}const created=data as Binder;setBinders(current=>[...current,created].sort((a,b)=>Number(b.is_default)-Number(a.is_default)||a.name.localeCompare(b.name)));return created}
 if(selectedBinderId==null)return null;
 return <><style>{`
section.sticky.top-4,
section.sticky[class*="top-[76px]"]{
 position:fixed!important;
 top:auto!important;
 bottom:20px!important;
 left:50%!important;
 right:auto!important;
 width:min(calc(100vw - 32px),80rem)!important;
 margin:0!important;
 transform:translateX(-50%)!important;
 z-index:70!important;
 box-shadow:0 20px 50px rgba(0,0,0,.45)!important;
}
@media (max-width:640px){
 section.sticky.top-4,
 section.sticky[class*="top-[76px]"]{
  bottom:max(10px,env(safe-area-inset-bottom))!important;
  width:calc(100vw - 20px)!important;
  padding:12px!important;
  border-radius:18px!important;
 }
 section.sticky.top-4>div,
 section.sticky[class*="top-[76px]"]>div{
  gap:10px!important;
 }
 section.sticky.top-4>div>div:first-child,
 section.sticky[class*="top-[76px]"]>div>div:first-child{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:10px!important;
  min-width:0!important;
 }
 section.sticky.top-4>div>div:first-child strong,
 section.sticky[class*="top-[76px]"]>div>div:first-child strong{
  white-space:nowrap!important;
  font-size:14px!important;
 }
 section.sticky.top-4>div>div:first-child span,
 section.sticky[class*="top-[76px]"]>div>div:first-child span{
  margin-left:0!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
  text-align:right!important;
  font-size:12px!important;
 }
 section.sticky.top-4>div>div:last-child,
 section.sticky[class*="top-[76px]"]>div>div:last-child{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
  gap:8px!important;
  width:100%!important;
 }
 section.sticky.top-4>div>div:last-child button,
 section.sticky[class*="top-[76px]"]>div>div:last-child button{
  width:100%!important;
  min-width:0!important;
  min-height:42px!important;
  padding:8px 6px!important;
  justify-content:center!important;
  text-align:center!important;
  font-size:11px!important;
  line-height:1.15!important;
 }
 .binder-inventory-card{
  display:grid!important;
  grid-template-columns:28px 56px minmax(0,1fr)!important;
  grid-template-rows:auto auto!important;
  column-gap:10px!important;
  row-gap:10px!important;
  align-items:start!important;
  padding:14px!important;
 }
 .binder-inventory-card>button:first-child{
  grid-column:1!important;
  grid-row:1!important;
  align-self:center!important;
  justify-self:center!important;
 }
 .binder-inventory-card>div:nth-child(2){
  grid-column:2!important;
  grid-row:1!important;
  width:56px!important;
  height:80px!important;
 }
 .binder-inventory-card>div:nth-child(3){
  grid-column:3!important;
  grid-row:1!important;
  min-width:0!important;
  align-self:center!important;
 }
 .binder-inventory-card>div:nth-child(3) h2{
  white-space:normal!important;
  overflow:visible!important;
  line-height:1.2!important;
 }
 .binder-inventory-card>div:nth-child(3) p{
  font-size:12px!important;
  line-height:1.35!important;
 }
 .binder-inventory-card>div:nth-child(3)>div{
  gap:5px!important;
  margin-top:6px!important;
 }
 .binder-inventory-card>div:nth-child(3)>div span{
  padding:3px 7px!important;
  font-size:10px!important;
 }
 .binder-inventory-card>div:nth-child(4){
  grid-column:2 / 4!important;
  grid-row:2!important;
  min-width:0!important;
  width:100%!important;
  text-align:left!important;
  padding-top:2px!important;
 }
 .binder-inventory-card>div:nth-child(4)>p{
  margin-top:3px!important;
 }
 .binder-inventory-card>div:nth-child(4)>p:nth-of-type(3){
  margin-top:10px!important;
 }
 .binder-inventory-card>div:nth-child(4)>div{
  justify-content:flex-start!important;
 }
}
`}</style>{notice&&<div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-2xl">{notice}</div>}<ManualCardAddModal binderId={selectedBinderId} language={language} onAdded={()=>window.location.reload()}/><InventoryEditModal open={index>=0} item={item} binders={binders} language={language} hasPrevious={index>0} hasNext={index>=0&&index<items.length-1} onClose={()=>setIndex(-1)} onPrevious={()=>setIndex(i=>Math.max(0,i-1))} onNext={()=>setIndex(i=>Math.min(items.length-1,i+1))} onSave={save} onCreateBinder={createBinder}/></>
}
