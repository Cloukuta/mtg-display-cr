"use client";

import { Boxes, LockKeyhole, Package, Plus, Shapes } from "lucide-react";
import AppHeader from "@/components/AppHeader";

const sealedProducts = ["Booster Boxes", "Bundles", "Commander Decks"];
const otherProducts = ["Figuras", "Accesorios"];

function ComingSoonRow({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0">
      <span className="font-semibold text-muted-foreground">{name}</span>
      <span className="rounded-full border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
        Próximamente
      </span>
    </div>
  );
}

export default function CatalogPage() {
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
            <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-primary/40 px-4 py-3 text-sm font-bold text-primary-foreground/70">
              <Plus size={17} /> Crear Binder
            </button>
          </div>
          <a href="/catalog/binders" className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-5 transition hover:border-primary/40">
            <div>
              <div className="flex items-center gap-2">
                <strong>Trade Binder</strong>
                <LockKeyhole size={15} className="text-muted-foreground" aria-label="Binder predeterminado" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Binder principal de tu inventario de cartas.</p>
            </div>
            <span className="text-sm font-semibold text-primary">Abrir →</span>
          </a>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground"><Package size={19} /></span>
              <h2 className="font-serif text-2xl">Producto sellado</h2>
            </div>
            <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-primary/40 px-4 py-3 text-sm font-bold text-primary-foreground/70">
              <Plus size={17} /> Agregar producto
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {sealedProducts.map((name) => <ComingSoonRow key={name} name={name} />)}
          </div>
        </section>

        <section className="mt-8 pb-10">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground"><Shapes size={19} /></span>
              <h2 className="font-serif text-2xl">Otros productos</h2>
            </div>
            <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-primary/40 px-4 py-3 text-sm font-bold text-primary-foreground/70">
              <Plus size={17} /> Agregar producto
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {otherProducts.map((name) => <ComingSoonRow key={name} name={name} />)}
          </div>
        </section>
      </div>
    </main>
  );
}
