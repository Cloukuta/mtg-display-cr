"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import StoreLogoUploader from "@/components/StoreLogoUploader";
import ProfileCoverBannerEditor from "@/components/ProfileCoverBannerEditor";
import {getSupabase} from "@/lib/supabase";
import {DEFAULT_LANGUAGE,LANGUAGE_STORAGE_KEY,type Language} from "@/lib/i18n";

export default function ProfileStoreLogoMount(){
 const[userId,setUserId]=useState<string|null>(null),[target,setTarget]=useState<HTMLElement|null>(null),[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);
 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const s=getSupabase();if(!s)return;void s.auth.getUser().then(({data})=>setUserId(data.user?.id||null));const{data}=s.auth.onAuthStateChange((_e,session)=>setUserId(session?.user?.id||null));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{let timer:number|undefined;const locate=()=>{const sections=Array.from(document.querySelectorAll("section"));const storeSection=sections.find(section=>Array.from(section.querySelectorAll("span")).some(span=>span.textContent?.trim()==="/v/"));if(storeSection){setTarget(storeSection as HTMLElement);return}timer=window.setTimeout(locate,150)};locate();return()=>{if(timer)window.clearTimeout(timer)}},[]);
 if(!userId||!target)return null;
 return createPortal(<div className="mt-6 max-w-2xl"><StoreLogoUploader userId={userId} es={language==="es"}/><ProfileCoverBannerEditor userId={userId} es={language==="es"}/></div>,target);
}
