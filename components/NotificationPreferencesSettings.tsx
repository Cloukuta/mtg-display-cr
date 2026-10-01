"use client";

import {useEffect,useMemo,useState} from "react";
import type {User} from "@supabase/supabase-js";
import {Bell,Check,Mail,MessageCircle,Save} from "lucide-react";
import InternationalPhoneInput from "@/components/InternationalPhoneInput";
import {getSupabase} from "@/lib/supabase";
import {DEFAULT_LANGUAGE,LANGUAGE_STORAGE_KEY,type Language} from "@/lib/i18n";

type Preferences={
  in_app_enabled:boolean;
  email_enabled:boolean;
  whatsapp_enabled:boolean;
  whatsapp_phone:string;
  whatsapp_opt_in_at:string|null;
};

const defaults:Preferences={in_app_enabled:true,email_enabled:false,whatsapp_enabled:false,whatsapp_phone:"",whatsapp_opt_in_at:null};

function normalizePhone(value:string){const digits=value.replace(/\D/g,"");return digits?`+${digits}`:""}

export default function NotificationPreferencesSettings({user,defaultPhone}:{user:User;defaultPhone?:string}){
  const supabase=getSupabase();
  const[prefs,setPrefs]=useState<Preferences>(defaults),[saved,setSaved]=useState<Preferences|null>(null),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[notice,setNotice]=useState(""),[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);
  const es=language==="es";

  useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const h=(e:Event)=>{const d=(e as CustomEvent<Language>).detail;if(d==="es"||d==="en")setLanguage(d)};addEventListener("mtg-language-change",h);return()=>removeEventListener("mtg-language-change",h)},[]);

  useEffect(()=>{if(!supabase)return;let cancelled=false;void supabase.from("notification_preferences").select("in_app_enabled,email_enabled,whatsapp_enabled,whatsapp_phone,whatsapp_opt_in_at").eq("user_id",user.id).maybeSingle().then(({data,error})=>{if(cancelled)return;if(error){setNotice(error.message);setLoading(false);return}const next=data?{...data,whatsapp_phone:data.whatsapp_phone||""} as Preferences:{...defaults,whatsapp_phone:defaultPhone||""};setPrefs(next);setSaved(next);setLoading(false)});return()=>{cancelled=true}},[supabase,user.id,defaultPhone]);

  const dirty=useMemo(()=>saved!==null&&JSON.stringify(prefs)!==JSON.stringify(saved),[prefs,saved]);

  async function save(){if(!supabase)return;setWorking(true);setNotice("");const phone=normalizePhone(prefs.whatsapp_phone);if(prefs.whatsapp_enabled&&!phone){setNotice(es?"Agrega un número de WhatsApp antes de activar este canal.":"Add a WhatsApp number before enabling this channel.");setWorking(false);return}const optIn=prefs.whatsapp_enabled?(prefs.whatsapp_opt_in_at||new Date().toISOString()):null;const next={...prefs,whatsapp_phone:phone||null,whatsapp_opt_in_at:optIn};const{error}=await supabase.from("notification_preferences").upsert({user_id:user.id,...next,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error){setNotice(error.message);setWorking(false);return}const stored={...prefs,whatsapp_phone:phone,whatsapp_opt_in_at:optIn};setPrefs(stored);setSaved(stored);setWorking(false);setNotice(es?"Preferencias de notificación guardadas.":"Notification preferences saved.")}

  function toggle(key:"in_app_enabled"|"email_enabled"|"whatsapp_enabled"){setPrefs(cur=>({...cur,[key]:!cur[key],...(key==="whatsapp_enabled"&&cur.whatsapp_enabled?{whatsapp_opt_in_at:null}:{})}));setNotice("")}

  const channels=[
    {key:"in_app_enabled" as const,icon:Bell,title:es?"Dentro de MTG Display CR":"In MTG Display CR",description:es?"Alertas de disponibilidad dentro de la aplicación.":"Availability alerts inside the application.",ready:true},
    {key:"email_enabled" as const,icon:Mail,title:"Email",description:es?`Recibir alertas en ${user.email||"tu correo"}. El envío se conectará en W3.3.`:`Receive alerts at ${user.email||"your email"}. Delivery will be connected in W3.3.`,ready:false},
    {key:"whatsapp_enabled" as const,icon:MessageCircle,title:"WhatsApp",description:es?"Autoriza alertas de disponibilidad por WhatsApp. El proveedor de envío se conectará en W5.":"Authorize availability alerts by WhatsApp. The delivery provider will be connected in W5.",ready:false},
  ];

  if(loading)return <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{es?"Cargando preferencias…":"Loading preferences…"}</div>;

  return <section>
    <h2 className="font-serif text-3xl">{es?"Notificaciones":"Notifications"}</h2>
    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{es?"Elige cómo quieres recibir alertas de disponibilidad. Las notificaciones Push del navegador siguen configurándose por dispositivo.":"Choose how you want to receive availability alerts. Browser Push notifications remain configured per device."}</p>
    <div className="mt-6 grid max-w-3xl gap-3">{channels.map(({key,icon:Icon,title,description,ready})=>{const enabled=prefs[key];return <div key={key} className={`rounded-2xl border p-4 sm:p-5 ${enabled?"border-primary/35 bg-primary/[.05]":"border-border bg-card"}`}>
      <div className="flex items-start gap-3 sm:gap-4"><div className="mt-0.5 rounded-xl border border-border bg-background p-2"><Icon size={18}/></div><div className="min-w-0 flex-1"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong>{title}</strong>{!ready&&<span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{es?"Próximamente":"Coming next"}</span>}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div><button type="button" role="switch" aria-checked={enabled} onClick={()=>toggle(key)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled?"bg-primary":"bg-muted"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled?"left-6":"left-1"}`}/></button></div>
      {key==="whatsapp_enabled"&&enabled&&<div className="mt-4 border-t border-border/70 pt-4"><label className="grid gap-1.5 text-sm text-muted-foreground"><span>{es?"Número para recibir alertas":"Number for alerts"}</span><InternationalPhoneInput value={prefs.whatsapp_phone} onChange={v=>{setPrefs(cur=>({...cur,whatsapp_phone:v,whatsapp_opt_in_at:null}));setNotice("")}} ariaLabel={es?"WhatsApp para notificaciones":"WhatsApp for notifications"}/></label><div className="mt-3 flex items-start gap-2 rounded-xl bg-background/70 p-3 text-xs leading-5 text-muted-foreground"><Check size={15} className="mt-0.5 shrink-0 text-primary"/><span>{es?"Al guardar WhatsApp activado confirmas que deseas recibir estas alertas en este número. Puedes retirar el consentimiento desactivando este canal en cualquier momento.":"By saving with WhatsApp enabled, you confirm that you want to receive these alerts at this number. You can withdraw consent at any time by disabling this channel."}</span></div></div>}
      </div></div></div>})}</div>
    {notice&&<div className="mt-4 max-w-3xl rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div>}
    <div className="mt-5 flex max-w-3xl justify-end"><button type="button" onClick={save} disabled={working||!dirty} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40 sm:w-auto"><Save size={16}/>{working?(es?"Guardando…":"Saving…"):(es?"Guardar notificaciones":"Save notifications")}</button></div>
  </section>;
}
