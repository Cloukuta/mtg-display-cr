"use client";

import {useState} from "react";
import {RotateCcw} from "lucide-react";

type Props={
  front:string|null|undefined;
  back?:string|null;
  alt:string;
  className?:string;
  imageClassName?:string;
  buttonClassName?:string;
  frontLabel?:string;
  backLabel?:string;
};

export default function CardFaceImage({front,back,alt,className="",imageClassName="h-full w-full object-cover",buttonClassName="",frontLabel="Ver frente",backLabel="Ver reverso"}:Props){
  const[showBack,setShowBack]=useState(false);
  const src=showBack&&back?back:front;
  return <div className={`relative ${className}`}>
    {src?<img src={src} alt={showBack?`${alt} — back`:`${alt} — front`} className={imageClassName}/>:null}
    {front&&back&&<button
      type="button"
      onClick={e=>{e.preventDefault();e.stopPropagation();setShowBack(v=>!v)}}
      aria-label={showBack?frontLabel:backLabel}
      title={showBack?frontLabel:backLabel}
      className={`absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90 ${buttonClassName}`}
    >
      <RotateCcw size={17}/>
    </button>}
  </div>;
}
