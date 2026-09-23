"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import AppMenu from "@/components/AppMenu";
import BrandLogo from "@/components/BrandLogo";
import PendingSalesTestButton from "@/components/PendingSalesTestButton";
import CatalogInventoryEditor from "@/components/CatalogInventoryEditor";
import NotificationsBell from "@/components/NotificationsBell";
import { getSupabase } from "@/lib/supabase";
import {DEFAULT_LANGUAGE,LANGUAGE_STORAGE_KEY,type Language} from "@/lib/i18n";

const SELLER_ACTIONABLE_STATUSES=["inventory_confirmation","preparing_shipment","payment_submitted","paid"];
type SellerProfile={public_name:string|null;slug:string|null};type AppHeaderProps={currentPath?:string};
export default function AppHeader({currentPath=""}:AppHeaderProps){
 const supabase=getSupabase(),pathname=usePathname();const[menuOpen,setMenuOpen]=useState(false),[profile,setProfile]=useState<SellerProfile|null>(null),[userId,setUserId]=useState<string|null>(null),[authReady,setAuthReady]=useState(false),[pendingSellerActions,setPendingSellerActions]=useState(0),[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);
 const loadPendingSellerActions=useCallback(async(id:string)=>{if(!supabase)return;const{count,error}=await supabase.from("orders").select("id",{count:"exact",head:true}).eq("seller_id",id).eq("response_required_from","seller").in("status",SELLER_ACTIONABLE_STATUSES);if(!error)setPendingSellerActions(count||0)},[supabase]);
 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const h=(event:Event)=>{const next=(event as CustomEvent<Language>).detail;if(next==="es"||next==="en")setLanguage(next)};window.addEventListener("mtg-language-change",h);return()=>window.removeEventListener("mtg-language-change",h)},[]);
 useEffect(()=>{if(!supabase){setAuthReady(true);return}let active=true;async function applyUser(user:any){if(!active)return;if(!user){setUserId(null);setProfile(null);setPendingSellerActions(0);setAuthReady(true);return}setUserId(user.id);void loadPendingSellerActions(user.id);const{data}=await supabase!.from("profiles").select("public_name,slug").eq("id",user.id).maybeSingle();if(active){setProfile(data?{public_name:data.public_name??null,slug:data.slug??null}:null);setAuthReady(true)}}void supabase.auth.getUser().then(({data})=>applyUser(data.user));const{data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{void applyUser(session?.user??null)});return()=>{active=false;listener.subscription.unsubscribe()}},[supabase,loadPendingSellerActions]);
 useEffect(()=>{if(!supabase||!userId)return;const channel=supabase.channel(`header-pending-sales-${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`seller_id=eq.${userId}`},()=>void loadPendingSellerActions(userId)).subscribe();return()=>{void supabase.removeChannel(channel)}},[supabase,userId,loadPendingSellerActions]);
 return <><header className="sticky top-0 z-50 border-b border-border bg-background/95 text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85"><div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-7"><BrandLogo/><div className="flex items-center gap-2">{userId&&currentPath==="/pending-sales"&&<PendingSalesTestButton/>}{userId&&currentPath==="/catalog"&&pathname==="/catalog/binders"&&<CatalogInventoryEditor/>}{authReady&&userId&&<NotificationsBell userId={userId}/>}<button type="button" onClick={()=>setMenuOpen(true)} aria-label={language==="es"?"Abrir menú de navegación":"Open navigation menu"} aria-expanded={menuOpen} className="relative flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"><Menu size={19}/><span className="hidden sm:inline">{language==="es"?"Menú":"Menu"}</span>{userId&&pendingSellerActions>0&&<span className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-black leading-none text-black shadow-md">{pendingSellerActions>99?"99+":pendingSellerActions}</span>}</button></div></div></header><AppMenu open={menuOpen} onClose={()=>setMenuOpen(false)} currentPath={currentPath} sellerName={profile?.public_name} sellerSlug={profile?.slug} userId={userId} authReady={authReady}/></>
}
