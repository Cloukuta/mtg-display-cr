"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {Bell,CheckCheck} from "lucide-react";
import {getSupabase} from "@/lib/supabase";

type Notification={id:number;order_id:number|null;type:string;title:string;body:string|null;href:string|null;read_at:string|null;created_at:string};

export default function NotificationsBell(){
 const s=getSupabase();
 const[open,setOpen]=useState(false),[uid,setUid]=useState<string|null>(null),[items,setItems]=useState<Notification[]>([]);
 const root=useRef<HTMLDivElement>(null);
 const load=useCallback(async()=>{if(!s)return;const{data:{user}}=await s.auth.getUser();if(!user)return;setUid(user.id);const{data}=await s.from("notifications").select("id,order_id,type,title,body,href,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);setItems((data||[]) as Notification[])},[s]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(!s||!uid)return;const c=s.channel(`notifications-${uid}`).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${uid}`},()=>void load()).subscribe();return()=>{void s.removeChannel(c)}},[s,uid,load]);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 const unread=items.filter(x=>!x.read_at).length;
 async function markAll(){if(!s||!uid||!unread)return;await s.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",uid).is("read_at",null);await load()}
 async function visit(n:Notification){if(s&&!n.read_at)await s.from("notifications").update({read_at:new Date().toISOString()}).eq("id",n.id);if(n.href)location.href=n.href}
 return <div ref={root} className="relative">
  <button type="button" onClick={()=>setOpen(v=>!v)} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"><Bell size={19}/>{unread>0&&<span className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground shadow-md">{unread>99?"99+":unread}</span>}</button>
  {open&&<div className="absolute right-0 top-12 z-[90] w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border p-4"><div><strong>Notificaciones</strong><p className="text-xs text-muted-foreground">{unread?`${unread} sin leer`:"Todo al día"}</p></div>{unread>0&&<button onClick={()=>void markAll()} className="inline-flex items-center gap-1 text-xs font-bold text-primary"><CheckCheck size={15}/>Marcar todas</button>}</div><div className="max-h-[430px] overflow-y-auto">{items.length===0?<p className="p-8 text-center text-sm text-muted-foreground">Todavía no tienes notificaciones.</p>:items.map(n=><button key={n.id} onClick={()=>void visit(n)} className={`block w-full border-b border-border p-4 text-left transition hover:bg-secondary/60 ${!n.read_at?"bg-primary/5":""}`}><div className="flex gap-3">{!n.read_at&&<span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"/>}<div className={!n.read_at?"":"pl-5"}><strong className="text-sm">{n.title}</strong>{n.body&&<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}<p className="mt-2 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("es-CR")}</p></div></div></button>)}</div></div>}
 </div>
}
