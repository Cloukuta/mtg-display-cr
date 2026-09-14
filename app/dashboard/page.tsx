"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, FileUp, LogIn, LogOut, Save, Store, UploadCloud } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { parseMoxfieldCsv, resolveBatch, type ResolvedCard } from "@/lib/moxfield";

type Profile = { public_name: string; slug: string; whatsapp: string; location: string; delivery_text: string; published: boolean };
type InventoryItem = { id: number; quantity: number; condition: string; language: string; finish: string; price_crc: number; available: boolean; cards: { name: string; set_code: string; collector_number: string; image_uri: string | null } | null };
const blankProfile: Profile = { public_name: "", slug: "", whatsapp: "", location: "", delivery_text: "", published: false };
const crc = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 });

export default function Dashboard() {
  const configured = isSupabaseConfigured();
  const supabase = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [preview, setPreview] = useState<ResolvedCard[]>([]);
  const [progress, setProgress] = useState(0);
  const [strategy, setStrategy] = useState<"sum" | "replace" | "skip">("sum");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    void Promise.all([
      supabase.from("profiles").select("public_name,slug,whatsapp,location,delivery_text,published").eq("id", user.id).single(),
      supabase.from("inventory_items").select("id,quantity,condition,language,finish,price_crc,available,cards(name,set_code,collector_number,image_uri)").eq("seller_id", user.id).order("updated_at", { ascending: false }),
    ]).then(([profileResult, inventoryResult]) => {
      if (profileResult.data) setProfile(profileResult.data as Profile);
      if (inventoryResult.data) setInventory(inventoryResult.data as unknown as InventoryItem[]);
    });
  }, [supabase, user]);

  const resolved = preview.filter((row) => row.status === "resolved");
  const unresolved = preview.filter((row) => row.status === "unresolved");
  const inventoryValue = useMemo(() => inventory.reduce((sum, item) => sum + item.price_crc * item.quantity, 0), [inventory]);

  async function signIn() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dashboard` } });
  }

  async function saveProfile() {
    if (!supabase || !user) return;
    setWorking(true); setNotice("");
    const normalized = { ...profile, slug: profile.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), whatsapp: profile.whatsapp.replace(/\D/g, "") };
    const { error } = await supabase.from("profiles").update({ ...normalized, updated_at: new Date().toISOString() }).eq("id", user.id);
    setWorking(false);
    if (error) setNotice(error.message); else { setProfile(normalized); setNotice("Perfil guardado correctamente."); }
  }

  async function readFile(file: File) {
    setWorking(true); setNotice(""); setPreview([]); setProgress(0);
    try {
      const rows = await parseMoxfieldCsv(file);
      if (rows.length > 1000) throw new Error("El máximo por importación es de 1.000 filas.");
      const result = await resolveBatch(rows, setProgress);
      setPreview(result); setNotice(`${result.filter((row) => row.status === "resolved").length} impresiones validadas.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo leer el archivo."); }
    setWorking(false);
  }

  async function importCards() {
    if (!supabase || !user || !resolved.length) return;
    setWorking(true); setNotice("");
    const { data: job, error: jobError } = await supabase.from("import_jobs").insert({ seller_id: user.id, strategy, total_rows: preview.length, resolved_rows: resolved.length, unresolved_rows: unresolved.length, status: "preview" }).select("id").single();
    if (jobError || !job) { setNotice(jobError?.message || "No se pudo crear la importación."); setWorking(false); return; }
    const cardRows = resolved.map((row) => row.card!);
    const { error: cardError } = await supabase.from("cards").upsert(cardRows, { onConflict: "scryfall_id" });
    if (cardError) { setNotice(cardError.message); setWorking(false); return; }

    for (const row of resolved) {
      const key = { seller_id: user.id, scryfall_id: row.card!.scryfall_id, language: row.language.toLowerCase(), finish: row.finish, condition: row.condition.toUpperCase() };
      const { data: existing } = await supabase.from("inventory_items").select("id,quantity").match(key).maybeSingle();
      if (existing && strategy === "skip") continue;
      const quantity = existing && strategy === "sum" ? existing.quantity + row.quantity : row.quantity;
      await supabase.from("inventory_items").upsert({ ...key, quantity, available: true, updated_at: new Date().toISOString() }, { onConflict: "seller_id,scryfall_id,language,finish,condition" });
    }
    await supabase.from("import_rows").insert(preview.map((row) => ({ job_id: job.id, seller_id: user.id, row_number: row.rowNumber, raw_data: row, result: row.status, error: row.error || null })));
    await supabase.from("import_jobs").update({ status: "completed" }).eq("id", job.id);
    setNotice("Importación completada. Ya puedes asignar precios al inventario."); setPreview([]); setWorking(false);
    const { data } = await supabase.from("inventory_items").select("id,quantity,condition,language,finish,price_crc,available,cards(name,set_code,collector_number,image_uri)").eq("seller_id", user.id).order("updated_at", { ascending: false });
    if (data) setInventory(data as unknown as InventoryItem[]);
  }

  async function updateInventory(item: InventoryItem, changes: Partial<InventoryItem>) {
    if (!supabase) return;
    const next = { ...item, ...changes };
    setInventory((items) => items.map((current) => current.id === item.id ? next : current));
    const { error } = await supabase.from("inventory_items").update({ quantity: next.quantity, price_crc: next.price_crc, available: next.available, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) setNotice(error.message);
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] text-white/60">Cargando…</main>;
  if (!configured) return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] p-5 text-[#f4f3ed]"><section className="max-w-lg rounded-3xl border border-amber-400/25 bg-amber-300/[.06] p-7"><AlertCircle className="mb-4 text-amber-300" /><h1 className="font-serif text-3xl">Falta conectar Supabase</h1><p className="mt-3 leading-relaxed text-white/60">El panel ya está preparado, pero necesita las variables <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. El catálogo público de demostración sigue disponible.</p><a href="/" className="mt-6 inline-flex rounded-xl bg-[#b9f54a] px-5 py-3 font-bold text-[#11150d]">Volver al catálogo</a></section></main>;
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] p-5 text-[#f4f3ed]"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#b9f54a] text-[#11150d]"><Store /></div><h1 className="mt-5 font-serif text-3xl">Panel del vendedor</h1><p className="mt-3 text-white/55">Inicia sesión para importar tu colección y administrar tu catálogo.</p><button onClick={signIn} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-black"><LogIn size={18} /> Continuar con Google</button><a href="/" className="mt-5 inline-block text-sm text-white/45">Volver al catálogo</a></section></main>;

  return <main className="min-h-screen bg-[#0b0e0d] text-[#f4f3ed]">
    <header className="border-b border-white/10"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><a href="/" className="font-semibold">MTG Vitrina CR</a><button onClick={() => supabase?.auth.signOut()} className="flex items-center gap-2 text-sm text-white/55"><LogOut size={16} /> Cerrar sesión</button></div></header>
    <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_1.35fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">Perfil público</p><h1 className="mt-2 font-serif text-3xl">Tu vitrina</h1><div className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm text-white/60">Nombre público<input value={profile.public_name} onChange={(e) => setProfile({ ...profile, public_name: e.target.value })} className="h-11 rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-[#b9f54a]" /></label>
          <label className="grid gap-1.5 text-sm text-white/60">Enlace público<div className="flex h-11 rounded-xl border border-white/10 bg-black/20"><span className="flex items-center border-r border-white/10 px-3 text-white/35">/v/</span><input value={profile.slug} onChange={(e) => setProfile({ ...profile, slug: e.target.value })} className="min-w-0 flex-1 bg-transparent px-3 text-white outline-none" /></div></label>
          <label className="grid gap-1.5 text-sm text-white/60">WhatsApp con código de país<input value={profile.whatsapp} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} placeholder="50688888888" className="h-11 rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-[#b9f54a]" /></label>
          <label className="grid gap-1.5 text-sm text-white/60">Ubicación<input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="San José, Costa Rica" className="h-11 rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-[#b9f54a]" /></label>
          <label className="grid gap-1.5 text-sm text-white/60">Entrega<textarea value={profile.delivery_text} onChange={(e) => setProfile({ ...profile, delivery_text: e.target.value })} className="min-h-20 rounded-xl border border-white/10 bg-black/20 p-4 text-white outline-none focus:border-[#b9f54a]" /></label>
          <label className="flex items-center justify-between rounded-xl border border-white/10 p-3 text-sm"><span>Publicar catálogo</span><input type="checkbox" checked={profile.published} onChange={(e) => setProfile({ ...profile, published: e.target.checked })} className="h-5 w-5 accent-[#b9f54a]" /></label>
          <button disabled={working || !profile.public_name || !profile.slug} onClick={saveProfile} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#b9f54a] font-bold text-[#11150d] disabled:opacity-40"><Save size={17} /> Guardar perfil</button>
        </div></section>

        <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">Importación</p><h2 className="mt-2 font-serif text-3xl">Cargar Moxfield CSV</h2><p className="mt-2 text-sm leading-relaxed text-white/50">Validamos cada impresión por Scryfall ID o set + collector number antes de guardarla.</p>
          <label className="mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/15 p-5 text-center hover:border-[#b9f54a]/60"><UploadCloud className="mb-2 text-[#b9f54a]" /><span className="font-semibold">Seleccionar archivo CSV</span><span className="mt-1 text-xs text-white/40">Máximo 1.000 filas</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} /></label>
          {working && progress > 0 && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#b9f54a]" style={{ width: `${Math.min(100, progress / Math.max(1, progress) * 100)}%` }} /></div><p className="mt-2 text-xs text-white/40">{progress} filas validadas</p></div>}
          {preview.length > 0 && <div className="mt-5"><div className="flex gap-3 text-sm"><span className="text-[#b9f54a]">{resolved.length} resueltas</span><span className="text-amber-300">{unresolved.length} para revisión</span></div><label className="mt-4 grid gap-1.5 text-sm text-white/60">Duplicados<select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)} className="h-11 rounded-xl border border-white/10 bg-[#151917] px-3 text-white"><option value="sum">Sumar cantidades</option><option value="replace">Reemplazar cantidades</option><option value="skip">Omitir duplicados</option></select></label><button onClick={importCards} disabled={working || !resolved.length} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#b9f54a] font-bold text-[#11150d] disabled:opacity-40"><FileUp size={17} /> Importar {resolved.length} cartas</button></div>}
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">Inventario</p><h2 className="mt-2 font-serif text-3xl">{inventory.length} publicaciones</h2></div><p className="text-sm text-white/50">Valor listado: <strong className="text-white">{crc.format(inventoryValue)}</strong></p></div>
        {notice && <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[.04] p-3 text-sm text-white/65">{notice.includes("correct") || notice.includes("complet") ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#b9f54a]" /> : <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-300" />}{notice}</div>}
        <div className="mt-6 space-y-3">{inventory.length === 0 ? <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/15 text-center text-white/40"><div><FileUp className="mx-auto mb-3" /><p>Aún no hay cartas.</p><p className="mt-1 text-sm">Importa tu primer CSV de Moxfield.</p></div></div> : inventory.map((item) => <article key={item.id} className="grid grid-cols-[48px_1fr] gap-3 rounded-2xl border border-white/10 p-3 sm:grid-cols-[48px_1fr_110px_72px]"><div className="overflow-hidden rounded-md bg-white/5">{item.cards?.image_uri && <img src={item.cards.image_uri} alt="" className="h-[67px] w-full object-cover" />}</div><div className="min-w-0"><p className="truncate font-semibold">{item.cards?.name}</p><p className="mt-1 text-xs text-white/40">{item.cards?.set_code?.toUpperCase()} #{item.cards?.collector_number} · {item.condition} · {item.finish}</p><p className="mt-2 text-xs text-white/40">Cantidad: {item.quantity}</p></div><label className="grid gap-1 text-xs text-white/40">Precio ₡<input type="number" min="0" step="100" value={item.price_crc} onChange={(e) => void updateInventory(item, { price_crc: Number(e.target.value) })} className="h-10 rounded-lg border border-white/10 bg-black/20 px-2 text-sm text-white" /></label><label className="flex items-center justify-center gap-2 text-xs text-white/55">Visible<input type="checkbox" checked={item.available} onChange={(e) => void updateInventory(item, { available: e.target.checked })} className="h-5 w-5 accent-[#b9f54a]" /></label></article>)}</div>
      </section>
    </div>
  </main>;
}

