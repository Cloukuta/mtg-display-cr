"use client";

import {useEffect} from "react";

const CARD_ID_RE=/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jpg(?:\?|$)/i;
type FaceInfo={front:string;back:string}|null;
const cache=new Map<string,Promise<FaceInfo>>();

function faceInfo(id:string){
  let pending=cache.get(id);
  if(!pending){
    pending=fetch(`https://api.scryfall.com/cards/${id}`,{headers:{Accept:"application/json"}})
      .then(async r=>{if(!r.ok)return null;const card=await r.json();const front=card.image_uris?.normal||card.image_uris?.small||card.card_faces?.[0]?.image_uris?.normal||card.card_faces?.[0]?.image_uris?.small||null;const back=card.card_faces?.[1]?.image_uris?.normal||card.card_faces?.[1]?.image_uris?.small||null;return front&&back?{front,back}:null})
      .catch(()=>null);
    cache.set(id,pending);
  }
  return pending;
}

function enhance(img:HTMLImageElement){
  if(img.dataset.dfcChecked==="1")return;
  const src=img.currentSrc||img.src;
  if(!src.includes("cards.scryfall.io"))return;
  const match=src.match(CARD_ID_RE);if(!match)return;
  img.dataset.dfcChecked="1";
  void faceInfo(match[1]).then(info=>{
    if(!info||!img.isConnected)return;
    const host=img.parentElement;if(!host||host.querySelector(":scope > [data-dfc-toggle]"))return;
    const position=getComputedStyle(host).position;if(position==="static")host.style.position="relative";
    const button=document.createElement("button");button.type="button";button.dataset.dfcToggle="1";button.setAttribute("aria-label","Ver reverso");button.title="Ver reverso";
    button.className="absolute bottom-2 right-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90";
    button.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
    let back=false;
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();back=!back;img.src=back?info.back:info.front;button.setAttribute("aria-label",back?"Ver frente":"Ver reverso");button.title=back?"Ver frente":"Ver reverso"});
    host.appendChild(button);
  });
}

function scan(root:ParentNode=document){root.querySelectorAll<HTMLImageElement>('img[src*="cards.scryfall.io"]').forEach(enhance)}

export default function DoubleFaceImageEnhancer(){
  useEffect(()=>{
    scan();
    const observer=new MutationObserver(records=>{for(const record of records)for(const node of Array.from(record.addedNodes)){if(!(node instanceof Element))continue;if(node instanceof HTMLImageElement)enhance(node);scan(node)}});
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
