"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileUp,
  LogIn,
  Store,
  UploadCloud,
} from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from "@/lib/i18n";
import {
  parseMoxfieldCsv,
  resolveBatch,
  type ResolvedCard,
} from "@/lib/moxfield";

type ImportPricingMode = "default" | "discount";
const PREVIEW_LIMIT = 8;

export default function ImportPage() {
  const configured = isSupabaseConfigured();
  const supabase = getSupabase();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ResolvedCard[]>([]);
  const [showAllPreview, setShowAllPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [strategy, setStrategy] = useState<"sum" | "replace" | "skip">("sum");
  const [pricingMode, setPricingMode] = useState<ImportPricingMode>("default");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  const text = language === "es"
    ? {
        eyebrow: "Importar",
        title: "Importar colección",
        description: "Sube tu CSV de Moxfield. Cada impresión se valida mediante Scryfall ID o set + número de coleccionista antes de guardarse.",
        selectCsv: "Seleccionar archivo CSV",
        maxRows: "Máximo 1,000 filas",
        rowsValidated: "filas validadas",
        resolved: "resueltas",
        needReview: "requieren revisión",
        previewTitle: "Vista previa del CSV",
        previewHelp: "Revisa las cartas validadas antes de elegir cómo se importarán.",
        totalQty: "cantidad total",
        quantity: "Cant.",
        condition: "Condición",
        showAll: "Mostrar todas",
        showLess: "Mostrar menos",
        cardsReview: "Cartas que requieren revisión",
        reviewHelp: "Estas cartas no serán importadas porque su impresión exacta no pudo validarse con Scryfall.",
        csvRow: "Fila CSV",
        set: "Set",
        collector: "Coleccionista",
        cardLanguage: "Idioma",
        finish: "Acabado",
        review: "Revisar",
        reason: "Motivo",
        unknownCard: "Carta desconocida",
        validationFailed: "No se pudo validar la impresión.",
        duplicates: "Duplicados",
        addQuantities: "Sumar cantidades",
        replaceQuantities: "Reemplazar cantidades",
        skipDuplicates: "Omitir duplicados",
        pricingTitle: "Precio inicial de las cartas importadas",
        pricingHelp: "Elige cómo se venderá este lote. Los precios personalizados se administran después desde Mi catálogo.",
        defaultPricing: "Predeterminado",
        defaultPricingHelp: "Usa el precio de Card Kingdom correspondiente al acabado y condición de cada carta.",
        discountPricing: "Descuento",
        discountPricingHelp: "Usa el precio de Card Kingdom y aplica el porcentaje de descuento configurado por el vendedor.",
        customLater: "El precio Personalizado se puede asignar individualmente o en lote desde Mi catálogo.",
        importCards: "Importar",
        cards: "cartas",
        loading: "Cargando importador…",
        supabaseRequired: "Se requiere conexión con Supabase",
        supabaseDescription: "El importador requiere la configuración pública de Supabase.",
        back: "Volver al panel",
        sellerImport: "Importación del vendedor",
        signInDescription: "Inicia sesión para importar cartas a tu inventario.",
        continueGoogle: "Continuar con Google",
        limited: "Las importaciones están limitadas a 1,000 filas.",
        fileError: "No se pudo leer el archivo.",
        importCreateError: "No se pudo crear la importación.",
        complete: "Importación completa. Ya puedes administrar precios y disponibilidad desde Mi catálogo.",
        validated: "impresiones validadas.",
        openCatalog: "Abrir Mi catálogo",
      }
    : {
        eyebrow: "Import",
        title: "Import Collection",
        description: "Upload your Moxfield CSV. Each printing is validated by Scryfall ID or set + collector number before it is saved.",
        selectCsv: "Select CSV file",
        maxRows: "Maximum 1,000 rows",
        rowsValidated: "rows validated",
        resolved: "resolved",
        needReview: "need review",
        previewTitle: "CSV Preview",
        previewHelp: "Review the validated cards before choosing how they will be imported.",
        totalQty: "total quantity",
        quantity: "Qty",
        condition: "Condition",
        showAll: "Show all",
        showLess: "Show less",
        cardsReview: "Cards needing review",
        reviewHelp: "These cards will not be imported because their exact printing could not be validated with Scryfall.",
        csvRow: "CSV row",
        set: "Set",
        collector: "Collector",
        cardLanguage: "Language",
        finish: "Finish",
        review: "Review",
        reason: "Reason",
        unknownCard: "Unknown card",
        validationFailed: "Printing could not be validated.",
        duplicates: "Duplicates",
        addQuantities: "Add quantities",
        replaceQuantities: "Replace quantities",
        skipDuplicates: "Skip duplicates",
        pricingTitle: "Initial pricing for imported cards",
        pricingHelp: "Choose how this batch will be sold. Custom prices are managed later from My Catalog.",
        defaultPricing: "Default",
        defaultPricingHelp: "Uses the Card Kingdom price matching each card's finish and condition.",
        discountPricing: "Discount",
        discountPricingHelp: "Uses the Card Kingdom price and applies the seller's configured discount percentage.",
        customLater: "Custom pricing can be assigned individually or in bulk from My Catalog.",
        importCards: "Import",
        cards: "cards",
        loading: "Loading importer…",
        supabaseRequired: "Supabase connection required",
        supabaseDescription: "The importer requires the public Supabase configuration.",
        back: "Back to Dashboard",
        sellerImport: "Seller import",
        signInDescription: "Sign in to import cards into your inventory.",
        continueGoogle: "Continue with Google",
        limited: "Imports are limited to 1,000 rows.",
        fileError: "The file could not be read.",
        importCreateError: "The import could not be created.",
        complete: "Import complete. You can now manage pricing and availability from My Catalog.",
        validated: "printings validated.",
        openCatalog: "Open My Catalog",
      };

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "es" || stored === "en") setLanguage(stored);

    function handleLanguageChange(event: Event) {
      const customEvent = event as CustomEvent<Language>;
      if (customEvent.detail === "es" || customEvent.detail === "en") setLanguage(customEvent.detail);
    }

    window.addEventListener("mtg-language-change", handleLanguageChange);
    return () => window.removeEventListener("mtg-language-change", handleLanguageChange);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const resolved = preview.filter((row) => row.status === "resolved");
  const unresolved = preview.filter((row) => row.status === "unresolved");
  const visibleResolved = showAllPreview ? resolved : resolved.slice(0, PREVIEW_LIMIT);
  const totalQuantity = resolved.reduce((sum, row) => sum + row.quantity, 0);

  async function signIn() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/import` },
    });
  }

  async function readFile(file: File) {
    setWorking(true);
    setNotice("");
    setPreview([]);
    setShowAllPreview(false);
    setProgress(0);

    try {
      const rows = await parseMoxfieldCsv(file);
      if (rows.length > 1000) throw new Error(text.limited);
      const result = await resolveBatch(rows, setProgress);
      setPreview(result);
      setNotice(`${result.filter((row) => row.status === "resolved").length} ${text.validated}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text.fileError);
    }

    setWorking(false);
  }

  async function importCards() {
    if (!supabase || !user || !resolved.length) return;

    setWorking(true);
    setNotice("");

    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .insert({ seller_id: user.id, strategy, total_rows: preview.length, resolved_rows: resolved.length, unresolved_rows: unresolved.length, status: "preview" })
      .select("id")
      .single();

    if (jobError || !job) {
      setNotice(jobError?.message || text.importCreateError);
      setWorking(false);
      return;
    }

    const uniqueCards = Array.from(
      new Map(resolved.map((row) => [row.card!.scryfall_id, row.card!])).values()
    );

    const { error: cardError } = await supabase
      .from("cards")
      .upsert(uniqueCards, { onConflict: "scryfall_id" });

    if (cardError) {
      setNotice(cardError.message);
      setWorking(false);
      return;
    }

    for (const row of resolved) {
      const key = {
        seller_id: user.id,
        scryfall_id: row.card!.scryfall_id,
        language: row.language.toLowerCase(),
        finish: row.finish,
        condition: row.condition.toUpperCase(),
      };

      const { data: existing } = await supabase.from("inventory_items").select("id,quantity").match(key).maybeSingle();
      if (existing && strategy === "skip") continue;

      const quantity = existing && strategy === "sum" ? existing.quantity + row.quantity : row.quantity;
      const { error: inventoryError } = await supabase
        .from("inventory_items")
        .upsert(
          { ...key, quantity, available: true, pricing_mode: pricingMode, custom_price_crc: null, updated_at: new Date().toISOString() },
          { onConflict: "seller_id,scryfall_id,language,finish,condition" }
        );

      if (inventoryError) {
        setNotice(inventoryError.message);
        setWorking(false);
        return;
      }
    }

    const { error: rowsError } = await supabase.from("import_rows").insert(
      preview.map((row) => ({ job_id: job.id, seller_id: user.id, row_number: row.rowNumber, raw_data: row, result: row.status, error: row.error || null }))
    );

    if (rowsError) {
      setNotice(rowsError.message);
      setWorking(false);
      return;
    }

    const { error: completeError } = await supabase.from("import_jobs").update({ status: "completed" }).eq("id", job.id);
    if (completeError) {
      setNotice(completeError.message);
      setWorking(false);
      return;
    }

    setNotice(text.complete);
    setPreview([]);
    setShowAllPreview(false);
    setProgress(0);
    setWorking(false);
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">{text.loading}</main>;

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground">
        <section className="max-w-lg rounded-3xl border border-amber-400/25 bg-amber-300/[.06] p-7">
          <AlertCircle className="mb-4 text-amber-300" />
          <h1 className="font-serif text-3xl">{text.supabaseRequired}</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">{text.supabaseDescription}</p>
          <a href="/dashboard" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">{text.back}</a>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground">
        <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Store /></div>
          <h1 className="mt-5 font-serif text-3xl">{text.sellerImport}</h1>
          <p className="mt-3 text-muted-foreground">{text.signInDescription}</p>
          <button type="button" onClick={signIn} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground"><LogIn size={18} />{text.continueGoogle}</button>
          <a href="/dashboard" className="mt-5 inline-block text-sm text-muted-foreground">{text.back}</a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader currentPath="/import" />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">{text.eyebrow}</p>
          <h1 className="mt-2 font-serif text-4xl font-bold">{text.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{text.description}</p>
        </div>

        <section className="rounded-3xl border border-border bg-card p-6">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 p-5 text-center transition hover:border-primary/60">
            <UploadCloud className="mb-3 text-primary" size={30} />
            <span className="font-semibold">{text.selectCsv}</span>
            <span className="mt-1 text-xs text-muted-foreground">{text.maxRows}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
          </label>

          {working && progress > 0 && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: "100%" }} /></div>
              <p className="mt-2 text-xs text-muted-foreground">{progress} {text.rowsValidated}</p>
            </div>
          )}

          {notice && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              {notice === text.complete ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" /> : <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-500" />}
              <div className="flex-1"><p>{notice}</p>{notice === text.complete && <a href="/catalog" className="mt-2 inline-flex font-semibold text-primary">{text.openCatalog} →</a>}</div>
            </div>
          )}

          {preview.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="font-semibold text-primary">{resolved.length} {text.resolved}</span>
                <span className="font-semibold text-amber-500">{unresolved.length} {text.needReview}</span>
              </div>

              {resolved.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-secondary/20">
                  <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{text.previewTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{text.previewHelp}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 text-xs">
                      <span className="rounded-full border border-border bg-card px-3 py-1.5 font-semibold text-foreground">{resolved.length} {text.cards}</span>
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 font-semibold text-primary">{totalQuantity} {text.totalQty}</span>
                    </div>
                  </div>

                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {visibleResolved.map((row) => (
                      <article key={`${row.rowNumber}-${row.card!.scryfall_id}-${row.finish}-${row.condition}`} className="flex min-w-0 gap-3 rounded-2xl border border-border bg-card p-3">
                        <div className="h-[104px] w-[74px] shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                          {row.card?.image_uri ? (
                            <img src={row.card.image_uri} alt={row.card.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full place-items-center px-2 text-center text-[10px] text-muted-foreground">{text.unknownCard}</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          <p className="truncate font-semibold text-foreground" title={row.card?.name}>{row.card?.name || row.name}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{row.card?.set_name || row.setCode?.toUpperCase()} · #{row.card?.collector_number || row.collectorNumber}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="rounded-md border border-border bg-secondary px-2 py-1 text-[10px] font-semibold uppercase text-foreground">{row.finish}</span>
                            <span className="rounded-md border border-border bg-secondary px-2 py-1 text-[10px] font-semibold uppercase text-foreground">{row.condition}</span>
                            <span className="rounded-md border border-border bg-secondary px-2 py-1 text-[10px] font-semibold uppercase text-foreground">{row.language}</span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{text.quantity}: <span className="font-bold text-foreground">{row.quantity}</span></p>
                        </div>
                      </article>
                    ))}
                  </div>

                  {resolved.length > PREVIEW_LIMIT && (
                    <div className="border-t border-border p-3 text-center">
                      <button type="button" onClick={() => setShowAllPreview((value) => !value)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10">
                        {showAllPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {showAllPreview ? text.showLess : `${text.showAll} (${resolved.length})`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {unresolved.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-amber-400/25 bg-amber-300/[.05]">
                  <div className="border-b border-amber-400/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-amber-500"><AlertCircle size={18} /><span className="font-semibold">{text.cardsReview}</span></div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text.reviewHelp}</p>
                  </div>
                  <div className="max-h-96 divide-y divide-border overflow-y-auto">
                    {unresolved.map((row) => (
                      <div key={`${row.rowNumber}-${row.name}-${row.setCode}-${row.collectorNumber}`} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{row.name || text.unknownCard}</p>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{text.csvRow} {row.rowNumber}</span>
                              {row.setCode && <span>{text.set}: {row.setCode.toUpperCase()}</span>}
                              {row.collectorNumber && <span>{text.collector}: #{row.collectorNumber}</span>}
                              {row.language && <span>{text.cardLanguage}: {row.language}</span>}
                              {row.finish && <span>{text.finish}: {row.finish}</span>}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-500">{text.review}</span>
                        </div>
                        <div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2"><p className="text-xs text-muted-foreground">{text.reason}</p><p className="mt-0.5 text-sm text-amber-600">{row.error || text.validationFailed}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <p className="text-sm font-semibold text-foreground">{text.pricingTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text.pricingHelp}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setPricingMode("default")} aria-pressed={pricingMode === "default"} className={`rounded-2xl border p-4 text-left transition ${pricingMode === "default" ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:border-primary/40"}`}>
                    <div className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full border ${pricingMode === "default" ? "border-primary bg-primary" : "border-muted-foreground"}`} /><span className="font-semibold text-foreground">{text.defaultPricing}</span></div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text.defaultPricingHelp}</p>
                  </button>
                  <button type="button" onClick={() => setPricingMode("discount")} aria-pressed={pricingMode === "discount"} className={`rounded-2xl border p-4 text-left transition ${pricingMode === "discount" ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:border-primary/40"}`}>
                    <div className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full border ${pricingMode === "discount" ? "border-primary bg-primary" : "border-muted-foreground"}`} /><span className="font-semibold text-foreground">{text.discountPricing}</span></div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text.discountPricingHelp}</p>
                  </button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{text.customLater}</p>
              </div>

              <label className="mt-5 grid gap-1.5 text-sm text-muted-foreground">
                {text.duplicates}
                <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)} className="h-11 rounded-xl border border-border bg-secondary px-3 text-foreground">
                  <option value="sum">{text.addQuantities}</option>
                  <option value="replace">{text.replaceQuantities}</option>
                  <option value="skip">{text.skipDuplicates}</option>
                </select>
              </label>

              <button type="button" onClick={importCards} disabled={working || !resolved.length} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-40">
                <FileUp size={17} />{text.importCards} {resolved.length} {text.cards}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
