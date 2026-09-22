"use client";

import {useEffect,useRef,useState} from "react";
import {useParams} from "next/navigation";
import {getSupabase} from "@/lib/supabase";

type Health="connecting"|"connected"|"reconnecting"|"error";

/**
 * Order Room realtime safety net.
 *
 * We intentionally subscribe without server-side row filters and validate the
 * order id from each payload in the browser. This avoids a filtered-channel
 * edge case that could leave an apparently subscribed room without receiving
 * mutations. Supabase remains the source of truth: a matching remote mutation
 * triggers a short debounced reload of the current room.
 */
export default function RealtimeOrderSync(){
  const {id}=useParams<{id:string}>();
  const [health,setHealth]=useState<Health>("connecting");
  const reconnectTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const reloadTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    const s=getSupabase();
    const orderId=Number(id);
    if(!s||!Number.isFinite(orderId))return;

    let active=true;
    let channel:ReturnType<typeof s.channel>|null=null;
    let attempts=0;

    const belongsToOrder=(payload:any,table:string)=>{
      const row=payload?.new&&Object.keys(payload.new).length?payload.new:payload?.old;
      const value=table==="orders"?row?.id:row?.order_id;
      return Number(value)===orderId;
    };

    const sync=(payload:any,table:string)=>{
      if(!active||!belongsToOrder(payload,table))return;
      if(reloadTimer.current)clearTimeout(reloadTimer.current);
      reloadTimer.current=setTimeout(()=>{
        if(active)window.location.reload();
      },120);
    };

    const cleanupChannel=()=>{
      if(channel){void s.removeChannel(channel);channel=null;}
    };

    const connect=()=>{
      if(!active)return;
      cleanupChannel();
      setHealth(attempts?"reconnecting":"connecting");

      channel=s.channel(`order-room-live-${orderId}-${crypto.randomUUID()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"orders"},payload=>sync(payload,"orders"))
        .on("postgres_changes",{event:"*",schema:"public",table:"order_messages"},payload=>sync(payload,"order_messages"))
        .on("postgres_changes",{event:"*",schema:"public",table:"order_attachments"},payload=>sync(payload,"order_attachments"))
        .on("postgres_changes",{event:"*",schema:"public",table:"order_events"},payload=>sync(payload,"order_events"))
        .on("postgres_changes",{event:"*",schema:"public",table:"order_items"},payload=>sync(payload,"order_items"))
        .subscribe(status=>{
          if(!active)return;
          if(status==="SUBSCRIBED"){
            attempts=0;
            setHealth("connected");
            return;
          }
          if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
            setHealth("error");
            cleanupChannel();
            attempts+=1;
            const delay=Math.min(1000*Math.pow(2,Math.min(attempts-1,4)),15000);
            if(reconnectTimer.current)clearTimeout(reconnectTimer.current);
            reconnectTimer.current=setTimeout(connect,delay);
          }
        });
    };

    connect();

    const onVisible=()=>{
      if(document.visibilityState==="visible"&&health!=="connected")connect();
    };
    document.addEventListener("visibilitychange",onVisible);

    return()=>{
      active=false;
      document.removeEventListener("visibilitychange",onVisible);
      if(reconnectTimer.current)clearTimeout(reconnectTimer.current);
      if(reloadTimer.current)clearTimeout(reloadTimer.current);
      cleanupChannel();
    };
  },[id]);

  const label=health==="connected"?"Realtime conectado":health==="reconnecting"?"Reconectando realtime…":health==="error"?"Realtime desconectado":"Conectando realtime…";
  return <div className="fixed bottom-3 right-3 z-[80] rounded-full border border-border bg-card/95 px-3 py-1.5 text-[10px] font-bold text-muted-foreground shadow-sm" title="Order Room realtime status">
    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${health==="connected"?"bg-emerald-500":health==="error"?"bg-red-500":"bg-amber-500"}`}/>{label}
  </div>;
}
