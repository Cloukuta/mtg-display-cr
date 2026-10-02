"use client";

import {useEffect,useState} from "react";
import type {User} from "@supabase/supabase-js";
import {Bell,LogIn} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import NotificationPreferencesSettings from "@/components/NotificationPreferencesSettings";
import PushNotificationsSettings from "@/components/PushNotificationsSettings";
import {getSupabase,isSupabaseConfigured} from "@/lib/supabase";
import {DEFAULT_LANGUAGE,LANGUAGE_STORAGE_KEY,type Language} from "@/lib/i18n";

export default function NotificationPreferencesPage(){
 const supabase=getSupabase(),configured=isSupabaseConfigured();
 const[user,setUser]=useState<User|null>(null),[phone,setPhone]=useState(""),[loading,setLoading]=useState(true),[language,setLanguage]=useState<Language>(DEFAULT_LANGUAGE);
 const es=language==="es";
 useEffect(()=>{const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(stored==="es"||stored==="en")setLanguage(stored);const h=(e:Event)=>{const d=(e as CustomEvent<Language>).detail;if(d==="es"||d==="en")setLanguage(d)};addEventListener("mtg-language-change",h);return()=>removeEventListener("mtg-language-change",h)},[]);
 useEffect(()=>{if(!supabase){setLoading(false);return}let active=true;void supabase.auth.getUser().then(async({data})=>{if(!active)return;setUser(data.user);if(data.user){const{data:profile}=await supabase.from("profiles").select("whatsapp").eq("id",data.user.id).maybeSingle();if(active)setPhone(profile?.whatsapp||"")}if(active)setLoading(false)});const{data:listener}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));return()=>{active=false;listener.subscription.unsubscribe()}},[supabase]);
 async function signIn(){if(supabase)await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${location.origin}/profile/notifications`}})}
 if(loading)return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">{es?"Cargando…":"Loading…"}</main>;
 if(!configured)return <main className="grid min-h-screen place-items-center bg-background p-5 text-muted-foreground">Supabase is not configured.</main>;
 if(!user)return <main className="min-h-screen bg-background"><AppHeader currentPath="/profile/notifications"/><div className="mx-auto grid max-w-md place-items-center px-5 py-20"><section className="w-full rounded-3xl border border-border bg-card p-8 text-center"><Bell className="mx-auto"/><h1 className="mt-5 font-serif text-3xl">{es?"Notificaciones":"Notifications"}</h1><p className="mt-3 text-muted-foreground">{es?"Inicia sesión para administrar tus preferencias.":"Sign in to manage your preferences."}</p><button onClick={signIn} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground"><LogIn size={18}/>{es?"Continuar con Google":"Continue with Google"}</button></section></div></main>;
 return <main className="min-h-screen bg-background text-foreground"><AppHeader currentPath="/profile/notifications"/><div className="mx-auto max-w-5xl px-4 py-7 sm:px-5"><div className="border-b border-border pb-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{es?"MI PERFIL":"MY PROFILE"}</p><h1 className="mt-2 font-serif text-4xl">{es?"Notificaciones":"Notifications"}</h1><p className="mt-2 text-muted-foreground">{es?"Administra los avisos del dispositivo y los canales de alertas de tu cuenta desde un solo lugar.":"Manage device notifications and your account alert channels in one place."}</p><a href="/profile" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">← {es?"Volver al perfil":"Back to profile"}</a></div><section className="mt-7 max-w-3xl rounded-2xl border border-border bg-card p-5"><h2 className="font-serif text-2xl">{es?"Notificaciones del dispositivo":"Device notifications"}</h2><p className="mt-1 mb-4 text-sm text-muted-foreground">{es?"Recibe avisos de mensajes y pedidos aunque MTG Display CR no esté abierto.":"Receive message and order alerts even when MTG Display CR is not open."}</p><PushNotificationsSettings userId={user.id}/></section><div className="mt-8"><NotificationPreferencesSettings user={user} defaultPhone={phone}/></div></div></main>
}
