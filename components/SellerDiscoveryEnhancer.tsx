"use client";

import {useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import SellerExplorer from "@/components/SellerExplorer";
import {getSupabase} from "@/lib/supabase";

type Seller={id:string;public_name:string|null;slug:string|null;location:string|null};

export default function SellerDiscoveryEnhancer(){
  const[host,setHost]=useState<HTMLElement|null>(null);
  const[sellers,setSellers]=useState<Seller[]>([]);
  const[lang,setLang]=useState("es");

  useEffect(()=>{
    if(window.location.pathname!=="/")return;
    setLang(document.documentElement.lang==="en"?"en":"es");
    let observer:MutationObserver|null=null;
    let portalHost:HTMLDivElement|null=null;

    const attach=()=>{
      const heading=Array.from(document.querySelectorAll("h2")).find(node=>/Explora vendedores|Explore sellers/i.test(node.textContent||""));
      const section=heading?.closest("section");
      if(!section)return false;
      const headingBlock=heading?.parentElement?.parentElement;
      if(!portalHost){
        portalHost=document.createElement("div");
        portalHost.dataset.sellerDiscovery="1";
        section.appendChild(portalHost);
        setHost(portalHost);
      }
      Array.from(section.children).forEach(child=>{
        if(child===headingBlock||child===portalHost)return;
        (child as HTMLElement).style.display="none";
      });
      return true;
    };

    if(!attach()){
      observer=new MutationObserver(()=>{if(attach()){observer?.disconnect();observer=null}});
      observer.observe(document.body,{childList:true,subtree:true});
    }else{
      observer=new MutationObserver(()=>attach());
      const section=portalHost?.parentElement;if(section)observer.observe(section,{childList:true});
    }

    void(async()=>{
      const s=getSupabase();if(!s)return;
      const[{data:profiles},{data:inventory}]=await Promise.all([
        s.from("profiles").select("id,public_name,slug,location").eq("published",true).not("slug","is",null),
        s.from("inventory_items").select("seller_id").eq("available",true).gt("quantity",0),
      ]);
      const active=new Set((inventory||[]).map(row=>String(row.seller_id)));
      setSellers(((profiles||[]) as Seller[]).filter(seller=>active.has(seller.id)));
    })();

    return()=>{
      observer?.disconnect();
      if(portalHost){
        const section=portalHost.parentElement;
        portalHost.remove();
        if(section)Array.from(section.children).forEach(child=>((child as HTMLElement).style.display=""));
      }
    };
  },[]);

  const content=useMemo(()=>host?<SellerExplorer sellers={sellers} es={lang==="es"}/>:null,[host,lang,sellers]);
  return host&&content?createPortal(content,host):null;
}
