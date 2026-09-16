"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, FileUp, LogIn, Save, Store, UploadCloud } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from "@/lib/i18n";
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
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "es" || stored === "en") setLanguage(stored);

    function handleLanguageChange(event: Event) {
      const customEvent = event as CustomEvent<Language>;
      if (customEvent.detail === "es" || customEvent.detail === "en") {
        setLanguage(customEvent.detail);
      }
    }

    window.addEventListener("mtg-language-change", handleLanguageChange);
    return () =>
      window.removeEventListener("mtg-language-change", handleLanguageChange);
  }, []);

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

  const dashboardText =
    language === "es"
      ? {
          publicProfile: "Perfil público",
          yourDisplay: "Tu vitrina",
          publicName: "Nombre público",
          publicLink: "Enlace público",
          whatsapp: "WhatsApp con código de país",
          location: "Ubicación",
          delivery: "Entrega",
          publishCatalog: "Publicar catálogo",
          saveProfile: "Guardar perfil",
          import: "Importar",
          uploadCsv: "Subir CSV de Moxfield",
          importHelp:
            "Cada impresión se valida mediante Scryfall ID o set + número de coleccionista antes de guardarse.",
          selectCsv: "Seleccionar archivo CSV",
          maxRows: "Máximo 1,000 filas",
          rowsValidated: "filas validadas",
          resolved: "resueltas",
          needReview: "requieren revisión",
          cardsReview: "Cartas que requieren revisión",
          reviewHelp:
            "Estas cartas no fueron importadas porque su impresión exacta no pudo validarse con Scryfall.",
          csvRow: "Fila CSV",
          set: "Set",
          collector: "Coleccionista",
          language: "Idioma",
          finish: "Acabado",
          review: "Revisar",
          reason: "Motivo",
          unknownCard: "Carta desconocida",
          validationFailed: "No se pudo validar la impresión.",
          duplicates: "Duplicados",
          addQuantities: "Sumar cantidades",
          replaceQuantities: "Reemplazar cantidades",
          skipDuplicates: "Omitir duplicados",
          importCards: "Importar",
          cards: "cartas",
          inventory: "Inventario",
          listings: "listados",
          listedValue: "Valor listado",
          noCards: "Aún no hay cartas.",
          importFirst: "Importa tu primer CSV de Moxfield.",
          quantity: "Cantidad",
          price: "Precio ₡",
          visible: "Visible",
          profileSaved: "Perfil guardado correctamente.",
          importComplete:
            "Importación completa. Ahora puedes configurar los precios en tu catálogo.",
        }
      : {
          publicProfile: "Public profile",
          yourDisplay: "Your display",
          publicName: "Public name",
          publicLink: "Public link",
          whatsapp: "WhatsApp with country code",
          location: "Location",
          delivery: "Delivery",
          publishCatalog: "Publish catalog",
          saveProfile: "Save profile",
          import: "Import",
          uploadCsv: "Upload Moxfield CSV",
          importHelp:
            "Each printing is validated by Scryfall ID or set + collector number before it is saved.",
          selectCsv: "Select CSV file",
          maxRows: "Maximum 1,000 rows",
          rowsValidated: "rows validated",
          resolved: "resolved",
          needReview: "need review",
          cardsReview: "Cards needing review",
          reviewHelp:
            "These cards were not imported because their exact printing could not be validated with Scryfall.",
          csvRow: "CSV row",
          set: "Set",
          collector: "Collector",
          language: "Language",
          finish: "Finish",
          review: "Review",
          reason: "Reason",
          unknownCard: "Unknown card",
          validationFailed: "Printing could not be validated.",
          duplicates: "Duplicates",
          addQuantities: "Add quantities",
          replaceQuantities: "Replace quantities",
          skipDuplicates: "Skip duplicates",
          importCards: "Import",
          cards: "cards",
          inventory: "Inventory",
          listings: "listings",
          listedValue: "Listed value",
          noCards: "No cards yet.",
          importFirst: "Import your first Moxfield CSV.",
          quantity: "Quantity",
          price: "Price ₡",
          visible: "Visible",
          profileSaved: "Profile saved successfully.",
          importComplete: "Import complete. You can now set inventory prices.",
        };

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
    if (error) setNotice(error.message); else { setProfile(normalized); setNotice(dashboardText.profileSaved); }
  }

  async function readFile(file: File) {
    setWorking(true); setNotice(""); setPreview([]); setProgress(0);
    try {
      const rows = await parseMoxfieldCsv(file);
      if (rows.length > 1000) throw new Error("Imports are limited to 1,000 rows.");
      const result = await resolveBatch(rows, setProgress);
      setPreview(result); setNotice(`${result.filter((row) => row.status === "resolved").length} printings validated.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The file could not be read."); }
    setWorking(false);
  }

  async function importCards() {
    if (!supabase || !user || !resolved.length) return;
    setWorking(true); setNotice("");
    const { data: job, error: jobError } = await supabase.from("import_jobs").insert({ seller_id: user.id, strategy, total_rows: preview.length, resolved_rows: resolved.length, unresolved_rows: unresolved.length, status: "preview" }).select("id").single();
    if (jobError || !job) { setNotice(jobError?.message || "The import could not be created."); setWorking(false); return; }
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
    setNotice(dashboardText.importComplete); setPreview([]); setWorking(false);
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

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] text-white/60">Loading…</main>;
  if (!configured) return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] p-5 text-[#f4f3ed]"><section className="max-w-lg rounded-3xl border border-amber-400/25 bg-amber-300/[.06] p-7"><AlertCircle className="mb-4 text-amber-300" /><h1 className="font-serif text-3xl">Supabase connection required</h1><p className="mt-3 leading-relaxed text-white/60">The dashboard is ready, but it requires the <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> variables. The public demo catalog remains available.</p><a href="/" className="mt-6 inline-flex rounded-xl bg-[#b9f54a] px-5 py-3 font-bold text-[#11150d]">Back to catalog</a></section></main>;
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#0b0e0d] p-5 text-[#f4f3ed]"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#b9f54a] text-[#11150d]"><Store /></div><h1 className="mt-5 font-serif text-3xl">Seller dashboard</h1><p className="mt-3 text-white/55">Sign in to import your collection and manage your catalog.</p><button onClick={signIn} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-black"><LogIn size={18} /> Continue with Google</button><a href="/" className="mt-5 inline-block text-sm text-white/45">Back to catalog</a></section></main>;

  return <main className="min-h-screen bg-background text-foreground">
    <AppHeader currentPath="/dashboard" />
    <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_1.35fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">{dashboardText.publicProfile}</p><h1 className="mt-2 font-serif text-3xl">{dashboardText.yourDisplay}</h1><div className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm text-white/60">{dashboardText.publicName}<input value={profile.public_name} onChange={(e) => setProfile({ ...profile, public_name: e.target.value })} className="h-11 rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-[#b9f54a]" /></label>
          <label className="grid gap-1.5 text-sm text-white/60">{dashboardText.publicLink}<div className="flex h-11 rounded-xl border border-white/10 bg-black/20"><span className="flex items-center border-r border-white/10 px-3 text-white/35">/v/</span><input value={profile.slug} onChange={(e) => setProfile({ ...profile, slug: e.target.value })} className="min-w-0 flex-1 bg-transparent px-3 text-white outline-none" /></div></label>
          <label className="grid gap-1.5 text-sm text-white/60">{dashboardText.whatsapp}<input value={profile.whatsapp} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} placeholder="50688888888" className="h-11 rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-[#b9f54a]" /></label>
          <label className="grid gap-1.5 text-sm text-white/60">{dashboardText.location}<input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="San José, Costa Rica" className="h-11 rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-[#b9f54a]" /></label>
          <label className="grid gap-1.5 text-sm text-white/60">{dashboardText.delivery}<textarea value={profile.delivery_text} onChange={(e) => setProfile({ ...profile, delivery_text: e.target.value })} className="min-h-20 rounded-xl border border-white/10 bg-black/20 p-4 text-white outline-none focus:border-[#b9f54a]" /></label>
          <label className="flex items-center justify-between rounded-xl border border-white/10 p-3 text-sm"><span>{dashboardText.publishCatalog}</span><input type="checkbox" checked={profile.published} onChange={(e) => setProfile({ ...profile, published: e.target.checked })} className="h-5 w-5 accent-[#b9f54a]" /></label>
          <button disabled={working || !profile.public_name || !profile.slug} onClick={saveProfile} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#b9f54a] font-bold text-[#11150d] disabled:opacity-40"><Save size={17} /> {dashboardText.saveProfile}</button>
        </div></section>

        <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">{dashboardText.import}</p><h2 className="mt-2 font-serif text-3xl">{dashboardText.uploadCsv}</h2><p className="mt-2 text-sm leading-relaxed text-white/50">{dashboardText.importHelp}</p>
          <label className="mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/15 p-5 text-center hover:border-[#b9f54a]/60"><UploadCloud className="mb-2 text-[#b9f54a]" /><span className="font-semibold">{dashboardText.selectCsv}</span><span className="mt-1 text-xs text-white/40">{dashboardText.maxRows}</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} /></label>
          {working && progress > 0 && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#b9f54a]" style={{ width: `${Math.min(100, progress / Math.max(1, progress) * 100)}%` }} /></div><p className="mt-2 text-xs text-white/40">{progress} {dashboardText.rowsValidated}</p></div>}
          {preview.length > 0 && (
  <div className="mt-5">
    <div className="flex flex-wrap gap-3 text-sm">
      <span className="text-[#b9f54a]">
        {resolved.length} {dashboardText.resolved}
      </span>

      <span className="text-amber-300">
        {unresolved.length} {dashboardText.needReview}
      </span>
    </div>

    {unresolved.length > 0 && (
      <div className="mt-5 overflow-hidden rounded-2xl border border-amber-400/20 bg-amber-300/[.04]">
        <div className="border-b border-amber-400/15 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertCircle size={18} />

            <span className="font-semibold">
              Cards needing review
            </span>
          </div>

          <p className="mt-1 text-xs leading-relaxed text-white/45">
            These cards were not imported because their exact printing
            could not be validated with Scryfall.
          </p>
        </div>

        <div className="max-h-96 divide-y divide-white/10 overflow-y-auto">
          {unresolved.map((row) => (
            <div
              key={`${row.rowNumber}-${row.name}-${row.setCode}-${row.collectorNumber}`}
              className="p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-[#f4f3ed]">
                    {row.name || dashboardText.unknownCard}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45">
                    <span>{dashboardText.csvRow} {row.rowNumber}</span>

                    {row.setCode && (
                      <span>
                        {dashboardText.set}: {row.setCode.toUpperCase()}
                      </span>
                    )}

                    {row.collectorNumber && (
                      <span>
                        {dashboardText.collector}: #{row.collectorNumber}
                      </span>
                    )}

                    {row.language && (
                      <span>
                        {dashboardText.language}: {row.language}
                      </span>
                    )}

                    {row.finish && (
                      <span>
                        {dashboardText.finish}: {row.finish}
                      </span>
                    )}
                  </div>
                </div>

                <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                  Review
                </span>
              </div>

              <div className="mt-3 rounded-xl bg-black/20 px-3 py-2">
                <p className="text-xs text-white/35">
                  Reason
                </p>

                <p className="mt-0.5 text-sm text-amber-200">
                  {row.error || dashboardText.validationFailed}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    <label className="mt-4 grid gap-1.5 text-sm text-white/60">
      Duplicates

      <select
        value={strategy}
        onChange={(e) =>
          setStrategy(e.target.value as typeof strategy)
        }
        className="h-11 rounded-xl border border-white/10 bg-[#151917] px-3 text-white"
      >
        <option value="sum">{dashboardText.addQuantities}</option>
        <option value="replace">{dashboardText.replaceQuantities}</option>
        <option value="skip">{dashboardText.skipDuplicates}</option>
      </select>
    </label>

    <button
      onClick={importCards}
      disabled={working || !resolved.length}
      className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#b9f54a] font-bold text-[#11150d] disabled:opacity-40"
    >
      <FileUp size={17} />
      {dashboardText.importCards} {resolved.length} {dashboardText.cards}
    </button>
  </div>
)}
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">{dashboardText.inventory}</p><h2 className="mt-2 font-serif text-3xl">{inventory.length} {dashboardText.listings}</h2></div><p className="text-sm text-white/50">{dashboardText.listedValue}: <strong className="text-white">{crc.format(inventoryValue)}</strong></p></div>
        {notice && <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[.04] p-3 text-sm text-white/65">{notice.includes("correct") || notice.includes("complet") ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#b9f54a]" /> : <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-300" />}{notice}</div>}
        <div className="mt-6 space-y-3">{inventory.length === 0 ? <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/15 text-center text-white/40"><div><FileUp className="mx-auto mb-3" /><p>{dashboardText.noCards}</p><p className="mt-1 text-sm">{dashboardText.importFirst}</p></div></div> : inventory.map((item) => <article key={item.id} className="grid grid-cols-[48px_1fr] gap-3 rounded-2xl border border-white/10 p-3 sm:grid-cols-[48px_1fr_110px_72px]"><div className="overflow-hidden rounded-md bg-white/5">{item.cards?.image_uri && <img src={item.cards.image_uri} alt="" className="h-[67px] w-full object-cover" />}</div><div className="min-w-0"><p className="truncate font-semibold">{item.cards?.name}</p><p className="mt-1 text-xs text-white/40">{item.cards?.set_code?.toUpperCase()} #{item.cards?.collector_number} · {item.condition} · {item.finish}</p><p className="mt-2 text-xs text-white/40">{dashboardText.quantity}: {item.quantity}</p></div><label className="grid gap-1 text-xs text-white/40">{dashboardText.price}<input type="number" min="0" step="100" value={item.price_crc} onChange={(e) => void updateInventory(item, { price_crc: Number(e.target.value) })} className="h-10 rounded-lg border border-white/10 bg-black/20 px-2 text-sm text-white" /></label><label className="flex items-center justify-center gap-2 text-xs text-white/55">{dashboardText.visible}<input type="checkbox" checked={item.available} onChange={(e) => void updateInventory(item, { available: e.target.checked })} className="h-5 w-5 accent-[#b9f54a]" /></label></article>)}</div>
      </section>
    </div>
  </main>;
}
