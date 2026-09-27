"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {Check} from "lucide-react";
import {getSupabase} from "@/lib/supabase";

const AVATARS=["avatar-01","avatar-02","avatar-03","avatar-04","avatar-05","avatar-06"] as const;

type Mount={host:HTMLElement};

export default function ProfileAvatarEnhancer(){
 const[mount,setMount]=useState<Mount|null>(null),[selected,setSelected]=useState<string|null>(null),[sellerType,setSellerType]=useState<string|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{
  if(window.location.pathname!=="/profile")return;const s=getSupabase();if(!s)return;let observer:MutationObserver|null=null;let host:HTMLElement|null=null;
  void(async()=>{const{data:{user}}=await s.auth.getUser();if(!user)return;const{data}=await s.from("profiles").select("avatar_key,seller_type").eq("id",user.id).maybeSingle();setSelected(data?.avatar_key??null);setSellerType(data?.seller_type??null)})();
  const attach=()=>{const heading=Array.from(document.querySelectorAll("h2")).find(el=>/Perfil público|Public profile/i.test(el.textContent||""));if(!heading)return false;const section=heading.closest("section");if(!section)return false;host=section.querySelector<HTMLElement>("[data-avatar-picker]");if(!host){host=document.createElement("div");host.dataset.avatarPicker="1";heading.parentElement?.appendChild(host)}setMount({host});return true};
  if(!attach()){observer=new MutationObserver(()=>{if(attach())observer?.disconnect()});observer.observe(document.body,{childList:true,subtree:true})}
  return()=>{observer?.disconnect();host?.remove()};
 },[]);
 async function choose(key:string){const s=getSupabase();if(!s||saving)return;setSaving(true);setMessage("");const{data:{user}}=await s.auth.getUser();if(!user){setSaving(false);return}const{error}=await s.from("profiles").update({avatar_key:key,updated_at:new Date().toISOString()}).eq("id",user.id);if(error)setMessage(error.message);else{setSelected(key);setMessage(document.documentElement.lang==="en"?"Avatar saved":"Avatar guardado")}setSaving(false)}
 if(!mount||sellerType==="store")return null;const es=document.documentElement.lang!=="en";
 return createPortal(<div className="mt-7 max-w-2xl"><div className="mb-3"><p className="text-sm font-semibold">{es?"Avatar de tu perfil":"Profile avatar"}</p><p className="mt-1 text-xs text-muted-foreground">{es?"Elige uno de los avatares de MTG Display. Podrás cambiarlo cuando quieras.":"Choose an MTG Display avatar. You can change it whenever you want."}</p></div><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{AVATARS.map(key=><button type="button" key={key} disabled={saving} onClick={()=>void choose(key)} aria-label={key} className={`relative aspect-square overflow-hidden rounded-2xl border-2 transition hover:-translate-y-0.5 ${selected===key?"border-primary shadow-[0_0_0_3px_rgba(163,230,53,.12)]":"border-border hover:border-primary/50"}`}><img src={`/avatars/${key}.webp`} alt="" className="h-full w-full object-cover"/>{selected===key&&<span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={13}/></span>}</button>)}</div>{message&&<p className="mt-2 text-xs text-muted-foreground">{message}</p>}</div>,mount.host);
}
