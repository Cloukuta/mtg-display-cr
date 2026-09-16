"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MessageCircle, Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type PricingMode = "default" | "custom" | "discount";
type SortMode = "price-desc" | "price-asc" | "name-asc" | "name-desc";
type Profile = { id:string; public_name:string; whatsapp:string; location:string; delivery_text:string };
type Card = { scryfall_id:string; name:string; set_code:string; set_name:string; collector_number:string; image_uri:string|null };
type RawItem = { id:number; quantity:number; condition:string; finish:string; pricing_mode:PricingMode; custom_price_crc:number|null; cards:Card };
type Item = RawItem & { price_crc:number|null; market_price_usd:number|null };
type CardPrice = { scryfall_id:string; finish:string; condition:string; price_usd:number };
type PricingSettings = { usd_to_crc:number; discount_percent:number };

const crc = new Intl.NumberFormat("es-CR", { style:"currency", currency:"CRC", maximumFractionDigits:0 });

function normalizeFinish(value:string){
  const finish=value.trim().toLowerCase().replace(/[ _-]+/g,"");
  if(finish==="nonfoil"||finish==="normal") return "nonfoil";
  if(finish==="foil") return "foil";
  if(finish==="etched") return "etched";
  if(finish==="surgefoil") return "surgefoil";
  return finish;
}

function resolvePrice(item:RawItem, prices:CardPrice[], settings:PricingSettings):Item {
  if(item.pricing_mode==="custom") return {...item,price_crc:item.custom_price_crc,market_price_usd:null};
  const finish=normalizeFinish(item.finish);
  const condition=item.condition.trim().toUpperCase();
  const market=prices.find(p=>p.scryfall_id===item.cards.scryfall_id&&normalizeFinish(p.finish)===finish&&p.condition.toUpperCase()===condition);
  if(!market) return {...item,price_crc:null,market_price_usd:null};
  const base=Number(market.price_usd)*settings.usd_to_crc;
  const price=item.pricing_mode==="discount"?Math.round(base*(1-settings.discount_percent/100)):Math.round(base);
  return {...item,price_crc:price,market_price_usd:Number(market.price_usd)};
}

function comparePrice(a:Item,b:Item,direction:"asc"|"desc"){
  if(a.price_crc==null&&b.price_crc==null)return a.cards.name.localeCompare(b.cards.name);
  if(a.price_crc==null)return 1;
  if(b.price_crc==null)return -1;
  return direction==="asc"?a.price_crc-b.price_crc:b.price_crc-a.price_crc;
}

