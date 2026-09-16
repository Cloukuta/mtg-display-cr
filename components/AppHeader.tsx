"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import AppMenu from "@/components/AppMenu";
import BrandLogo from "@/components/BrandLogo";

import { getSupabase } from "@/lib/supabase";

type SellerProfile = {
  public_name: string | null;
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
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        console.error(
          "Could not load authenticated user:",
          authError
        );
        return;
      }

      const user = authData.user;

      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("public_name,slug")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Could not load seller profile:",
          error
        );
        return;
      }

      if (data) {
        setProfile({
          public_name: data.public_name ?? null,
          slug: data.slug ?? null,
        });
      }
    }

    void loadProfile();
  }, [supabase]);

  return (
    <>
      <header className="border-b border-border bg-background/95 text-foreground backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <BrandLogo />

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
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
        sellerName={profile?.public_name}
        sellerSlug={profile?.slug}
      />
    </>
  );
}