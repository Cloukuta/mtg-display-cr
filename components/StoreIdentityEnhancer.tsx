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
    const pathname=window.location.pathname;
    if(pathname!=="/"&&!pathname.startsWith("/v/"))return;
    let cancelled=false;
    let observer:MutationObserver|null=null;
    let lastSignature="";
    const s=getSupabase();
    if(!s)return;

    void(async()=>{
      const{data}=await s.from("profiles").select("public_name,slug,seller_type,verification_status").eq("published",true).eq("seller_type","store");
      if(cancelled)return;
      const identities=(data||[]) as Identity[];
      const bySlug=new Map(identities.filter(x=>x.slug).map(x=>[x.slug!,x]));

      const attach=()=>{
        const next:Mount[]=[];
        const slugMatch=pathname.match(/^\/v\/([^/]+)/);
        if(slugMatch){
          const identity=bySlug.get(decodeURIComponent(slugMatch[1]));
          const heading=Array.from(document.querySelectorAll("main h1")).find(node=>node.textContent?.trim());
          if(identity&&heading){
            let host=document.querySelector<HTMLElement>("[data-storefront-identity]");
            if(host&&!host.isConnected)host=null;
            if(!host){host=document.createElement("div");host.dataset.storefrontIdentity="1";host.className="mt-2";heading.insertAdjacentElement("afterend",host)}
            next.push({host,identity,compact:false});
          }
        }

        if(pathname==="/"){
          document.querySelectorAll<HTMLAnchorElement>("#cards a[href^='/v/']").forEach(link=>{
            const href=link.getAttribute("href")||"";
            const match=href.match(/^\/v\/([^/?#]+)/);
            const identity=match?bySlug.get(decodeURIComponent(match[1])):undefined;
            if(!identity)return;
            const sellerBlock=Array.from(link.querySelectorAll("div")).find(div=>div.className.includes("border-t")&&div.className.includes("pt-3"));
            if(!sellerBlock)return;
            let host=sellerBlock.querySelector<HTMLElement>("[data-marketplace-store-identity]");
            if(!host){host=document.createElement("span");host.dataset.marketplaceStoreIdentity="1";host.className="ml-auto shrink-0";sellerBlock.appendChild(host)}
            next.push({host,identity,compact:true});
          });
        }
        const connected=next.filter(({host})=>host.isConnected);
        const signature=connected.map(({host,identity,compact})=>`${host.dataset.storefrontIdentity?"storefront":"market"}:${identity.slug||identity.public_name}:${compact}`).join("|");
        if(signature!==lastSignature){lastSignature=signature;setMounts(connected)}
      };

      attach();
      observer=new MutationObserver(()=>attach());
      observer.observe(document.body,{childList:true,subtree:true});
    })();

    return()=>{
      cancelled=true;
      observer?.disconnect();
      document.querySelectorAll("[data-storefront-identity],[data-marketplace-store-identity]").forEach(host=>host.remove());
    };
  },[]);

  return <>{mounts.map(({host,identity,compact},index)=>createPortal(<StoreIdentityBadges sellerType={identity.seller_type} verificationStatus={identity.verification_status} compact={compact}/>,host,`${identity.slug||identity.public_name}-${index}`))}</>;
}
