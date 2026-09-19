"use client";

import { useEffect, useRef, useState } from "react";
import { Boxes, Eye, EyeOff, LockKeyhole, MoreVertical, Package, Plus, Shapes } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { getSupabase } from "@/lib/supabase";

const sealedProducts = ["Booster Boxes", "Bundles", "Commander Decks"];
const otherProducts = ["Figuras", "Accesorios"];

type Binder = {
  id: number;
  name: string;
  is_default: boolean;
  is_public: boolean;
};

function ComingSoonRow({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0">
      <span className="font-semibold text-muted-foreground">{name}</span>
      <span className="rounded-full border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Próximamente</span>
    </div>
  );
}

function BinderRow({ binder }: { binder: Binder }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative flex items-center border-b border-border last:border-b-0">
      <a href={binder.is_default ? "/catalog/binders" : `/catalog/binders/${binder.id}`} className="min-w-0 flex-1 px-5 py-5 transition hover:bg-secondary/30">
        <div className="flex items-center gap-2">
          <strong className="truncate">{binder.name}</strong>
          {binder.is_default && <LockKeyhole size={15} className="shrink-0 text-muted-foreground" aria-label="Binder predeterminado" />}
          {binder.is_public ? <Eye size={15} className="shrink-0 text-muted-foreground" aria-label="Visible en vitrina" /> : <EyeOff size={15} className="shrink-0 text-muted-foreground" aria-label="Oculto en vitrina" />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{binder.is_default ? "Binder principal de tu inventario de cartas." : binder.is_public ? "Visible en tu vitrina pública." : "Oculto de tu vitrina pública."}</p>
      </a>

      <div ref={menuRef} className="relative mr-4">
        <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background text-muted-foreground transition hover:text-foreground" aria-label={`Opciones de ${binder.name}`}>
          <MoreVertical size={18} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
            {!binder.is_default && <button type="button" disabled className="w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-60">Cambiar nombre</button>}
            <button type="button" disabled className="w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-60">{binder.is_public ? "Ocultar de vitrina" : "Mostrar en vitrina"}</button>
            {!binder.is_default && <button type="button" disabled className="w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm text-red-500 opacity-60">Eliminar Binder</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const supabase = getSupabase();
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loadingBinders, setLoadingBinders] = useState(true);
  const [binderError, setBinderError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoadingBinders(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = authData.user;
      if (!user) {
        setBinders([]);
        setLoadingBinders(false);
        return;
      }
      const { data, error } = await supabase.from("binders").select("id,name,is_default,is_public").eq("seller_id", user.id).order("is_default", { ascending: false }).order("id", { ascending: true });
      if (cancelled) return;
      if (error) {
        setBinderError(error.message);
        setBinders([]);
      } else {
        setBinders((data || []) as Binder[]);
      }
      setLoadingBinders(false);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader currentPath="/catalog" />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Inventario del vendedor</p>
          <h1 className="mt-2 font-serif text-4xl">Catálogo / Inventario</h1>
          <p className="mt-2 text-muted-foreground">Administra el inventario de tu tienda por categoría.</p>
        </div>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Boxes size={19} /></span>
              <h2 className="font-serif text-2xl">Binders</h2>
            </div>
            <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-primary/40 px-4 py-3 text-sm font-bold text-primary-foreground/70"><Plus size={17} /> Crear Binder</button>
          </div>
          <div className="overflow-visible rounded-2xl border border-border bg-card">
            {loadingBinders ? <div className="px-5 py-5 text-sm text-muted-foreground">Cargando Binders…</div> : binderError ? <div className="px-5 py-5 text-sm text-red-500">{binderError}</div> : binders.length ? binders.map((binder) => <BinderRow key={binder.id} binder={binder} />) : <div className="px-5 py-5 text-sm text-muted-foreground">No se encontraron Binders.</div>}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground"><Package size={19} /></span><h2 className="font-serif text-2xl">Producto sellado</h2></div><button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-primary/40 px-4 py-3 text-sm font-bold text-primary-foreground/70"><Plus size={17} /> Agregar producto</button></div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">{sealedProducts.map((name) => <ComingSoonRow key={name} name={name} />)}</div>
        </section>

        <section className="mt-8 pb-10">
          <div className="mb-3 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground"><Shapes size={19} /></span><h2 className="font-serif text-2xl">Otros productos</h2></div><button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-primary/40 px-4 py-3 text-sm font-bold text-primary-foreground/70"><Plus size={17} /> Agregar producto</button></div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">{otherProducts.map((name) => <ComingSoonRow key={name} name={name} />)}</div>
        </section>
      </div>
    </main>
  );
}
