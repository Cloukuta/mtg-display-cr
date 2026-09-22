"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import AppMenu from "@/components/AppMenu";
import BrandLogo from "@/components/BrandLogo";
import PendingSalesTestButton from "@/components/PendingSalesTestButton";
import CatalogInventoryEditor from "@/components/CatalogInventoryEditor";
import NotificationsBell from "@/components/NotificationsBell";

import { getSupabase } from "@/lib/supabase";

const SELLER_ACTIONABLE_STATUSES = ["inventory_confirmation", "preparing_shipment", "payment_submitted", "paid"];
type SellerProfile = { public_name: string | null; slug: string | null };
type AppHeaderProps = { currentPath?: string };

export default function AppHeader({ currentPath = "" }: AppHeaderProps) {
  const supabase = getSupabase();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingSellerActions, setPendingSellerActions] = useState(0);

  const loadPendingSellerActions = useCallback(async (id: string) => {
    if (!supabase) return;
    const { count, error } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", id).eq("response_required_from", "seller").in("status", SELLER_ACTIONABLE_STATUSES);
    if (!error) setPendingSellerActions(count || 0);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    async function loadProfile() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) { console.error("Could not load authenticated user:", authError); return; }
      const user = authData.user;
      if (!user) return;
      setUserId(user.id);
      void loadPendingSellerActions(user.id);
      const { data, error } = await supabase.from("profiles").select("public_name,slug").eq("id", user.id).maybeSingle();
      if (error) { console.error("Could not load seller profile:", error); return; }
      if (data) setProfile({ public_name: data.public_name ?? null, slug: data.slug ?? null });
    }
    void loadProfile();
  }, [supabase, loadPendingSellerActions]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase.channel(`header-pending-sales-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `seller_id=eq.${userId}` }, () => { void loadPendingSellerActions(userId); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, userId, loadPendingSellerActions]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <BrandLogo />
          <div className="flex items-center gap-2">
            {currentPath === "/pending-sales" && <PendingSalesTestButton />}
            {currentPath === "/catalog" && pathname === "/catalog/binders" && <CatalogInventoryEditor />}
            <NotificationsBell />
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation menu" aria-expanded={menuOpen} className="relative flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
              <Menu size={19} />
              <span className="hidden sm:inline">Menu</span>
              {pendingSellerActions > 0 && <span className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-black leading-none text-black shadow-md" aria-label={`${pendingSellerActions} pending seller action${pendingSellerActions === 1 ? "" : "s"}`}>{pendingSellerActions > 99 ? "99+" : pendingSellerActions}</span>}
            </button>
          </div>
        </div>
      </header>
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} currentPath={currentPath} sellerName={profile?.public_name} sellerSlug={profile?.slug} />
    </>
  );
}
