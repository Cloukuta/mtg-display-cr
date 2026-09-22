"use client";

import {useEffect,useState} from "react";
import {Star,X} from "lucide-react";
import {useParams} from "next/navigation";
import {getSupabase} from "@/lib/supabase";
import {DEFAULT_LANGUAGE,LANGUAGE_STORAGE_KEY,type Language} from "@/lib/i18n";

const feedbackOptions=[
  {id:"responds_quickly",es:"Responde rápido",en:"Responds quickly"},
  {id:"good_communication",es:"Buena comunicación",en:"Good communication"},
  {id:"accurate_description",es:"Descripción correcta",en:"Accurate description"},
  {id:"well_packaged",es:"Bien empacado",en:"Well packaged"},
  {id:"on_time_delivery",es:"Entrega a tiempo",en:"On-time delivery"},
] as const;

export default function OrderLayout({children}:{children:React.ReactNode}){
  const {id}=useParams<{id:string}>();
  const [lang,setLang]=useState<Language>(DEFAULT_LANGUAGE);
  const [show,setShow]=useState(false);
  const [rating,setRating]=useState(5);
  const [hover,setHover]=useState(0);
  const [comment,setComment]=useState("");
  const [tags,setTags]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [submitted,setSubmitted]=useState(false);
  const es=lang==="es";

  useEffect(()=>{
    const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if(stored==="es"||stored==="en")setLang(stored);
    void checkReview();

    const s=getSupabase();
    const openReview=()=>{setSubmitted(false);setError("");setShow(true)};
    const localOpen=(event:Event)=>{
      const detail=(event as CustomEvent<{orderId:number}>).detail;
      if(detail?.orderId===Number(id))openReview();
    };
    window.addEventListener("mtg:order-received",localOpen);

    const channel=s?.channel(`order-review-${id}`).on(
      "postgres_changes",
      {event:"UPDATE",schema:"public",table:"orders",filter:`id=eq.${Number(id)}`},
      payload=>{
        const next=payload.new as {buyer_id?:string;status?:string};
        if(next.status!=="completed")return;
        void s.auth.getUser().then(({data:{user}})=>{
          if(user&&next.buyer_id===user.id)openReview();
        });
      }
    ).subscribe();

    return()=>{
      window.removeEventListener("mtg:order-received",localOpen);
      if(s&&channel)void s.removeChannel(channel);
    };
  },[id]);

  async function checkReview(){
    const s=getSupabase();
    if(!s)return;
    const {data:{user}}=await s.auth.getUser();
    if(!user)return;
    const {data:order}=await s.from("orders").select("id,buyer_id,status").eq("id",Number(id)).maybeSingle();
    if(!order||order.buyer_id!==user.id||order.status!=="completed")return;
    const {data:review}=await s.from("order_reviews").select("id").eq("order_id",Number(id)).maybeSingle();
    setShow(!review);
  }

  function toggleTag(tag:string){setTags(current=>current.includes(tag)?current.filter(value=>value!==tag):[...current,tag])}

  async function submit(){
    const s=getSupabase();if(!s)return;
    setBusy(true);setError("");
    const {error:e}=await s.rpc("submit_order_review",{p_order_id:Number(id),p_rating:rating,p_comment:comment.trim()||null,p_feedback_tags:tags});
    if(e){setError(es?"No pudimos guardar tu valoración. Inténtalo nuevamente.":"We couldn't save your review. Please try again.");setBusy(false);return}
    setSubmitted(true);setBusy(false);setTimeout(()=>setShow(false),900);
  }

  return <>{children}{show&&<div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4"><div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">{es?"Pedido recibido":"Order received"}</p><h2 className="mt-1 font-serif text-3xl">{es?"¿Cómo fue tu compra?":"How was your purchase?"}</h2><p className="mt-2 text-sm text-muted-foreground">{es?"Califica al vendedor y selecciona lo que destacó en esta compra.":"Rate the seller and select what stood out in this purchase."}</p></div><button type="button" onClick={()=>setShow(false)} className="rounded-lg p-1 text-muted-foreground" aria-label={es?"Cerrar":"Close"}><X size={20}/></button></div>{submitted?<div className="mt-6 rounded-2xl bg-primary/10 p-5 text-center"><strong className="text-primary">{es?"¡Gracias por tu valoración!":"Thanks for your review!"}</strong></div>:<><div className="mt-6 flex justify-center gap-2" onMouseLeave={()=>setHover(0)}>{[1,2,3,4,5].map(value=><button key={value} type="button" onMouseEnter={()=>setHover(value)} onClick={()=>setRating(value)} className="p-1" aria-label={`${value} ${es?"estrellas":"stars"}`}><Star size={34} className={(hover||rating)>=value?"fill-primary text-primary":"text-muted-foreground"}/></button>)}</div><p className="mt-2 text-center text-sm font-bold">{rating}/5</p><div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-[.12em] text-muted-foreground">{es?"¿Qué salió bien?":"What went well?"}</p><div className="flex flex-wrap gap-2">{feedbackOptions.map(option=>{const selected=tags.includes(option.id);return <button key={option.id} type="button" aria-pressed={selected} onClick={()=>toggleTag(option.id)} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${selected?"border-primary bg-primary/10 text-primary":"border-border bg-background text-muted-foreground hover:text-foreground"}`}>{es?option.es:option.en}</button>})}</div></div><textarea value={comment} onChange={e=>setComment(e.target.value)} maxLength={1000} rows={4} placeholder={es?"Cuéntanos cómo fue tu experiencia (opcional)":"Tell us about your experience (optional)"} className="mt-5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"/><div className="mt-1 text-right text-[10px] text-muted-foreground">{comment.length}/1000</div>{error&&<p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}<button type="button" onClick={()=>void submit()} disabled={busy} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50">{busy?(es?"Guardando…":"Saving…"):(es?"Publicar valoración":"Submit review")}</button><button type="button" onClick={()=>setShow(false)} className="mt-2 w-full px-4 py-2 text-sm font-semibold text-muted-foreground">{es?"Ahora no":"Not now"}</button></>}</div></div>}</>;
}
