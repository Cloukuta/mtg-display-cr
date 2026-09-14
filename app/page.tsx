"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Filter, MessageCircle, Minus, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, X } from "lucide-react";

type Card = { id: number; name: string; set: string; setName: string; collector: string; condition: "NM" | "EX" | "VG"; finish: "Normal" | "Foil"; price: number; stock: number; image: string };

const cards: Card[] = [
  { id: 1, name: "Sol Ring", set: "CMM", setName: "Commander Masters", collector: "396", condition: "NM", finish: "Normal", price: 2500, stock: 4, image: "https://api.scryfall.com/cards/named?exact=Sol%20Ring&format=image&version=normal" },
  { id: 2, name: "Arcane Signet", set: "HOC", setName: "The Lord of the Rings Commander", collector: "95", condition: "NM", finish: "Foil", price: 3200, stock: 2, image: "https://api.scryfall.com/cards/named?exact=Arcane%20Signet&format=image&version=normal" },
  { id: 3, name: "Rhystic Study", set: "WOT", setName: "Wilds of Eldraine Enchanting Tales", collector: "25", condition: "NM", finish: "Normal", price: 19500, stock: 1, image: "https://api.scryfall.com/cards/named?exact=Rhystic%20Study&format=image&version=normal" },
  { id: 4, name: "Smothering Tithe", set: "WOT", setName: "Wilds of Eldraine Enchanting Tales", collector: "13", condition: "EX", finish: "Normal", price: 12800, stock: 1, image: "https://api.scryfall.com/cards/named?exact=Smothering%20Tithe&format=image&version=normal" },
  { id: 5, name: "Lightning Greaves", set: "CMM", setName: "Commander Masters", collector: "392", condition: "NM", finish: "Normal", price: 4200, stock: 3, image: "https://api.scryfall.com/cards/named?exact=Lightning%20Greaves&format=image&version=normal" },
  { id: 6, name: "Cyclonic Rift", set: "2XM", setName: "Double Masters", collector: "47", condition: "VG", finish: "Normal", price: 13750, stock: 1, image: "https://api.scryfall.com/cards/named?exact=Cyclonic%20Rift&format=image&version=normal" },
  { id: 7, name: "Teferi's Protection", set: "CMM", setName: "Commander Masters", collector: "67", condition: "NM", finish: "Foil", price: 16500, stock: 1, image: "https://api.scryfall.com/cards/named?exact=Teferi%27s%20Protection&format=image&version=normal" },
  { id: 8, name: "Command Tower", set: "LCC", setName: "Lost Caverns of Ixalan Commander", collector: "326", condition: "NM", finish: "Normal", price: 800, stock: 6, image: "https://api.scryfall.com/cards/named?exact=Command%20Tower&format=image&version=normal" },
];

const crc = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 });