export default function SellerCatalog(){
  const {slug}=useParams<{slug:string}>();
  const [profile,setProfile]=useState<Profile|null>(null);
  const [items,setItems]=useState<Item[]>([]);
  const [search,setSearch]=useState("");
  const [setFilter,setSetFilter]=useState("");
  const [sort,setSort]=useState<SortMode>("price-desc");
  const [cart,setCart]=useState<Record<number,number>>({});
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const supabase=getSupabase();
    if(!supabase||!slug){setLoading(false);return;}
    void supabase.from("profiles").select("id,public_name,whatsapp,location,delivery_text").eq("slug",slug).eq("published",true).single().then(async({data})=>{
      if(!data){setLoading(false);return;}
      const seller=data as Profile; setProfile(seller);
      const [inventoryResult,settingsResult]=await Promise.all([
        supabase.from("inventory_items").select("id,quantity,condition,finish,pricing_mode,custom_price_crc,cards(scryfall_id,name,set_code,set_name,collector_number,image_uri)").eq("seller_id",seller.id).eq("available",true).gt("quantity",0),
        supabase.from("seller_pricing_settings").select("usd_to_crc,discount_percent").eq("seller_id",seller.id).maybeSingle()
      ]);
      const raw=(inventoryResult.data||[]) as unknown as RawItem[];
      const settings:PricingSettings=settingsResult.data?{usd_to_crc:Number(settingsResult.data.usd_to_crc),discount_percent:Number(settingsResult.data.discount_percent)}:{usd_to_crc:520,discount_percent:20};
      const ids=Array.from(new Set(raw.map(i=>i.cards?.scryfall_id).filter(Boolean)));
      let marketPrices:CardPrice[]=[];
      if(ids.length){
        const priceResult=await supabase.from("card_prices").select("scryfall_id,finish,condition,price_usd").eq("source","cardkingdom").in("scryfall_id",ids);
        marketPrices=(priceResult.data||[]) as CardPrice[];
      }
      setItems(raw.map(item=>resolvePrice(item,marketPrices,settings)));
      setLoading(false);
    });
  },[slug]);

  const sets=useMemo(()=>Array.from(new Map(items.map(item=>[item.cards.set_code.toLowerCase(),{code:item.cards.set_code.toLowerCase(),name:item.cards.set_name}])).values()).sort((a,b)=>a.code.localeCompare(b.code)),[items]);
  const visible=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return items.filter(item=>{
      if(setFilter&&item.cards.set_code.toLowerCase()!==setFilter)return false;
      return `${item.cards.name} ${item.cards.set_code} ${item.cards.set_name}`.toLowerCase().includes(term);
    }).sort((a,b)=>{
      if(sort==="price-asc")return comparePrice(a,b,"asc");
      if(sort==="price-desc")return comparePrice(a,b,"desc");
      if(sort==="name-desc")return b.cards.name.localeCompare(a.cards.name);
      return a.cards.name.localeCompare(b.cards.name);
    });
  },[items,search,setFilter,sort]);
  const selected=items.filter(item=>cart[item.id]);
  const count=selected.reduce((sum,item)=>sum+cart[item.id],0);
  const total=selected.reduce((sum,item)=>sum+cart[item.id]*(item.price_crc??0),0);
  const initials=useMemo(()=>profile?.public_name.split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"MTG",[profile]);

  function change(item:Item,delta:number){
    if(item.price_crc==null)return;
    setCart(current=>{const amount=Math.min(item.quantity,Math.max(0,(current[item.id]||0)+delta));const next={...current};if(amount)next[item.id]=amount;else delete next[item.id];return next;});
  }

  function whatsapp(){
    if(!profile)return;
    const detail=selected.map(item=>`• ${cart[item.id]}x ${item.cards.name} (${item.cards.set_code.toUpperCase()} #${item.cards.collector_number}) — ${crc.format((item.price_crc??0)*cart[item.id])}`).join("\n");
    const text=`Hi ${profile.public_name}, I am interested in these cards:\n\n${detail}\n\nEstimated total: ${crc.format(total)}\nAre they still available?`;
    window.open(`https://wa.me/${profile.whatsapp}?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");
  }

  if(loading)return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] text-white/50">Loading catalog…</main>;
  if(!profile)return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] p-5 text-[#f4f3ed]"><section className="text-center"><h1 className="font-serif text-4xl">Display unavailable</h1><p className="mt-3 text-white/45">This link does not exist or the seller has not published the catalog yet.</p><a href="/" className="mt-6 inline-block rounded-xl bg-[#b9f54a] px-5 py-3 font-bold text-black">Go to home</a></section></main>;

  return <main className="min-h-screen bg-[#0b0e0d] pb-24 text-[#f4f3ed]">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0e0d]/90 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-7"><a href="/" className="font-semibold">MTG Display CR</a><button onClick={()=>setOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-[#b9f54a] px-4 text-sm font-bold text-black"><ShoppingCart size={17}/> Cart {count?`(${count})`:""}</button></div></header>
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-7">
      <div className="flex items-end justify-between gap-5 border-b border-white/10 pb-7"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">Public catalog</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">{profile.public_name}</h1><p className="mt-2 text-sm text-white/45">{profile.location}{profile.delivery_text?` · ${profile.delivery_text}`:""}</p></div><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#b9f54a] to-[#4da99d] font-serif text-xl font-bold text-black">{initials}</div></div>
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px_220px]">
        <label className="relative block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or set…" className="h-12 w-full rounded-xl border border-white/10 bg-white/[.045] pl-11 pr-4 outline-none focus:border-[#b9f54a]"/></label>
        <select value={setFilter} onChange={e=>setSetFilter(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-[#121614] px-4 text-sm outline-none focus:border-[#b9f54a]"><option value="">Set: None</option>{sets.map(set=><option key={set.code} value={set.code}>{set.code.toUpperCase()} · {set.name}</option>)}</select>
        <select value={sort} onChange={e=>setSort(e.target.value as SortMode)} className="h-12 rounded-xl border border-white/10 bg-[#121614] px-4 text-sm outline-none focus:border-[#b9f54a]"><option value="price-desc">Price: High → Low</option><option value="price-asc">Price: Low → High</option><option value="name-asc">Name: A → Z</option><option value="name-desc">Name: Z → A</option></select>
      </div>
      <p className="mb-5 mt-5 text-sm text-white/45"><strong className="text-white">{visible.length}</strong> cards available</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">{visible.map(item=>{const qty=cart[item.id]||0;return <article key={item.id} className="min-w-0"><div className="overflow-hidden rounded-[4.7%/3.4%] bg-white/5">{item.cards.image_uri&&<img src={item.cards.image_uri} alt={`Card ${item.cards.name}`} className="aspect-[488/680] w-full object-cover"/>}</div><h2 className="mt-3 truncate font-semibold">{item.cards.name}</h2><p className="mt-1 truncate text-xs text-white/40">{item.cards.set_code.toUpperCase()} #{item.cards.collector_number} · {item.condition} · {item.finish}</p><div className="mt-3 flex items-center justify-between"><div><p className={`font-bold ${item.price_crc==null?"text-amber-400":"text-[#b9f54a]"}`}>{item.price_crc==null?"Price pending":crc.format(item.price_crc)}</p><p className="text-[11px] text-white/35">{item.quantity} available</p></div>{item.price_crc!=null&&(qty?<div className="flex items-center rounded-xl bg-[#b9f54a] text-black"><button onClick={()=>change(item,-1)} className="grid h-10 w-9 place-items-center"><Minus size={14}/></button><span className="w-5 text-center text-sm font-bold">{qty}</span><button onClick={()=>change(item,1)} disabled={qty>=item.quantity} className="grid h-10 w-9 place-items-center disabled:opacity-30"><Plus size={14}/></button></div>:<button onClick={()=>change(item,1)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 hover:bg-[#b9f54a] hover:text-black"><Plus size={17}/></button>)}</div></article>})}</div>
    </section>
    {count>0&&<button onClick={()=>setOpen(true)} className="fixed bottom-4 left-4 right-4 z-20 flex h-14 items-center justify-between rounded-2xl bg-[#b9f54a] px-5 font-bold text-black shadow-2xl md:hidden"><span>{count} cards</span><span>{crc.format(total)} · View cart</span></button>}
    {open&&<div onMouseDown={event=>event.currentTarget===event.target&&setOpen(false)} className="fixed inset-0 z-40 flex justify-end bg-black/65 backdrop-blur-sm"><aside className="flex h-full w-full max-w-md flex-col bg-[#121614]"><div className="flex items-center justify-between border-b border-white/10 p-5"><h2 className="font-serif text-2xl">My cart</h2><button onClick={()=>setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10"><X size={17}/></button></div><div className="flex-1 space-y-4 overflow-y-auto p-5">{selected.map(item=><div key={item.id} className="flex justify-between gap-3"><div><p className="font-semibold">{item.cards.name}</p><p className="mt-1 text-xs text-white/40">{cart[item.id]} × {crc.format(item.price_crc??0)}</p></div><strong className="text-[#b9f54a]">{crc.format(cart[item.id]*(item.price_crc??0))}</strong></div>)}</div><div className="border-t border-white/10 p-5"><p className="mb-4 text-right font-serif text-3xl text-[#b9f54a]">{crc.format(total)}</p><button onClick={whatsapp} disabled={!count||!profile.whatsapp} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] font-bold text-[#07140b] disabled:opacity-40"><MessageCircle size={19}/> Ask on WhatsApp</button><p className="mt-3 text-center text-xs text-white/35">The seller will confirm availability and the final total.</p></div></aside></div>}
  </main>;
}
