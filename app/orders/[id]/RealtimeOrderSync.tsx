"use client";

import {useEffect,useRef,useState} from "react";
import {useParams} from "next/navigation";
import {getSupabase} from "@/lib/supabase";

type Health="connecting"|"connected"|"reconnecting"|"error";

/**
 * Order Room realtime transport.
 * Realtime only signals that persisted data changed. The Order Room owns the
 * actual fetch and applies it silently, so the visible page is never replaced
 * by a loading screen after the initial load.
 */
export default function RealtimeOrderSync(){
  const {id}=useParams<{id:string}>();
  const [health,setHealth]=useState<Health>("connecting");
  const reconnectTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const syncTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    const s=getSupabase();
    const orderId=Number(id);
    if(!s||!Number.isFinite(orderId))return;

    let active=true;
    let channel:ReturnType<typeof s.channel>|null=null;
    let attempts=0;

    const sync=()=>{
      if(!active)return;
      if(syncTimer.current)clearTimeout(syncTimer.current);
      syncTimer.current=setTimeout(()=>{
        if(active)window.dispatchEvent(new CustomEvent("mtg:order-room-sync",{detail:{orderId}}));
      },120);
    };

    const belongsToOrder=(payload:any,table:string)=>{
      const row=payload?.new&&Object.keys(payload.new).length?payload.new:payload?.old;
      return Number(table==="orders"?row?.id:row?.order_id)===orderId;
    };

    const postgresSync=(payload:any,table:string)=>{
      if(belongsToOrder(payload,table))sync();
    };

    const cleanupChannel=()=>{
      if(channel){void s.removeChannel(channel);channel=null;}
    };

    const connect=()=>{
      if(!active)return;
      cleanupChannel();
      setHealth(attempts?"reconnecting":"connecting");

      channel=s.channel(`order-room-${orderId}`,{config:{broadcast:{self:false}}})
        .on("broadcast",{event:"invalidate"},()=>sync())
        .on("postgres_changes",{event:"*",schema:"public",table:"orders"},payload=>postgresSync(payload,"orders"))
        .on("postgres_changes",{event:"*",schema:"public",table:"order_messages"},payload=>postgresSync(payload,"order_messages"))
        .on("postgres_changes",{event:"*",schema:"public",table:"order_attachments"},payload=>postgresSync(payload,"order_attachments"))
        .on("postgres_changes",{event:"*",schema:"public",table:"order_events"},payload=>postgresSync(payload,"order_events"))
        .on("postgres_changes",{event:"*",schema:"public",table:"order_items"},payload=>postgresSync(payload,"order_items"))
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

    return()=>{
      active=false;
      if(reconnectTimer.current)clearTimeout(reconnectTimer.current);
      if(syncTimer.current)clearTimeout(syncTimer.current);
      cleanupChannel();
    };
  },[id]);

  const label=health==="connected"?"Realtime conectado":health==="reconnecting"?"Reconectando realtime…":health==="error"?"Realtime desconectado":"Conectando realtime…";
  return <div className="fixed bottom-3 right-3 z-[80] rounded-full border border-border bg-card/95 px-3 py-1.5 text-[10px] font-bold text-muted-foreground shadow-sm" title="Order Room realtime status">
    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${health==="connected"?"bg-emerald-500":health==="error"?"bg-red-500":"bg-amber-500"}`}/>{label}
  </div>;
}
