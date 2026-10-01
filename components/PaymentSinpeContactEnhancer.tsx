"use client";

import {useEffect} from "react";
import {getSupabase} from "@/lib/supabase";

type PaymentOrder={
  buyer_id:string;
  status:string;
  total_crc:number|null;
  profiles:{whatsapp:string|null}|null;
};

function formatPhone(value:string){
  const digits=value.replace(/\D/g,"");
  const local=digits.startsWith("506")?digits.slice(3):digits;
  return local.length===8?`${local.slice(0,4)} ${local.slice(4)}`:value;
}

function formatCrc(value:number|null){
  if(value==null)return null;
  return new Intl.NumberFormat("es-CR",{style:"currency",currency:"CRC",maximumFractionDigits:0}).format(value);
}

export default function PaymentSinpeContactEnhancer(){
  useEffect(()=>{
    const match=window.location.pathname.match(/^\/orders\/(\d+)$/);
    if(!match)return;

    const orderId=Number(match[1]);
    let cancelled=false;
    let observer:MutationObserver|null=null;
    let realtimeChannel:ReturnType<NonNullable<ReturnType<typeof getSupabase>>["channel"]>|null=null;

    const removeContact=()=>{
      document.querySelector("[data-sinpe-whatsapp]")?.remove();
    };

    void(async()=>{
      const supabase=getSupabase();
      if(!supabase)return;

      const{data:{user}}=await supabase.auth.getUser();
      if(!user||cancelled)return;

      const renderForCurrentOrder=async()=>{
        const{data}=await supabase
          .from("orders")
          .select("buyer_id,status,total_crc,profiles!orders_seller_id_fkey(whatsapp)")
          .eq("id",orderId)
          .maybeSingle();

        if(cancelled||!data)return;
        const order=data as unknown as PaymentOrder;

        if(order.buyer_id!==user.id||order.status!=="payment_pending"){
          removeContact();
          return;
        }

        const whatsapp=order.profiles?.whatsapp?.trim();
        if(!whatsapp){
          removeContact();
          return;
        }

        const attach=()=>{
          if(document.querySelector("[data-sinpe-whatsapp]"))return true;

          const evidenceButton=Array.from(document.querySelectorAll("button")).find(button=>
            /Ver evidencia del pedido|View order evidence/i.test(button.textContent||"")
          );
          const banner=evidenceButton?.closest<HTMLElement>(".rounded-3xl")
            ?? Array.from(document.querySelectorAll<HTMLElement>(".rounded-3xl")).find(node=>
              /Esperando pago|Waiting for payment/i.test(node.textContent||"")
            );
          if(!banner)return false;

          const english=document.documentElement.lang==="en";
          const contact=document.createElement("div");
          contact.dataset.sinpeWhatsapp="1";
          contact.className="mt-4 rounded-2xl border border-border/70 bg-background/60 px-4 py-3";

          const label=document.createElement("p");
          label.className="text-xs font-semibold text-muted-foreground";
          label.textContent=english?"Seller SINPE Móvil":"SINPE Móvil del vendedor";

          const row=document.createElement("div");
          row.className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3";

          const number=document.createElement("p");
          number.className="min-w-0 break-words text-lg font-black tracking-wide text-foreground sm:flex-1";
          number.textContent=formatPhone(whatsapp);

          const copy=document.createElement("button");
          copy.type="button";
          copy.className="w-full rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted sm:w-auto sm:shrink-0 sm:py-1.5";
          copy.textContent=english?"Copy":"Copiar";
          copy.addEventListener("click",async()=>{
            try{
              await navigator.clipboard.writeText(whatsapp);
              copy.textContent=english?"Copied":"Copiado";
              window.setTimeout(()=>{copy.textContent=english?"Copy":"Copiar"},1500);
            }catch{
              copy.textContent=english?"Copy failed":"No se pudo copiar";
            }
          });

          row.append(number,copy);
          contact.append(label,row);

          const amount=formatCrc(order.total_crc);
          if(amount){
            const total=document.createElement("p");
            total.className="mt-2 break-words text-sm text-muted-foreground";
            total.textContent=english?`Exact amount: ${amount}`:`Monto exacto: ${amount}`;
            contact.appendChild(total);
          }

          if(evidenceButton)banner.insertBefore(contact,evidenceButton);
          else banner.appendChild(contact);
          return true;
        };

        if(!attach()&&!observer){
          observer=new MutationObserver(()=>{
            if(attach()){
              observer?.disconnect();
              observer=null;
            }
          });
          observer.observe(document.body,{childList:true,subtree:true});
        }
      };

      await renderForCurrentOrder();
      if(cancelled)return;

      realtimeChannel=supabase
        .channel(`sinpe-payment-order-${orderId}`)
        .on(
          "postgres_changes",
          {event:"UPDATE",schema:"public",table:"orders",filter:`id=eq.${orderId}`},
          ()=>{void renderForCurrentOrder();}
        )
        .subscribe();
    })();

    return()=>{
      cancelled=true;
      observer?.disconnect();
      removeContact();
      if(realtimeChannel){
        const supabase=getSupabase();
        if(supabase)void supabase.removeChannel(realtimeChannel);
      }
    };
  },[]);

  return null;
}
