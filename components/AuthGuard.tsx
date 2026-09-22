"use client";

import {useEffect,useState,type ReactNode} from "react";
import {getSupabase} from "@/lib/supabase";

type Props={children:ReactNode};
export default function AuthGuard({children}:Props){
 const s=getSupabase();
 const[state,setState]=useState<"checking"|"allowed"|"guest">("checking");
 useEffect(()=>{if(!s){setState("guest");return}let active=true;void s.auth.getUser().then(({data})=>{if(!active)return;setState(data.user?"allowed":"guest")});const{data}=s.auth.onAuthStateChange((_event,session)=>{if(active)setState(session?.user?"allowed":"guest")});return()=>{active=false;data.subscription.unsubscribe()}},[s]);
 useEffect(()=>{if(state==="guest"){const next=encodeURIComponent(location.pathname+location.search);location.replace(`/login?next=${next}`)}},[state]);
 if(state!=="allowed")return <main className="grid min-h-[70vh] place-items-center bg-background p-6 text-center text-muted-foreground"><div><div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"/><p>{state==="guest"?"Redirigiendo al inicio de sesión…":"Verificando sesión…"}</p></div></main>;
 return <>{children}</>;
}
