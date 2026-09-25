"use client";

import {useEffect} from "react";

const CARD_ID_RE=/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jpg(?:\?|$)/i;
type FaceInfo={front:string;back:string}|null;
const cache=new Map<string,Promise<FaceInfo>>();
let queue=Promise.resolve();

function faceInfo(id:string){
  let pending=cache.get(id);
  if(!pending){
    pending=new Promise<FaceInfo>(resolve=>{
      queue=queue.then(async()=>{
        try{
          const r=await fetch(`https://api.scryfall.com/cards/${id}`,{headers:{Accept:"application/json"}});
          if(!r.ok){resolve(null);return}
          const card=await r.json();
          const front=card.image_uris?.normal||card.image_uris?.small||card.card_faces?.[0]?.image_uris?.normal||card.card_faces?.[0]?.image_uris?.small||null;
          const back=card.card_faces?.[1]?.image_uris?.normal||card.card_faces?.[1]?.image_uris?.small||null;
          resolve(front&&back?{front,back}:null);
        }catch{resolve(null)}
        await new Promise(r=>setTimeout(r,110));
      });
    });
    cache.set(id,pending);
  }
  return pending;
}

function looksDoubleFaced(img:HTMLImageElement){
  if((img.alt||"").includes("//"))return true;
  const text=img.parentElement?.parentElement?.textContent||img.parentElement?.textContent||"";
  return text.includes("//");
}

function enhance(img:HTMLImageElement){
  const src=img.currentSrc||img.src;
  if(!src.includes("cards.scryfall.io")||!looksDoubleFaced(img))return;
  const match=src.match(CARD_ID_RE);if(!match)return;
  const id=match[1].toLowerCase();if(img.dataset.dfcCardId===id)return;
  img.dataset.dfcCardId=id;
  void faceInfo(id).then(info=>{
    if(!info||!img.isConnected||img.dataset.dfcCardId!==id)return;
    const host=img.parentElement;if(!host)return;
    const old=host.querySelector<HTMLElement>(":scope > [data-dfc-toggle]");if(old)old.remove();
    if(getComputedStyle(host).position==="static")host.style.position="relative";
    host.style.perspective="1000px";
    img.style.transformStyle="preserve-3d";
    img.style.backfaceVisibility="hidden";
    img.style.transition="transform 180ms ease-in, opacity 180ms ease-in";
    const button=document.createElement("button");button.type="button";button.dataset.dfcToggle="1";button.setAttribute("aria-label","Ver reverso");button.title="Ver reverso";
    button.className="absolute bottom-2 left-1/2 z-20 inline-flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/85 shadow-md backdrop-blur-[2px] transition hover:bg-black/55 hover:text-white";
    button.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
    let back=false,animating=false;
    button.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();if(animating)return;animating=true;
      const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const swap=()=>{back=!back;img.src=back?info.back:info.front;button.setAttribute("aria-label",back?"Ver frente":"Ver reverso");button.title=back?"Ver frente":"Ver reverso"};
      if(reduce){swap();animating=false;return}
      img.style.transform="rotateY(-90deg)";img.style.opacity="0.72";
      window.setTimeout(()=>{swap();img.style.transition="none";img.style.transform="rotateY(90deg)";void img.offsetWidth;img.style.transition="transform 180ms ease-out, opacity 180ms ease-out";img.style.transform="rotateY(0deg)";img.style.opacity="1";window.setTimeout(()=>{animating=false;img.style.transition="transform 180ms ease-in, opacity 180ms ease-in"},190)},180);
    });
    host.appendChild(button);
  });
}

function scan(root:ParentNode=document){root.querySelectorAll<HTMLImageElement>('img[src*="cards.scryfall.io"]').forEach(enhance)}

export default function DoubleFaceImageEnhancer(){
  useEffect(()=>{
    scan();
    const observer=new MutationObserver(records=>{for(const record of records){if(record.type==="attributes"&&record.target instanceof HTMLImageElement){enhance(record.target);continue}for(const node of Array.from(record.addedNodes)){if(!(node instanceof Element))continue;if(node instanceof HTMLImageElement)enhance(node);scan(node)}}});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});
    return()=>observer.disconnect();
  },[]);
  return null;
}
