"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import AppMenu from "@/components/AppMenu";
import { getSupabase } from "@/lib/supabase";

type SellerProfile = {
  display_name: string | null;
  slug: string | null;
};

type AppHeaderProps = {
  currentPath?: string;
};

export default function AppHeader({
  currentPath = "",
}: AppHeaderProps) {
  const supabase = getSupabase();

  const [menuOpen, setMenuOpen] = useState(false);

  const [profile, setProfile] =
    useState<SellerProfile | null>(null);

  useEffect(() => {
    if (!supabase) return;

    async function loadProfile() {
      const { data: authData } =
        await supabase.auth.getUser();

      const user = authData.user;

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("display_name,slug")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          display_name: data.display_name ?? null,
          slug: data.slug ?? null,
        });
      }
    }

    void loadProfile();
  }, [supabase]);

  return (
    <>
      <header className="border-b border-white/10 bg-[#0b0e0d]/95 text-[#f4f3ed] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <a
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#b9f54a] font-serif font-bold text-[#11150d]">
              M
            </div>

            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#b9f54a]">
                MTG
              </p>

              <strong className="font-serif">
                Display CR
              </strong>
            </div>
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 text-sm font-semibold text-white/65 transition hover:bg-white/[.06] hover:text-white"
          >
            <Menu size={19} />

            <span className="hidden sm:inline">
              Menu
            </span>
          </button>
        </div>
      </header>

      <AppMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        currentPath={currentPath}
        sellerName={profile?.display_name}
        sellerSlug={profile?.slug}
      />
    </>
  );
}