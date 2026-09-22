"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {Bell,CheckCheck,Trash2,X} from "lucide-react";
import {getSupabase} from "@/lib/supabase";

type Notification={id:number;order_id:number|null;type:string;title:string;body:string|null;href:string|null;read_at:string|null;created_at:string};
type Props={userId:string|null};

export default function NotificationsBell({userId}:Props){
 const s=getSupabase();
 const[open,setOpen]=useState(false),[items,setItems]=useState<Notification[]>([]);
 const root=useRef<HTMLDivElement>(null);
 const load=useCallback(async()=>{if(!s||!userId){setItems([]);return}const{data}=await s.from("notifications").select("id,order_id,type,title,body,href,read_at,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(30);setItems((data||[]) as Notification[])},[s,userId]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(!s||!userId)return;const c=s.channel(`notifications-${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${userId}`},()=>void load()).subscribe();return()=>{void s.removeChannel(c)}},[s,userId,load]);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 if(!userId)return null;
 const unread=items.filter(x=>!x.read_at).length;
 async function markAll(){if(!s||!unread)return;await s.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",userId).is("read_at",null);await load()}
 async function removeOne(id:number){if(!s)return;await s.from("notifications").delete().eq("id",id).eq("user_id",userId);setItems(v=>v.filter(n=>n.id!==id))}
 async function removeAll(){if(!s||!items.length)return;if(!window.confirm("¿Eliminar todas las notificaciones? Esta acción no se puede deshacer."))return;await s.from("notifications").delete().eq("user_id",userId);setItems([])}
 async function visit(n:Notification){if(s&&!n.read_at)await s.from("notifications").update({read_at:new Date().toISOString()}).eq("id",n.id).eq("user_id",userId);if(n.href)location.href=n.href}
 return <div ref={root} className="relative">
  <button type="button" onClick={()=>setOpen(v=>!v)} aria-label="Notificaciones" className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"><Bell size={19}/>{unread>0&&<span className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground shadow-md">{unread>99?"99+":unread}</span>}</button>
  {open&&<div className="absolute right-0 top-12 z-[90] w-[min(92vw,400px)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"><div className="border-b border-border p-4"><div className="flex items-center justify-between"><div><strong>Notificaciones</strong><p className="text-xs text-muted-foreground">{unread?`${unread} sin leer`:"Todo al día"}</p></div></div>{items.length>0&&<div className="mt-3 flex flex-wrap gap-3">{unread>0&&<button onClick={()=>void markAll()} className="inline-flex items-center gap-1 text-xs font-bold text-primary"><CheckCheck size={15}/>Marcar todas</button>}<button onClick={()=>void removeAll()} className="inline-flex items-center gap-1 text-xs font-bold text-red-400"><Trash2 size={14}/>Eliminar todas</button></div>}</div><div className="max-h-[430px] overflow-y-auto">{items.length===0?<p className="p-8 text-center text-sm text-muted-foreground">Todavía no tienes notificaciones.</p>:items.map(n=><div key={n.id} className={`relative border-b border-border transition hover:bg-secondary/60 ${!n.read_at?"bg-primary/5":""}`}><button onClick={()=>void visit(n)} className="block w-full p-4 pr-12 text-left"><div className="flex gap-3">{!n.read_at&&<span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"/>}<div className={!n.read_at?"":"pl-5"}><strong className="text-sm">{n.title}</strong>{n.body&&<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}<p className="mt-2 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("es-CR")}</p></div></div></button><button type="button" aria-label="Eliminar notificación" title="Eliminar notificación" onClick={()=>void removeOne(n.id)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400"><X size={15}/></button></div>)}</div></div>}
 </div>
}
