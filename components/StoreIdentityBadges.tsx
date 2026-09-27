import {BadgeCheck,Store} from "lucide-react";

type Props={sellerType?:string|null;verificationStatus?:string|null;compact?:boolean;className?:string};

export default function StoreIdentityBadges({sellerType,verificationStatus,compact=false,className=""}:Props){
  const isStore=sellerType==="store";
  const isVerified=isStore&&verificationStatus==="verified";
  if(!isStore)return null;
  return <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
    <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-secondary/70 font-bold text-foreground ${compact?"px-2 py-0.5 text-[10px]":"px-2.5 py-1 text-xs"}`} title="Store"><Store size={compact?11:13}/>Store</span>
    {isVerified&&<span className={`inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 font-bold text-primary ${compact?"px-2 py-0.5 text-[10px]":"px-2.5 py-1 text-xs"}`} title="Certified Store"><BadgeCheck size={compact?11:13}/>Certified</span>}
  </span>;
}
