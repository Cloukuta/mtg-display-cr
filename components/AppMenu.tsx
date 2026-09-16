"use client";

import { useEffect, useState } from "react";
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

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getTranslation,
  type Language,
} from "@/lib/i18n";

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

  const [language, setLanguage] =
    useState<Language>(DEFAULT_LANGUAGE);

  const t = getTranslation(language);

  useEffect(() => {
    const stored = window.localStorage.getItem(
      LANGUAGE_STORAGE_KEY
    );

    if (stored === "es" || stored === "en") {
      setLanguage(stored);
    }

    function handleLanguageChange(event: Event) {
      const customEvent =
        event as CustomEvent<Language>;

      if (
        customEvent.detail !== "es" &&
        customEvent.detail !== "en"
      ) {
        return;
      }

      setLanguage(customEvent.detail);
    }

    window.addEventListener(
      "mtg-language-change",
      handleLanguageChange
    );

    return () => {
      window.removeEventListener(
        "mtg-language-change",
        handleLanguageChange
      );
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  /*
   * The real public route remains /v/[slug].
   * We intentionally hide /v/ from the seller label.
   */
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
      window.prompt(
        t.navigation.copyStoreLink,
        url
      );
    }
  }

  async function signOut() {
    if (!supabase) return;

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const navigation = [
    {
      label: t.navigation.dashboard,
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: t.navigation.catalog,
      href: "/catalog",
      icon: Package,
    },
    {
      label: t.navigation.importCards,
      href: "/import",
      icon: Upload,
    },
    {
      label: t.navigation.pricingSettings,
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
        className="app-overlay absolute inset-0 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="app-surface absolute right-0 top-0 flex h-full w-[min(90vw,390px)] flex-col overflow-y-auto border-l border-border shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
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
            className="grid h-10 w-10 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-border px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            {t.navigation.seller}
          </p>

          <p className="mt-2 truncate font-semibold">
            {sellerName || "MTG Display CR"}
          </p>

          {sellerSlug ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              @{sellerSlug}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {t.navigation.storeNotConfigured}
            </p>
          )}
        </div>

        <nav className="border-b border-border p-3">
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
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="border-b border-border px-5 py-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            {t.navigation.preferences}
          </p>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {t.navigation.language}
              </p>

              <LanguageSwitch />
            </div>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {t.navigation.theme}
              </p>

              <ThemeSwitch />
            </div>
          </div>
        </div>

        <div className="space-y-1 border-b border-border p-3">
          {publicPath && (
            <>
              <a
                href={publicPath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <ExternalLink size={18} />
                {t.navigation.viewPublicStore}
              </a>

              <button
                type="button"
                onClick={() =>
                  void copyStoreLink()
                }
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <Copy size={18} />
                {t.navigation.copyStoreLink}
              </button>
            </>
          )}

          <a
            href="/catalog"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <BarChart3 size={18} />
            {t.navigation.catalogManagement}
          </a>
        </div>

        <div className="mt-auto p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            <LogOut size={18} />
            {t.navigation.signOut}
          </button>
        </div>
      </aside>
    </div>
  );
}