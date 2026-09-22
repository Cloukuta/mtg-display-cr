"use client";

import {useEffect} from "react";
import {useParams} from "next/navigation";
import {getSupabase} from "@/lib/supabase";

/**
 * Hotfix safety net for Order Room v1.
 * Supabase remains the source of truth: any relevant remote mutation causes
 * the open order room to re-sync automatically, removing the need for F5.
 * A short debounce collapses RPCs that update orders/events/items together.
 */
export default function RealtimeOrderSync(){
  const {id}=useParams<{id:string}>();

  useEffect(()=>{
    const s=getSupabase();
    const orderId=Number(id);
    if(!s||!Number.isFinite(orderId))return;

    let timer:ReturnType<typeof setTimeout>|null=null;
    let active=true;
    const sync=()=>{
      if(!active)return;
      if(timer)clearTimeout(timer);
      timer=setTimeout(()=>{
        if(active)window.location.reload();
      },180);
    };

    const channel=s.channel(`order-room-sync-${orderId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`id=eq.${orderId}`},sync)
      .on("postgres_changes",{event:"*",schema:"public",table:"order_messages",filter:`order_id=eq.${orderId}`},sync)
      .on("postgres_changes",{event:"*",schema:"public",table:"order_attachments",filter:`order_id=eq.${orderId}`},sync)
      .on("postgres_changes",{event:"*",schema:"public",table:"order_events",filter:`order_id=eq.${orderId}`},sync)
      .on("postgres_changes",{event:"*",schema:"public",table:"order_items",filter:`order_id=eq.${orderId}`},sync)
      .subscribe();

    return()=>{
      active=false;
      if(timer)clearTimeout(timer);
      void s.removeChannel(channel);
    };
  },[id]);

  return null;
}
