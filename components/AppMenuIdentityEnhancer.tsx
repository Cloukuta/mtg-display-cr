"use client";

import {useEffect} from "react";
import {getSupabase} from "@/lib/supabase";

type MenuProfile={seller_type:string|null;avatar_key:string|null;store_logo_path:string|null};

export default function AppMenuIdentityEnhancer(){
 useEffect(()=>{
  const s=getSupabase();if(!s)return;let cancelled=false,observer:MutationObserver|null=null;let profile:MenuProfile|null=null;
  const imageUrl=()=>{if(!profile)return null;if(profile.seller_type==="store"&&profile.store_logo_path)return s.storage.from("store-logos").getPublicUrl(profile.store_logo_path).data.publicUrl;if(profile.avatar_key)return `/avatars/${profile.avatar_key}.webp`;return null};
  const enhance=()=>{
   const labels=Array.from(document.querySelectorAll<HTMLElement>("span"));
   const certified=labels.find(el=>/^(Tiendas certificadas|Certified Stores)$/.test((el.textContent||"").trim()));
   const row=certified?.parentElement as HTMLElement|null;
   if(row&&row.dataset.certifiedEnabled!=="1"){
    row.dataset.certifiedEnabled="1";row.removeAttribute("title");row.className="mb-1 flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground";
    Array.from(row.children).forEach(child=>{if(child!==certified&&/^(Próximamente|Coming soon)$/i.test((child.textContent||"").trim()))child.remove()});
    row.setAttribute("role","link");row.setAttribute("tabindex","0");
    row.onclick=()=>{location.href="/certified-stores"};row.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();location.href="/certified-stores"}};
   }
   const url=imageUrl();if(!url)return;
   const avatar=document.querySelector<HTMLElement>('[aria-label="Imagen de perfil"],[aria-label="Profile image"]');
   if(avatar&&avatar.dataset.savedIdentity!==url){avatar.dataset.savedIdentity=url;avatar.innerHTML="";const img=document.createElement("img");img.src=url;img.alt="";img.className="h-full w-full object-cover";avatar.appendChild(img)}
  };
  void(async()=>{const{data:{user}}=await s.auth.getUser();if(!user||cancelled)return;const{data}=await s.from("profiles").select("seller_type,avatar_key,store_logo_path").eq("id",user.id).maybeSingle();if(cancelled)return;profile=(data||null) as MenuProfile|null;enhance();observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true})})();
  return()=>{cancelled=true;observer?.disconnect()};
 },[]);
 return null;
}
