"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import StoreIdentityBadges from "@/components/StoreIdentityBadges";
import {getSupabase} from "@/lib/supabase";

type Identity={public_name:string|null;slug:string|null;seller_type:string|null;verification_status:string|null};
type Mount={host:HTMLElement;identity:Identity;compact:boolean};

export default function StoreIdentityEnhancer(){
  const[mounts,setMounts]=useState<Mount[]>([]);

  useEffect(()=>{
    let cancelled=false;
    let observer:MutationObserver|null=null;
    const hosts:HTMLElement[]=[];
    const s=getSupabase();
    if(!s)return;

    void(async()=>{
      const{data}=await s.from("profiles").select("public_name,slug,seller_type,verification_status").eq("published",true).eq("seller_type","store");
      if(cancelled)return;
      const identities=(data||[]) as Identity[];
      const bySlug=new Map(identities.filter(x=>x.slug).map(x=>[x.slug!,x]));
      const byName=new Map(identities.filter(x=>x.public_name).map(x=>[x.public_name!.trim(),x]));

      const attach=()=>{
        const next:Mount[]=[];
        const pathname=window.location.pathname;
        const slugMatch=pathname.match(/^\/v\/([^/]+)/);
        if(slugMatch){
          const identity=bySlug.get(decodeURIComponent(slugMatch[1]));
          const heading=Array.from(document.querySelectorAll("h1")).find(node=>node.textContent?.trim());
          if(identity&&heading){
            let host=heading.parentElement?.querySelector<HTMLElement>("[data-storefront-identity]");
            if(!host){host=document.createElement("div");host.dataset.storefrontIdentity="1";host.className="mt-2";heading.insertAdjacentElement("afterend",host);hosts.push(host)}
            next.push({host,identity,compact:false});
          }
        }

        if(pathname==="/"){
          document.querySelectorAll("a[href^='/v/']").forEach(link=>{
            const sellerName=Array.from(link.querySelectorAll("p")).find(p=>p.className.includes("font-bold"))?.textContent?.trim();
            const identity=sellerName?byName.get(sellerName):undefined;
            if(!identity)return;
            const sellerBlock=Array.from(link.querySelectorAll("div")).find(div=>div.className.includes("border-t")&&div.className.includes("pt-3"));
            if(!sellerBlock)return;
            let host=sellerBlock.querySelector<HTMLElement>("[data-marketplace-store-identity]");
            if(!host){host=document.createElement("span");host.dataset.marketplaceStoreIdentity="1";host.className="ml-auto shrink-0";sellerBlock.appendChild(host);hosts.push(host)}
            next.push({host,identity,compact:true});
          });
        }
        setMounts(next);
      };

      attach();
      observer=new MutationObserver(()=>attach());
      observer.observe(document.body,{childList:true,subtree:true});
    })();

    return()=>{cancelled=true;observer?.disconnect();hosts.forEach(host=>host.remove());setMounts([])};
  },[]);

  return <>{mounts.map(({host,identity,compact},index)=>createPortal(<StoreIdentityBadges sellerType={identity.seller_type} verificationStatus={identity.verification_status} compact={compact}/>,host,`${identity.slug||identity.public_name}-${index}`))}</>;
}
