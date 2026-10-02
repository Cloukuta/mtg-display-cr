"use client";

import {useEffect} from "react";

const labels:Record<string,string[]>={
 account:["Perfil público","Public profile"],
 store:["Tienda","Store"],
 buying:["Compras y recogida","Buying & pickup"],
 delivery:["Entregas y pagos","Delivery & payments"],
 notifications:["Notificaciones","Notifications"],
};

export default function ProfileSectionDeepLink(){
 useEffect(()=>{
  const requested=new URLSearchParams(window.location.search).get("section");
  if(!requested||!labels[requested])return;
  let attempts=0;
  const openRequested=()=>{
   const candidates=Array.from(document.querySelectorAll<HTMLButtonElement>("main button"));
   const target=candidates.find(button=>labels[requested].some(label=>button.textContent?.trim().includes(label)));
   if(target){target.click();return true}
   return false;
  };
  if(openRequested())return;
  const timer=window.setInterval(()=>{attempts+=1;if(openRequested()||attempts>=30)window.clearInterval(timer)},100);
  return()=>window.clearInterval(timer);
 },[]);
 return null;
}
