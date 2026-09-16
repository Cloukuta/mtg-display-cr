"use client";

import { useEffect } from "react";
import {
  BarChart3,
  Copy,
  DollarSign,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Package,
  Upload,
  X,
} from "lucide-react";

import LanguageSwitch from "@/components/LanguageSwitch";
import ThemeSwitch from "@/components/ThemeSwitch";
import { getSupabase } from "@/lib/supabase";

type AppMenuProps = {
  open: boolean;
  onClose: () => void;
  currentPath?: string;
  sellerName?: string | null;
  sellerSlug?: string | null;
};

export default function AppMenu({
  open,
  onClose,
  currentPath = "",
  sellerName,
  sellerSlug,
}: AppMenuProps) {
  const supabase = getSupabase();

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const publicPath = sellerSlug
    ? `/v/${sellerSlug}`
    : null;

  function isActive(path: string) {
    if (path === "/dashboard") {
      return currentPath === "/dashboard";
    }

    return currentPath.startsWith(path);
  }

  async function copyStoreLink() {
    if (!publicPath) return;

    const url = `${window.location.origin}${publicPath}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy your store URL:", url);
    }
  }

  async function signOut() {
    if (!supabase) return;

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const navigation = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "My Catalog",
      href: "/catalog",
      icon: Package,
    },
    {
      label: "Import Cards",
      href: "/import",
      icon: Upload,
    },
    {
      label: "Pricing Settings",
      href: "/settings/pricing",
      icon: DollarSign,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="absolute right-0 top-0 flex h-full w-[min(90vw,390px)] flex-col overflow-y-auto border-l border-white/10 bg-[#101411] text-[#f4f3ed] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b9f54a]">
              MTG
            </p>

            <strong className="font-serif text-xl">
              Display CR
            </strong>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/55 transition hover:bg-white/[.05] hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/30">
            Seller
          </p>

          <p className="mt-2 truncate font-semibold">
            {sellerName || "MTG Display CR Seller"}
          </p>

          {sellerSlug ? (
            <p className="mt-1 truncate text-sm text-white/40">
              /v/{sellerSlug}
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/35">
              Public store not configured
            </p>
          )}
        </div>

        <nav className="border-b border-white/10 p-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <a
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[#b9f54a] text-[#11150d]"
                    : "text-white/60 hover:bg-white/[.05] hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="border-b border-white/10 px-5 py-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-white/30">
            Preferences
          </p>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs text-white/40">
                Language
              </p>

              <LanguageSwitch />
            </div>

            <div>
              <p className="mb-2 text-xs text-white/40">
                Theme
              </p>

              <ThemeSwitch />
            </div>
          </div>
        </div>

        <div className="space-y-1 border-b border-white/10 p-3">
          {publicPath && (
            <>
              <a
                href={publicPath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/60 transition hover:bg-white/[.05] hover:text-white"
              >
                <ExternalLink size={18} />
                View Public Store
              </a>

              <button
                type="button"
                onClick={() => void copyStoreLink()}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/60 transition hover:bg-white/[.05] hover:text-white"
              >
                <Copy size={18} />
                Copy Store Link
              </button>
            </>
          )}

          <a
            href="/catalog"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/60 transition hover:bg-white/[.05] hover:text-white"
          >
            <BarChart3 size={18} />
            Catalog Management
          </a>
        </div>

        <div className="mt-auto p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-300 transition hover:bg-red-400/[.07]"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}