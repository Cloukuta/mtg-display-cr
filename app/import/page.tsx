"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, FileUp, FolderOpen, LogIn, Store, UploadCloud, X } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";
import { parseMoxfieldCsv, resolveBatch, type ResolvedCard } from "@/lib/moxfield";

type ImportPricingMode = "default" | "discount";
type Binder = { id: number; name: string; is_default: boolean; is_public: boolean };
type ImportSuccess = { quantity: number; binderId: number; binderName: string };
const PREVIEW_LIMIT = 8;

export default function ImportPage() {
  const configured = isSupabaseConfigured();
  const supabase = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ResolvedCard[]>([]);
  const [showAllPreview, setShowAllPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pricingMode, setPricingMode] = useState<ImportPricingMode>("default");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [binders, setBinders] = useState<Binder[]>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<number | null>(null);
  const [success, setSuccess] = useState<ImportSuccess | null>(null);

  const text = language === "es" ? {
    eyebrow: "Importar", title: "Importar colección",
    description: "Sube tu CSV de Moxfield. Validamos cada impresión antes de guardarla.",
    selectCsv: "Seleccionar archivo CSV", maxRows: "Máximo 1,000 filas", rowsValidated: "filas validadas",
    resolved: "resueltas", needReview: "requieren revisión", previewTitle: "Vista previa del CSV",
    previewHelp: "Revisa las cartas validadas y elige dónde quieres guardarlas.", totalQty: "cantidad total", quantity: "Cant.",
    showAll: "Mostrar todas", showLess: "Mostrar menos", cardsReview: "Cartas que requieren revisión",
    reviewHelp: "Estas cartas no serán importadas porque su impresión exacta no pudo validarse con Scryfall.",
    csvRow: "Fila CSV", set: "Set", collector: "Coleccionista", cardLanguage: "Idioma", finish: "Acabado", review: "Revisar",
    reason: "Motivo", unknownCard: "Carta desconocida", validationFailed: "No se pudo validar la impresión.",
    destinationTitle: "Destino de la importación", destinationHelp: "Elige el Binder donde quieres guardar estas cartas.",
    tradeHint: "Trade Binder: las cartas quedan disponibles para venta.", personalHint: "Binder personal: las cartas se guardan fuera de la vitrina hasta que decidas venderlas.",
    noBinders: "No encontramos Binders para esta cuenta.", pricingTitle: "Precio inicial", pricingHelp: "Elige cómo se calculará el precio de este lote.",
    defaultPricing: "Predeterminado", defaultPricingHelp: "Usa el precio de Card Kingdom correspondiente al acabado y condición.",
    discountPricing: "Descuento", discountPricingHelp: "Aplica el descuento configurado por el vendedor sobre Card Kingdom.",
    customLater: "Los precios personalizados se pueden asignar después desde Mi catálogo.",
    duplicateInfo: "Si una carta ya existe en este Binder con la misma impresión, idioma, acabado y condición, su cantidad se sumará automáticamente.",
    importCards: "Importar", cards: "cartas", loading: "Cargando importador…", supabaseRequired: "Se requiere conexión con Supabase",
    supabaseDescription: "El importador requiere la configuración pública de Supabase.", back: "Volver al panel", sellerImport: "Importación del vendedor",
    signInDescription: "Inicia sesión para importar cartas a tu inventario.", continueGoogle: "Continuar con Google", limited: "Las importaciones están limitadas a 1,000 filas.",
    fileError: "No se pudo leer el archivo.", importCreateError: "No se pudo crear la importación.", validated: "impresiones validadas.",
    successTitle: "Importación completada", successBody: "cartas fueron agregadas correctamente a", viewBinder: "Ver Binder", importAnother: "Importar otro",
  } : {
    eyebrow: "Import", title: "Import Collection", description: "Upload your Moxfield CSV. We validate every printing before saving it.",
    selectCsv: "Select CSV file", maxRows: "Maximum 1,000 rows", rowsValidated: "rows validated", resolved: "resolved", needReview: "need review",
    previewTitle: "CSV Preview", previewHelp: "Review the validated cards and choose where you want to store them.", totalQty: "total quantity", quantity: "Qty",
    showAll: "Show all", showLess: "Show less", cardsReview: "Cards needing review",
    reviewHelp: "These cards will not be imported because their exact printing could not be validated with Scryfall.", csvRow: "CSV row", set: "Set", collector: "Collector",
    cardLanguage: "Language", finish: "Finish", review: "Review", reason: "Reason", unknownCard: "Unknown card", validationFailed: "Printing could not be validated.",
    destinationTitle: "Import destination", destinationHelp: "Choose the Binder where these cards should be stored.",
    tradeHint: "Trade Binder: cards are available for sale.", personalHint: "Personal Binder: cards stay out of your storefront until you decide to sell them.",
    noBinders: "No Binders were found for this account.", pricingTitle: "Initial pricing", pricingHelp: "Choose how this batch will be priced.",
    defaultPricing: "Default", defaultPricingHelp: "Uses the Card Kingdom price matching finish and condition.", discountPricing: "Discount",
    discountPricingHelp: "Applies your configured seller discount to the Card Kingdom price.", customLater: "Custom pricing can be assigned later from My Catalog.",
    duplicateInfo: "If the same printing, language, finish, and condition already exists in this Binder, its quantity is added automatically.",
    importCards: "Import", cards: "cards", loading: "Loading importer…", supabaseRequired: "Supabase connection required",
    supabaseDescription: "The importer requires the public Supabase configuration.", back: "Back to Dashboard", sellerImport: "Seller import",
    signInDescription: "Sign in to import cards into your inventory.", continueGoogle: "Continue with Google", limited: "Imports are limited to 1,000 rows.",
    fileError: "The file could not be read.", importCreateError: "The import could not be created.", validated: "printings validated.",
    successTitle: "Import complete", successBody: "cards were successfully added to", viewBinder: "View Binder", importAnother: "Import another",
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "es" || stored === "en") setLanguage(stored);
    const handle = (event: Event) => {
      const value = (event as CustomEvent<Language>).detail;
      if (value === "es" || value === "en") setLanguage(value);
    };
    window.addEventListener("mtg-language-change", handle);
    return () => window.removeEventListener("mtg-language-change", handle);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) { setBinders([]); setSelectedBinderId(null); return; }
    void (async () => {
      const { data, error } = await supabase.from("binders").select("id,name,is_default,is_public").eq("seller_id", user.id).order("is_default", { ascending: false }).order("name");
      if (error) { setNotice(error.message); return; }
      const rows = (data || []) as Binder[];
      setBinders(rows);
      setSelectedBinderId((current) => current && rows.some((b) => b.id === current) ? current : rows.find((b) => b.is_default)?.id ?? rows[0]?.id ?? null);
    })();
  }, [supabase, user]);

  const resolved = useMemo(() => preview.filter((row) => row.status === "resolved"), [preview]);
  const unresolved = useMemo(() => preview.filter((row) => row.status === "unresolved"), [preview]);
  const visibleResolved = showAllPreview ? resolved : resolved.slice(0, PREVIEW_LIMIT);
  const totalQuantity = resolved.reduce((sum, row) => sum + row.quantity, 0);
  const selectedBinder = binders.find((binder) => binder.id === selectedBinderId) || null;

  async function signIn() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/import` } });
  }

  async function readFile(file: File) {
    setWorking(true); setNotice(""); setPreview([]); setShowAllPreview(false); setProgress(0); setSuccess(null);
    try {
      const rows = await parseMoxfieldCsv(file);
      if (rows.length > 1000) throw new Error(text.limited);
      const result = await resolveBatch(rows, setProgress);
      setPreview(result);
      setNotice(`${result.filter((row) => row.status === "resolved").length} ${text.validated}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : text.fileError); }
    setWorking(false);
  }

  async function importCards() {
    if (!supabase || !user || !resolved.length || !selectedBinder) return;
    setWorking(true); setNotice("");

    const { data: job, error: jobError } = await supabase.from("import_jobs")
      .insert({ seller_id: user.id, strategy: "sum", total_rows: preview.length, resolved_rows: resolved.length, unresolved_rows: unresolved.length, status: "preview" })
      .select("id").single();
    if (jobError || !job) { setNotice(jobError?.message || text.importCreateError); setWorking(false); return; }

    const uniqueCards = Array.from(new Map(resolved.map((row) => [row.card!.scryfall_id, row.card!])).values());
    const { error: cardError } = await supabase.from("cards").upsert(uniqueCards, { onConflict: "scryfall_id" });
    if (cardError) { setNotice(cardError.message); setWorking(false); return; }

    for (const row of resolved) {
      const key = { seller_id: user.id, binder_id: selectedBinder.id, scryfall_id: row.card!.scryfall_id, language: row.language.toLowerCase(), finish: row.finish, condition: row.condition.toUpperCase() };
      const { data: existing, error: existingError } = await supabase.from("inventory_items").select("id,quantity").match(key).maybeSingle();
      if (existingError) { setNotice(existingError.message); setWorking(false); return; }
      const quantity = (existing?.quantity || 0) + row.quantity;
      const payload = { ...key, quantity, available: selectedBinder.is_default, pricing_mode: pricingMode, custom_price_crc: null, updated_at: new Date().toISOString() };
      const { error: inventoryError } = existing
        ? await supabase.from("inventory_items").update(payload).eq("id", existing.id)
        : await supabase.from("inventory_items").insert(payload);
      if (inventoryError) { setNotice(inventoryError.message); setWorking(false); return; }
    }

    const { error: rowsError } = await supabase.from("import_rows").insert(preview.map((row) => ({ job_id: job.id, seller_id: user.id, row_number: row.rowNumber, raw_data: row, result: row.status, error: row.error || null })));
    if (rowsError) { setNotice(rowsError.message); setWorking(false); return; }
    const { error: completeError } = await supabase.from("import_jobs").update({ status: "completed" }).eq("id", job.id);
    if (completeError) { setNotice(completeError.message); setWorking(false); return; }

    setSuccess({ quantity: totalQuantity, binderId: selectedBinder.id, binderName: selectedBinder.name });
    setPreview([]); setShowAllPreview(false); setProgress(0); setNotice(""); setWorking(false);
  }

  function resetImporter() { setSuccess(null); setPreview([]); setProgress(0); setNotice(""); setShowAllPreview(false); }

  if (loading) return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">{text.loading}</main>;
  if (!configured) return <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground"><section className="max-w-lg rounded-3xl border border-amber-400/25 bg-amber-300/[.06] p-7"><AlertCircle className="mb-4 text-amber-300" /><h1 className="font-serif text-3xl">{text.supabaseRequired}</h1><p className="mt-3 text-muted-foreground">{text.supabaseDescription}</p><a href="/dashboard" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">{text.back}</a></section></main>;
  if (!user) return <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground"><section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Store /></div><h1 className="mt-5 font-serif text-3xl">{text.sellerImport}</h1><p className="mt-3 text-muted-foreground">{text.signInDescription}</p><button type="button" onClick={signIn} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground"><LogIn size={18} />{text.continueGoogle}</button></section></main>;

  return <main className="min-h-screen bg-background text-foreground">
    <AppHeader currentPath="/import" />
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6"><p className="text-xs font-black uppercase tracking-[.16em] text-primary">{text.eyebrow}</p><h1 className="mt-2 font-serif text-4xl font-bold">{text.title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{text.description}</p></div>
      <section className="rounded-3xl border border-border bg-card p-6">
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 p-5 text-center transition hover:border-primary/60"><UploadCloud className="mb-3 text-primary" size={30} /><span className="font-semibold">{text.selectCsv}</span><span className="mt-1 text-xs text-muted-foreground">{text.maxRows}</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} /></label>
        {working && progress > 0 && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: "100%" }} /></div><p className="mt-2 text-xs text-muted-foreground">{progress} {text.rowsValidated}</p></div>}
        {notice && <div className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground"><AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-500" /><p>{notice}</p></div>}

        {preview.length > 0 && <div className="mt-6">
          <div className="flex flex-wrap gap-3 text-sm"><span className="font-semibold text-primary">{resolved.length} {text.resolved}</span><span className="font-semibold text-amber-500">{unresolved.length} {text.needReview}</span></div>
          {resolved.length > 0 && <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-secondary/20">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{text.previewTitle}</p><p className="mt-1 text-xs text-muted-foreground">{text.previewHelp}</p></div><div className="flex gap-2 text-xs"><span className="rounded-full border border-border bg-card px-3 py-1.5 font-semibold">{resolved.length} {text.cards}</span><span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 font-semibold text-primary">{totalQuantity} {text.totalQty}</span></div></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">{visibleResolved.map((row) => <article key={`${row.rowNumber}-${row.card!.scryfall_id}-${row.finish}-${row.condition}`} className="flex min-w-0 gap-3 rounded-2xl border border-border bg-card p-3"><div className="h-[104px] w-[74px] shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">{row.card?.image_uri ? <img src={row.card.image_uri} alt={row.card.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-[10px] text-muted-foreground">{text.unknownCard}</div>}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{row.card?.name || row.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.card?.set_name || row.setCode?.toUpperCase()} · #{row.card?.collector_number || row.collectorNumber}</p><div className="mt-3 flex flex-wrap gap-1.5">{[row.finish,row.condition,row.language].map((value) => <span key={value} className="rounded-md border border-border bg-secondary px-2 py-1 text-[10px] font-semibold uppercase">{value}</span>)}</div><p className="mt-2 text-xs text-muted-foreground">{text.quantity}: <b className="text-foreground">{row.quantity}</b></p></div></article>)}</div>
            {resolved.length > PREVIEW_LIMIT && <div className="border-t border-border p-3 text-center"><button type="button" onClick={() => setShowAllPreview((v) => !v)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10">{showAllPreview ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} {showAllPreview ? text.showLess : `${text.showAll} (${resolved.length})`}</button></div>}
          </div>}

          {unresolved.length > 0 && <div className="mt-5 overflow-hidden rounded-2xl border border-amber-400/25 bg-amber-300/[.05]"><div className="border-b border-amber-400/20 px-4 py-3"><div className="flex items-center gap-2 text-amber-500"><AlertCircle size={18}/><b>{text.cardsReview}</b></div><p className="mt-1 text-xs text-muted-foreground">{text.reviewHelp}</p></div><div className="max-h-96 divide-y divide-border overflow-y-auto">{unresolved.map((row) => <div key={`${row.rowNumber}-${row.name}`} className="p-4"><div className="flex justify-between gap-4"><div><p className="font-semibold">{row.name || text.unknownCard}</p><p className="mt-1 text-xs text-muted-foreground">{text.csvRow} {row.rowNumber} · {text.set}: {row.setCode?.toUpperCase()} · {text.collector}: #{row.collectorNumber} · {text.cardLanguage}: {row.language} · {text.finish}: {row.finish}</p></div><span className="h-fit rounded-full border border-amber-400/25 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-500">{text.review}</span></div><div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2"><p className="text-xs text-muted-foreground">{text.reason}</p><p className="mt-0.5 text-sm text-amber-600">{row.error || text.validationFailed}</p></div></div>)}</div></div>}

          <div className="mt-5 rounded-2xl border border-border bg-secondary/20 p-4"><div className="flex items-center gap-2"><FolderOpen size={18} className="text-primary"/><p className="font-semibold">{text.destinationTitle}</p></div><p className="mt-1 text-xs text-muted-foreground">{text.destinationHelp}</p>{binders.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{binders.map((binder) => <button key={binder.id} type="button" onClick={() => setSelectedBinderId(binder.id)} className={`rounded-2xl border p-4 text-left transition ${selectedBinderId === binder.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{binder.name}</span>{binder.is_default && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">Trade</span>}</div><p className="mt-2 text-xs text-muted-foreground">{binder.is_default ? text.tradeHint : text.personalHint}</p></button>)}</div> : <p className="mt-3 text-sm text-amber-500">{text.noBinders}</p>}</div>

          <div className="mt-5"><p className="text-sm font-semibold">{text.pricingTitle}</p><p className="mt-1 text-xs text-muted-foreground">{text.pricingHelp}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["default","discount"] as ImportPricingMode[]).map((mode) => <button key={mode} type="button" onClick={() => setPricingMode(mode)} className={`rounded-2xl border p-4 text-left transition ${pricingMode === mode ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:border-primary/40"}`}><div className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full border ${pricingMode === mode ? "border-primary bg-primary" : "border-muted-foreground"}`}/><span className="font-semibold">{mode === "default" ? text.defaultPricing : text.discountPricing}</span></div><p className="mt-2 text-xs text-muted-foreground">{mode === "default" ? text.defaultPricingHelp : text.discountPricingHelp}</p></button>)}</div><p className="mt-3 text-xs text-muted-foreground">{text.customLater}</p></div>
          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[.06] px-4 py-3 text-xs leading-relaxed text-muted-foreground"><b className="text-foreground">{language === "es" ? "Duplicados: " : "Duplicates: "}</b>{text.duplicateInfo}</div>
          <button type="button" onClick={importCards} disabled={working || !resolved.length || !selectedBinder} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-40"><FileUp size={17}/>{working ? "…" : `${text.importCards} ${resolved.length} ${text.cards}`}</button>
        </div>}
      </section>
    </div>

    {success && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-2xl"><button type="button" onClick={() => setSuccess(null)} className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Close"><X size={18}/></button><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><CheckCircle2 size={30}/></div><h2 className="mt-4 font-serif text-3xl font-bold">{text.successTitle}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground"><b className="text-foreground">{success.quantity}</b> {text.successBody} <b className="text-foreground">{success.binderName}</b>.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><a href={`/catalog/binders?binder=${success.binderId}`} className="flex h-11 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground">{text.viewBinder}</a><button type="button" onClick={resetImporter} className="h-11 rounded-xl border border-border bg-secondary px-4 font-semibold">{text.importAnother}</button></div></div></div>}
  </main>;
}
