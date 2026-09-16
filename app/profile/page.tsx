"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertCircle, Check, ExternalLink, LogIn, Save, Store, UserRound } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Profile = {
  public_name: string;
  slug: string;
  whatsapp: string;
  location: string;
  delivery_text: string;
  published: boolean;
};

const blankProfile: Profile = {
  public_name: "",
  slug: "",
  whatsapp: "",
  location: "",
  delivery_text: "",
  published: false,
};

export default function ProfilePage() {
  const configured = isSupabaseConfigured();
  const supabase = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    void supabase.from("profiles").select("public_name,slug,whatsapp,location,delivery_text,published").eq("id", user.id).single().then(({ data, error }) => {
      if (error) setNotice(error.message);
      if (data) setProfile(data as Profile);
    });
  }, [supabase, user]);

  const publicPath = useMemo(() => profile.slug ? `/v/${profile.slug}` : "", [profile.slug]);

  async function signIn() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/profile` } });
  }

  async function saveProfile() {
    if (!supabase || !user) return;
    setWorking(true); setNotice("");
    const normalized: Profile = {
      ...profile,
      slug: profile.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      whatsapp: profile.whatsapp.replace(/\D/g, ""),
    };
    const { error } = await supabase.from("profiles").update({ ...normalized, updated_at: new Date().toISOString() }).eq("id", user.id);
    setWorking(false);
    if (error) setNotice(error.message);
    else { setProfile(normalized); setNotice("Profile saved successfully."); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">Loading profile…</main>;
  if (!configured) return <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground"><section className="max-w-lg rounded-3xl border border-amber-400/25 bg-amber-300/[.06] p-7"><AlertCircle className="mb-4 text-amber-500"/><h1 className="font-serif text-3xl">Supabase connection required</h1></section></main>;
  if (!user) return <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground"><section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><UserRound/></div><h1 className="mt-5 font-serif text-3xl">My Profile</h1><p className="mt-3 text-muted-foreground">Sign in to manage your buyer and seller information.</p><button onClick={signIn} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground"><LogIn size={18}/> Continue with Google</button></section></main>;

  return <main className="min-h-screen bg-background text-foreground">
    <AppHeader currentPath="/profile"/>
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-7 md:flex-row md:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Account</p><h1 className="mt-2 font-serif text-4xl">My Profile</h1><p className="mt-2 text-muted-foreground">Manage the information used when you buy or sell cards.</p></div>
        {publicPath && <a href={publicPath} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground"><ExternalLink size={17}/> View public display</a>}
      </div>

      {notice && <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound size={20}/></div><div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">General</p><h2 className="font-serif text-2xl">Account information</h2></div></div>
            <div className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm text-muted-foreground">Public name<input value={profile.public_name} onChange={e=>setProfile({...profile,public_name:e.target.value})} className="h-11 rounded-xl border border-border bg-background px-4 text-foreground outline-none focus:border-primary"/></label>
              <label className="grid gap-1.5 text-sm text-muted-foreground">Account email<input value={user.email||""} disabled className="h-11 rounded-xl border border-border bg-secondary/40 px-4 text-muted-foreground"/></label>
              <label className="grid gap-1.5 text-sm text-muted-foreground">WhatsApp with country code<input value={profile.whatsapp} onChange={e=>setProfile({...profile,whatsapp:e.target.value})} placeholder="50688888888" className="h-11 rounded-xl border border-border bg-background px-4 text-foreground outline-none focus:border-primary"/></label>
              <label className="grid gap-1.5 text-sm text-muted-foreground">Location<input value={profile.location} onChange={e=>setProfile({...profile,location:e.target.value})} placeholder="Alajuela, Costa Rica" className="h-11 rounded-xl border border-border bg-background px-4 text-foreground outline-none focus:border-primary"/></label>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Buyer</p><h2 className="mt-1 font-serif text-2xl">Buying preferences</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your pickup locations from Red de Envíos will live here. During checkout we will match them against the seller's available delivery locations.</p>
            <div className="mt-5 rounded-2xl border border-dashed border-border bg-secondary/20 p-5 text-sm text-muted-foreground">Red de Envíos pickup locations · Coming in the next database migration.</div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Store size={20}/></div><div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Seller</p><h2 className="font-serif text-2xl">Public display</h2></div></div>
            <div className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm text-muted-foreground">Public link<div className="flex h-11 rounded-xl border border-border bg-background"><span className="flex items-center border-r border-border px-3 text-muted-foreground">/v/</span><input value={profile.slug} onChange={e=>setProfile({...profile,slug:e.target.value})} className="min-w-0 flex-1 bg-transparent px-3 text-foreground outline-none"/></div></label>
              <label className="grid gap-1.5 text-sm text-muted-foreground">Delivery note<input value={profile.delivery_text} onChange={e=>setProfile({...profile,delivery_text:e.target.value})} placeholder="Optional temporary delivery note" className="h-11 rounded-xl border border-border bg-background px-4 text-foreground outline-none focus:border-primary"/></label>
              <button type="button" onClick={()=>setProfile({...profile,published:!profile.published})} className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${profile.published?"border-primary/35 bg-primary/[.06]":"border-border bg-background"}`}><div><p className="font-semibold">Publish catalog</p><p className="mt-1 text-xs text-muted-foreground">Turn your public display on or off without changing inventory.</p></div><span className={`grid h-6 w-6 place-items-center rounded-md border ${profile.published?"border-primary bg-primary text-primary-foreground":"border-border"}`}>{profile.published&&<Check size={15}/>}</span></button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4"><p className="text-sm font-semibold">SINPE Móvil</p><p className="mt-1 text-xs text-muted-foreground">Separate from WhatsApp. Added in the next migration.</p></div><div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4"><p className="text-sm font-semibold">Delivery locations</p><p className="mt-1 text-xs text-muted-foreground">Seller Red de Envíos locations will be selected here.</p></div></div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Profile status</p><div className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Public display</span><strong className={profile.published?"text-primary":"text-muted-foreground"}>{profile.published?"Published":"Hidden"}</strong></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Seller URL</span><strong>{profile.slug?`@${profile.slug}`:"Not configured"}</strong></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Buyer profile</span><strong className="text-amber-500">Needs delivery locations</strong></div></div></section>
        </div>
      </div>

      <div className="sticky bottom-4 mt-6 flex justify-end"><button disabled={working} onClick={()=>void saveProfile()} className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow-xl disabled:opacity-50"><Save size={18}/>{working?"Saving…":"Save profile"}</button></div>
    </div>
  </main>;
}
