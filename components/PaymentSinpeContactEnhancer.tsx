"use client";

import {useEffect} from "react";
import {getSupabase} from "@/lib/supabase";

type PaymentOrder={
  buyer_id:string;
  status:string;
  profiles:{whatsapp:string|null}|null;
};

export default function PaymentSinpeContactEnhancer(){
  useEffect(()=>{
    const match=window.location.pathname.match(/^\/orders\/(\d+)$/);
    if(!match)return;

    let cancelled=false;
    let observer:MutationObserver|null=null;

    void(async()=>{
      const supabase=getSupabase();
      if(!supabase)return;

      const{data:{user}}=await supabase.auth.getUser();
      if(!user||cancelled)return;

      const{data}=await supabase
        .from("orders")
        .select("buyer_id,status,profiles!orders_seller_id_fkey(whatsapp)")
        .eq("id",Number(match[1]))
        .maybeSingle();

      if(cancelled||!data)return;
      const order=data as unknown as PaymentOrder;
      if(order.buyer_id!==user.id||order.status!=="payment_pending")return;

      const whatsapp=order.profiles?.whatsapp?.trim();
      if(!whatsapp)return;

      const attach=()=>{
        if(document.querySelector("[data-sinpe-whatsapp]"))return true;
        const title=Array.from(document.querySelectorAll("strong")).find(node=>/Esperando pago|Waiting for payment/i.test(node.textContent||""));
        const banner=title?.closest<HTMLElement>(".rounded-3xl");
        if(!banner)return false;

        const contact=document.createElement("div");
        contact.dataset.sinpeWhatsapp="1";
        contact.className="mt-4 rounded-2xl border border-border/70 bg-background/60 px-4 py-3";

        const label=document.createElement("p");
        label.className="text-xs font-semibold text-muted-foreground";
        label.textContent=document.documentElement.lang==="en"?"WhatsApp for SINPE Móvil payment":"WhatsApp para hacer el SINPE Móvil";

        const number=document.createElement("p");
        number.className="mt-1 text-lg font-black tracking-wide text-foreground";
        number.textContent=whatsapp;

        contact.append(label,number);
        const evidenceButton=Array.from(banner.querySelectorAll("button")).find(button=>/Ver evidencia del pedido|View order evidence/i.test(button.textContent||""));
        if(evidenceButton)banner.insertBefore(contact,evidenceButton);
        else banner.appendChild(contact);
        return true;
      };

      if(!attach()){
        observer=new MutationObserver(()=>{if(attach()){observer?.disconnect();observer=null}});
        observer.observe(document.body,{childList:true,subtree:true});
      }
    })();

    return()=>{
      cancelled=true;
      observer?.disconnect();
      document.querySelector("[data-sinpe-whatsapp]")?.remove();
    };
  },[]);

  return null;
}
