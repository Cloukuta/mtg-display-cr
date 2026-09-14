"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MessageCircle, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type Profile = { id: string; public_name: string; whatsapp: string; location: string; delivery_text: string };
type Item = { id: number; quantity: number; condition: string; finish: string; price_crc: number; cards: { name: string; set_code: string; set_name: string; collector_number: string; image_uri: string | null } };
const crc = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 });

export default function SellerCatalog() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !slug) { setLoading(false); return; }
    void supabase.from("profiles").select("id,public_name,whatsapp,location,delivery_text").eq("slug", slug).eq("published", true).single().then(async ({ data }) => {
      if (!data) { setLoading(false); return; }
      setProfile(data as Profile);
      const result = await supabase.from("inventory_items").select("id,quantity,condition,finish,price_crc,cards(name,set_code,set_name,collector_number,image_uri)").eq("seller_id", data.id).eq("available", true).gt("quantity", 0).order("price_crc");
      setItems((result.data || []) as unknown as Item[]); setLoading(false);
    });
  }, [slug]);

  const visible = items.filter((item) => `${item.cards.name} ${item.cards.set_code} ${item.cards.set_name}`.toLowerCase().includes(search.toLowerCase()));
  const selected = items.filter((item) => cart[item.id]);
  const count = selected.reduce((sum, item) => sum + cart[item.id], 0);
  const total = selected.reduce((sum, item) => sum + cart[item.id] * item.price_crc, 0);
  const initials = useMemo(() => profile?.public_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "MTG", [profile]);

  function change(item: Item, delta: number) {
    setCart((current) => { const amount = Math.min(item.quantity, Math.max(0, (current[item.id] || 0) + delta)); const next = { ...current }; if (amount) next[item.id] = amount; else delete next[item.id]; return next; });
  }

  function whatsapp() {
    if (!profile) return;
    const detail = selected.map((item) => `• ${cart[item.id]}x ${item.cards.name} (${item.cards.set_code.toUpperCase()} #${item.cards.collector_number}) — ${crc.format(item.price_crc * cart[item.id])}`).join("\n");
    const text = `Hi ${profile.public_name}, I am interested in these cards:\n\n${detail}\n\nEstimated total: ${crc.format(total)}\nAre they still available?`;
    window.open(`https://wa.me/${profile.whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] text-white/50">Loading catalog…</main>;
  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] p-5 text-[#f4f3ed]"><section className="text-center"><h1 className="font-serif text-4xl">Display unavailable</h1><p className="mt-3 text-white/45">This link does not exist or the seller has not published the catalog yet.</p><a href="/" className="mt-6 inline-block rounded-xl bg-[#b9f54a] px-5 py-3 font-bold text-black">Go to home</a></section></main>;

  return <main className="min-h-screen bg-[#0b0e0d] pb-24 text-[#f4f3ed]">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0e0d]/90 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-7"><a href="/" className="font-semibold">MTG Display CR</a><button onClick={() => setOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-[#b9f54a] px-4 text-sm font-bold text-black"><ShoppingBag size={17} /> Inquiry {count ? `(${count})` : ""}</button></div></header>
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-7">
      <div className="flex items-end justify-between gap-5 border-b border-white/10 pb-7"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">Public catalog</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">{profile.public_name}</h1><p className="mt-2 text-sm text-white/45">{profile.location}{profile.delivery_text ? ` · ${profile.delivery_text}` : ""}</p></div><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#b9f54a] to-[#4da99d] font-serif text-xl font-bold text-black">{initials}</div></div>
      <label className="relative mt-6 block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or set…" className="h-12 w-full rounded-xl border border-white/10 bg-white/[.045] pl-11 pr-4 outline-none focus:border-[#b9f54a]" /></label>
      <p className="mb-5 mt-5 text-sm text-white/45"><strong className="text-white">{visible.length}</strong> cards available</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">{visible.map((item) => { const qty = cart[item.id] || 0; return <article key={item.id} className="min-w-0"><div className="overflow-hidden rounded-[4.7%/3.4%] bg-white/5">{item.cards.image_uri && <img src={item.cards.image_uri} alt={`Card ${item.cards.name}`} className="aspect-[488/680] w-full object-cover" />}</div><h2 className="mt-3 truncate font-semibold">{item.cards.name}</h2><p className="mt-1 truncate text-xs text-white/40">{item.cards.set_code.toUpperCase()} #{item.cards.collector_number} · {item.condition} · {item.finish}</p><div className="mt-3 flex items-center justify-between"><div><p className="font-bold text-[#b9f54a]">{crc.format(item.price_crc)}</p><p className="text-[11px] text-white/35">{item.quantity} available</p></div>{qty ? <div className="flex items-center rounded-xl bg-[#b9f54a] text-black"><button onClick={() => change(item, -1)} className="grid h-10 w-9 place-items-center"><Minus size={14} /></button><span className="w-5 text-center text-sm font-bold">{qty}</span><button onClick={() => change(item, 1)} disabled={qty >= item.quantity} className="grid h-10 w-9 place-items-center disabled:opacity-30"><Plus size={14} /></button></div> : <button onClick={() => change(item, 1)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 hover:bg-[#b9f54a] hover:text-black"><Plus size={17} /></button>}</div></article>; })}</div>
    </section>
    {count > 0 && <button onClick={() => setOpen(true)} className="fixed bottom-4 left-4 right-4 z-20 flex h-14 items-center justify-between rounded-2xl bg-[#b9f54a] px-5 font-bold text-black shadow-2xl md:hidden"><span>{count} cards</span><span>{crc.format(total)} · View inquiry</span></button>}
    {open && <div onMouseDown={(event) => event.currentTarget === event.target && setOpen(false)} className="fixed inset-0 z-40 flex justify-end bg-black/65 backdrop-blur-sm"><aside className="flex h-full w-full max-w-md flex-col bg-[#121614]"><div className="flex items-center justify-between border-b border-white/10 p-5"><h2 className="font-serif text-2xl">My inquiry</h2><button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10"><X size={17} /></button></div><div className="flex-1 space-y-4 overflow-y-auto p-5">{selected.map((item) => <div key={item.id} className="flex justify-between gap-3"><div><p className="font-semibold">{item.cards.name}</p><p className="mt-1 text-xs text-white/40">{cart[item.id]} × {crc.format(item.price_crc)}</p></div><strong className="text-[#b9f54a]">{crc.format(cart[item.id] * item.price_crc)}</strong></div>)}</div><div className="border-t border-white/10 p-5"><p className="mb-4 text-right font-serif text-3xl text-[#b9f54a]">{crc.format(total)}</p><button onClick={whatsapp} disabled={!count || !profile.whatsapp} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] font-bold text-[#07140b] disabled:opacity-40"><MessageCircle size={19} /> Ask on WhatsApp</button><p className="mt-3 text-center text-xs text-white/35">The seller will confirm availability and the final total.</p></div></aside></div>}
  </main>;
}
