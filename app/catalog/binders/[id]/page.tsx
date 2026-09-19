"use client";

import { useParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export default function CustomBinderInventoryPage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader currentPath="/catalog" />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <a href="/catalog" className="text-sm font-semibold text-primary">← Catálogo / Inventario</a>
        <div className="mt-8 rounded-2xl border border-border bg-card p-8">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Binder #{params.id}</p>
          <h1 className="mt-2 font-serif text-3xl">Inventario del Binder</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">La ruta individual del Binder ya está separada correctamente. En el siguiente paso conectaremos aquí el editor estable filtrado exclusivamente por este Binder, sin modificar el Trade Binder.</p>
        </div>
      </div>
    </main>
  );
}