export default function Home() {
  const [search, setSearch] = useState("");
  const [setFilter, setSetFilter] = useState("Todos los sets");
  const [finishFilter, setFinishFilter] = useState("Todos");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const visibleCards = useMemo(() => cards.filter((card) => {
    const query = search.trim().toLowerCase();
    return (!query || `${card.name} ${card.setName} ${card.set}`.toLowerCase().includes(query)) && (setFilter === "Todos los sets" || card.set === setFilter) && (finishFilter === "Todos" || card.finish === finishFilter);
  }), [search, setFilter, finishFilter]);

  const selected = cards.filter((card) => cart[card.id]);
  const itemCount = selected.reduce((sum, card) => sum + cart[card.id], 0);
  const total = selected.reduce((sum, card) => sum + card.price * cart[card.id], 0);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "stage_card_inquiry",
      title: "Preparar consulta de cartas",
      description: "Selecciona una o varias cartas visibles del catálogo y prepara sus cantidades para una consulta de compra.",
      inputSchema: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "integer", minimum: 1 } }, required: ["name", "quantity"], additionalProperties: false } },
        },
        required: ["items"], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { items?: Array<{ name?: unknown; quantity?: unknown }> };
        if (!Array.isArray(value.items) || value.items.length === 0) throw new Error("Incluye al menos una carta.");
        const next: Record<number, number> = {};
        for (const item of value.items) {
          const card = cards.find((candidate) => candidate.name.toLowerCase() === String(item.name || "").toLowerCase());
          const quantity = Number(item.quantity);
          if (!card || !Number.isInteger(quantity) || quantity < 1) throw new Error(`Carta o cantidad inválida: ${String(item.name || "")}`);
          next[card.id] = Math.min(quantity, card.stock);
        }
        setCart(next); setCartOpen(true);
        return { status: "prepared", items: Object.values(next).reduce((sum, quantity) => sum + quantity, 0) };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function updateQuantity(card: Card, delta: number) {
    setCart((current) => {
      const next = Math.max(0, Math.min(card.stock, (current[card.id] || 0) + delta));
      if (!next) { const copy = { ...current }; delete copy[card.id]; return copy; }
      return { ...current, [card.id]: next };
    });
  }

  function openWhatsApp() {
    const lines = selected.map((card) => `• ${cart[card.id]}x ${card.name} (${card.set} #${card.collector}) — ${crc.format(card.price * cart[card.id])}`);
    const message = `Hola, me interesan estas cartas de Vitrina Arcana:\n\n${lines.join("\n")}\n\nTotal estimado: ${crc.format(total)}\n¿Siguen disponibles?`;
    window.open(`https://wa.me/50688887777?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="min-h-screen bg-[#0b0e0d] text-[#f4f3ed]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0e0d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#b9f54a] text-[#10140d] shadow-[0_0_24px_rgba(185,245,74,.18)]"><Sparkles size={18} /></div>
            <div className="min-w-0"><p className="truncate font-semibold tracking-tight">MTG Vitrina CR</p><p className="truncate text-xs text-white/45">Catálogo de Jean Carlos</p></div>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
            <a className="text-white" href="#catalogo">Catálogo</a><a href="#vendedor">Sobre el vendedor</a><span className="flex items-center gap-1.5 text-[#b9f54a]"><ShieldCheck size={15} /> Catálogo verificado</span>
          </nav>
          <div className="flex items-center gap-2">
            <a href="/dashboard" className="hidden h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/75 transition hover:border-white/25 hover:text-white lg:flex">Vender cartas</a>
            <button onClick={copyLink} className="hidden h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-white/75 transition hover:border-white/25 hover:text-white sm:flex">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiado" : "Compartir"}</button>
            <button onClick={() => setCartOpen(true)} className="relative flex h-10 items-center gap-2 rounded-xl bg-[#b9f54a] px-4 text-sm font-bold text-[#11150d] transition hover:bg-[#cbff68]"><ShoppingBag size={17} /> <span className="hidden sm:inline">Mi consulta</span>{itemCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#11150d] px-1 text-[11px] text-white">{itemCount}</span>}</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 pb-6 pt-8 sm:px-7 sm:pt-12">
        <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl"><div className="mb-4 flex items-center gap-3 text-sm text-[#b9f54a]"><span className="h-px w-8 bg-[#b9f54a]" /> VITRINA ARCANA · DEMO</div><h1 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">Cartas listas para<br /><span className="italic text-white/55">tu próximo deck.</span></h1></div>
          <div id="vendedor" className="flex max-w-md items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#b9f54a] to-[#4da99d] font-serif text-xl font-bold text-[#10140d]">JC</div><div><p className="font-semibold">Jean Carlos</p><p className="mt-0.5 text-sm text-white/50">San José, Costa Rica · Entrega a convenir</p></div></div>
        </div>
      </section>

      <section id="catalogo" className="mx-auto max-w-[1500px] px-4 pb-24 sm:px-7">
        <div className="sticky top-16 z-20 -mx-4 bg-[#0b0e0d]/95 px-4 py-4 backdrop-blur-xl sm:-mx-7 sm:px-7">
          <div className="flex flex-col gap-3 md:flex-row">
            <label className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-white/[.045] pl-11 pr-4 text-base outline-none transition placeholder:text-white/30 focus:border-[#b9f54a]/60" placeholder="Buscar por nombre, set o código…" /></label>
            <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-5 text-sm font-semibold md:hidden"><Filter size={17} /> Filtros <ChevronDown size={15} /></button>
            <div className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-3 md:flex md:flex-row`}>
              <select aria-label="Filtrar por set" value={setFilter} onChange={(e) => setSetFilter(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-[#151917] px-4 text-sm outline-none focus:border-[#b9f54a]/60"><option>Todos los sets</option>{[...new Set(cards.map((c) => c.set))].map((set) => <option key={set}>{set}</option>)}</select>
              <select aria-label="Filtrar por acabado" value={finishFilter} onChange={(e) => setFinishFilter(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-[#151917] px-4 text-sm outline-none focus:border-[#b9f54a]/60"><option>Todos</option><option>Normal</option><option>Foil</option></select>
              <button onClick={() => { setSearch(""); setSetFilter("Todos los sets"); setFinishFilter("Todos"); }} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-white/55 hover:text-white"><SlidersHorizontal size={16} /> Limpiar</button>
            </div>
          </div>
        </div>
        <div className="mb-5 flex items-center justify-between text-sm text-white/45"><p><span className="font-semibold text-white">{visibleCards.length}</span> cartas disponibles</p><p>Precios en colones costarricenses</p></div>

        {visibleCards.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
          {visibleCards.map((card) => { const qty = cart[card.id] || 0; return <article key={card.id} className="group min-w-0">
            <div className="relative overflow-hidden rounded-[4.7%/3.4%] bg-[#202521] shadow-[0_18px_45px_rgba(0,0,0,.28)]"><img src={card.image} alt={`Carta ${card.name}`} className="aspect-[488/680] w-full object-cover transition duration-500 group-hover:scale-[1.025]" /><div className="absolute left-2 top-2 flex gap-1.5">{card.finish === "Foil" && <span className="rounded-full border border-white/20 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur">✦ Foil</span>}<span className="rounded-full border border-white/20 bg-black/70 px-2 py-1 text-[10px] font-bold backdrop-blur">{card.condition}</span></div></div>
            <div className="pt-3"><h2 className="truncate font-semibold tracking-tight">{card.name}</h2><p className="mt-1 truncate text-xs text-white/42">{card.set} #{card.collector} · {card.setName}</p><div className="mt-3 flex items-center justify-between gap-2"><div><p className="text-lg font-bold text-[#b9f54a]">{crc.format(card.price)}</p><p className="text-[11px] text-white/35">{card.stock} disponible{card.stock !== 1 ? "s" : ""}</p></div>{qty === 0 ? <button onClick={() => updateQuantity(card, 1)} aria-label={`Agregar ${card.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-white transition hover:border-[#b9f54a] hover:bg-[#b9f54a] hover:text-black"><Plus size={18} /></button> : <div className="flex items-center rounded-xl bg-[#b9f54a] text-[#11150d]"><button onClick={() => updateQuantity(card, -1)} className="grid h-10 w-9 place-items-center" aria-label="Quitar una"><Minus size={15} /></button><span className="min-w-5 text-center text-sm font-bold">{qty}</span><button onClick={() => updateQuantity(card, 1)} className="grid h-10 w-9 place-items-center disabled:opacity-30" disabled={qty >= card.stock} aria-label="Agregar una"><Plus size={15} /></button></div>}</div></div>
          </article>; })}
        </div> : <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-white/15 text-center"><div><Search className="mx-auto mb-3 text-white/25" /><p className="font-semibold">No encontramos cartas</p><p className="mt-1 text-sm text-white/40">Prueba con otro nombre o limpia los filtros.</p></div></div>}
      </section>

      {itemCount > 0 && <button onClick={() => setCartOpen(true)} className="fixed bottom-4 left-4 right-4 z-30 flex h-14 items-center justify-between rounded-2xl bg-[#b9f54a] px-5 font-bold text-[#11150d] shadow-2xl md:hidden"><span>{itemCount} carta{itemCount !== 1 ? "s" : ""}</span><span>{crc.format(total)} · Ver consulta</span></button>}
      {cartOpen && <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm" onMouseDown={(e) => { if (e.currentTarget === e.target) setCartOpen(false); }}><aside className="flex h-full w-full max-w-md flex-col bg-[#121614] shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 p-5"><div><p className="text-xs uppercase tracking-[.14em] text-[#b9f54a]">Selección</p><h2 className="mt-1 font-serif text-2xl">Mi consulta</h2></div><button onClick={() => setCartOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10" aria-label="Cerrar"><X size={18} /></button></div><div className="flex-1 space-y-4 overflow-y-auto p-5">{selected.length === 0 ? <div className="grid h-full place-items-center text-center text-white/45"><div><ShoppingBag className="mx-auto mb-3" /><p>Aún no seleccionaste cartas.</p></div></div> : selected.map((card) => <div key={card.id} className="flex gap-3"><img src={card.image} alt="" className="h-24 w-[69px] rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{card.name}</p><p className="mt-1 text-xs text-white/40">{card.set} #{card.collector} · {card.condition}</p><p className="mt-2 font-bold text-[#b9f54a]">{crc.format(card.price)}</p></div><div className="flex items-center self-end rounded-lg border border-white/10"><button onClick={() => updateQuantity(card, -1)} className="grid h-8 w-8 place-items-center"><Minus size={13} /></button><span className="w-5 text-center text-sm">{cart[card.id]}</span><button onClick={() => updateQuantity(card, 1)} disabled={cart[card.id] >= card.stock} className="grid h-8 w-8 place-items-center disabled:opacity-30"><Plus size={13} /></button></div></div>)}</div><div className="border-t border-white/10 bg-[#0e120f] p-5"><div className="mb-1 flex justify-between text-sm text-white/50"><span>{itemCount} cartas</span><span>Total estimado</span></div><p className="mb-4 text-right font-serif text-3xl text-[#b9f54a]">{crc.format(total)}</p><button disabled={!itemCount} onClick={openWhatsApp} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] font-bold text-[#07140b] transition hover:bg-[#3ee578] disabled:opacity-40"><MessageCircle size={20} /> Consultar por WhatsApp</button><p className="mt-3 text-center text-xs leading-relaxed text-white/35">El vendedor confirmará disponibilidad, entrega y total final.</p></div></aside></div>}
      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-white/35">MTG Vitrina CR · Magic: The Gathering es propiedad de Wizards of the Coast.</footer>
    </main>
  );
}
