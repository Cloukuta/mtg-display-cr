"use client";

import { useEffect, useMemo, useState } from "react";
import { LogIn } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { getSupabase } from "@/lib/supabase";

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/login")) return "/";
  return raw;
}

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = useMemo(() => typeof window === "undefined" ? "/" : safeNext(new URLSearchParams(window.location.search).get("next")), []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) window.location.replace(next);
    });
  }, [next]);

  async function signIn() {
    const supabase = getSupabase();
    if (!supabase) { setError("Authentication is not configured."); return; }
    setBusy(true); setError("");
    try {
      const redirectTo = `${window.location.origin}${next}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (authError) throw authError;
    } catch (e: any) {
      setError(e?.message || "No pudimos iniciar sesión con Google.");
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-background px-4 py-12 text-foreground">
    <section className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex justify-center"><BrandLogo /></div>
      <h1 className="text-center text-2xl font-black">Iniciar sesión</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">Continúa con Google para acceder a tu cuenta de MTG Display CR.</p>
      {error && <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <button type="button" disabled={busy} onClick={()=>void signIn()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-60">
        <LogIn size={18}/>{busy ? "Abriendo Google…" : "Continuar con Google"}
      </button>
      <a href="/" className="mt-4 block text-center text-sm font-semibold text-muted-foreground hover:text-foreground">Volver al marketplace</a>
    </section>
  </main>;
}
