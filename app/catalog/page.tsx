"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  CheckSquare,
  Search,
  Square,
  Store,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getTranslation,
  type Language,
} from "@/lib/i18n";

type PricingMode = "default" | "custom" | "discount";
type FilterMode = "all" | PricingMode;

type CardData = {
  name: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  image_uri: string | null;
  cardkingdom_price_usd: number | null;
  cardkingdom_price_updated_at: string | null;
};

type InventoryItem = {
  id: number;
  quantity: number;
  condition: string;
  language: string;
  finish: string;
  available: boolean;
  pricing_mode: PricingMode;
  custom_price_crc: number | null;
  cards: CardData | null;
};

type PricingSettings = {
  usd_to_crc: number;
  discount_percent: number;
};

const crc = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

function calculatePrice(
  item: InventoryItem,
  settings: PricingSettings
): number | null {
  if (item.pricing_mode === "custom") {
    return item.custom_price_crc;
  }

  const ck = item.cards?.cardkingdom_price_usd;

  if (ck == null) return null;

  const base = ck * settings.usd_to_crc;

  if (item.pricing_mode === "discount") {
    return Math.round(base * (1 - settings.discount_percent / 100));
  }

  return Math.round(base);
}

export default function CatalogPage() {
  const configured = isSupabaseConfigured();
  const supabase = getSupabase();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<PricingSettings>({
    usd_to_crc: 520,
    discount_percent: 20,
  });

  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  const t = getTranslation(language);

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (stored === "es" || stored === "en") {
      setLanguage(stored);
    }

    function handleLanguageChange(event: Event) {
      const customEvent = event as CustomEvent<Language>;

      if (customEvent.detail === "es" || customEvent.detail === "en") {
        setLanguage(customEvent.detail);
      }
    }

    window.addEventListener("mtg-language-change", handleLanguageChange);

    return () => {
      window.removeEventListener("mtg-language-change", handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;

    async function loadCatalog() {
      setLoading(true);

      const [inventoryResult, settingsResult] = await Promise.all([
        supabase
          .from("inventory_items")
          .select(
            `
              id,
              quantity,
              condition,
              language,
              finish,
              available,
              pricing_mode,
              custom_price_crc,
              cards (
                name,
                set_code,
                set_name,
                collector_number,
                image_uri,
                cardkingdom_price_usd,
                cardkingdom_price_updated_at
              )
            `
          )
          .eq("seller_id", user.id)
          .order("updated_at", { ascending: false }),

        supabase
          .from("seller_pricing_settings")
          .select("usd_to_crc,discount_percent")
          .eq("seller_id", user.id)
          .maybeSingle(),
      ]);

      if (inventoryResult.error) {
        setNotice(inventoryResult.error.message);
      } else if (inventoryResult.data) {
        setInventory(
          inventoryResult.data as unknown as InventoryItem[]
        );
      }

      if (settingsResult.data) {
        setSettings({
          usd_to_crc: Number(settingsResult.data.usd_to_crc),
          discount_percent: Number(
            settingsResult.data.discount_percent
          ),
        });
      }

      setLoading(false);
    }

    void loadCatalog();
  }, [supabase, user]);

  const counts = useMemo(() => {
    return {
      all: inventory.length,
      default: inventory.filter(
        (item) => item.pricing_mode === "default"
      ).length,
      custom: inventory.filter(
        (item) => item.pricing_mode === "custom"
      ).length,
      discount: inventory.filter(
        (item) => item.pricing_mode === "discount"
      ).length,
    };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();

    return inventory.filter((item) => {
      if (filter !== "all" && item.pricing_mode !== filter) {
        return false;
      }

      if (!term) return true;

      const card = item.cards;

      return (
        card?.name.toLowerCase().includes(term) ||
        card?.set_code.toLowerCase().includes(term) ||
        card?.set_name.toLowerCase().includes(term) ||
        card?.collector_number.toLowerCase().includes(term)
      );
    });
  }, [inventory, filter, search]);

  const selectedItems = useMemo(
    () => inventory.filter((item) => selected.includes(item.id)),
    [inventory, selected]
  );

  const selectedValue = useMemo(() => {
    return selectedItems.reduce((total, item) => {
      const price = calculatePrice(item, settings);
      return total + (price ?? 0) * item.quantity;
    }, 0);
  }, [selectedItems, settings]);

  function toggleSelected(id: number) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  }

  function selectVisible() {
    const ids = filteredInventory.map((item) => item.id);

    const allSelected =
      ids.length > 0 && ids.every((id) => selected.includes(id));

    if (allSelected) {
      setSelected((current) =>
        current.filter((id) => !ids.includes(id))
      );
    } else {
      setSelected((current) => Array.from(new Set([...current, ...ids])));
    }
  }

  async function changePricingMode(
    ids: number[],
    mode: PricingMode
  ) {
    if (!supabase || !ids.length) return;

    setWorking(true);
    setNotice("");

    const { error } = await supabase
      .from("inventory_items")
      .update({
        pricing_mode: mode,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) {
      setNotice(error.message);
      setWorking(false);
      return;
    }

    setInventory((current) =>
      current.map((item) =>
        ids.includes(item.id)
          ? { ...item, pricing_mode: mode }
          : item
      )
    );

    setSelected([]);
    const modeLabel =
      mode === "default"
        ? t.catalog.default
        : mode === "custom"
        ? t.catalog.custom
        : t.catalog.discount;

    setNotice(
      `${ids.length} ${
        ids.length === 1
          ? t.catalog.listingMoved
          : t.catalog.listingsMoved
      } ${modeLabel}.`
    );
    setWorking(false);
  }

  async function updateCustomPrice(item: InventoryItem, value: number) {
    if (!supabase) return;

    const price = Math.max(0, Math.round(value));

    setInventory((current) =>
      current.map((row) =>
        row.id === item.id
          ? { ...row, custom_price_crc: price }
          : row
      )
    );

    const { error } = await supabase
      .from("inventory_items")
      .update({
        custom_price_crc: price,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) setNotice(error.message);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        {t.catalog.loading}
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground">
        <section className="max-w-lg rounded-3xl border border-amber-400/25 bg-amber-300/[.06] p-7">
          <AlertCircle className="mb-4 text-amber-300" />
          <h1 className="font-serif text-3xl">
            {t.catalog.supabaseRequired}
          </h1>
          <a
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 text-[#b9f54a]"
          >
            <ArrowLeft size={16} />
            {t.catalog.backToDashboard}
          </a>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground">
        <section className="text-center">
          <Store className="mx-auto text-[#b9f54a]" size={40} />
          <h1 className="mt-4 font-serif text-3xl">
            {t.catalog.sellerCatalog}
          </h1>
          <p className="mt-2 text-white/50">
            {t.catalog.signInDescription}
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-[#b9f54a] px-5 py-3 font-bold text-[#11150d]"
          >
            {t.catalog.goToDashboard}
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader currentPath="/catalog" />

      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">
              {t.catalog.eyebrow}
            </p>

            <h1 className="mt-2 font-serif text-4xl">
              {t.catalog.title}
            </h1>

            <p className="mt-2 text-white/45">
              {inventory.length} {t.catalog.privateCatalog}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/[.035] px-4 py-3">
              <span className="text-white/40">{t.catalog.usdToCrc}</span>
              <strong className="ml-2">
                ₡{settings.usd_to_crc}
              </strong>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[.035] px-4 py-3">
              <span className="text-white/40">{t.catalog.discountSetting}</span>
              <strong className="ml-2">
                {settings.discount_percent}%
              </strong>
            </div>
          </div>
        </div>

        {notice && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white/70">
            {notice}
          </div>
        )}

        <section className="mt-7 rounded-3xl border border-white/10 bg-white/[.025] p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", t.catalog.all],
                  ["default", t.catalog.default],
                  ["custom", t.catalog.custom],
                  ["discount", t.catalog.discount],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    filter === value
                      ? "bg-[#b9f54a] text-[#11150d]"
                      : "border border-white/10 bg-white/[.035] text-white/60 hover:text-white"
                  }`}
                >
                  {label} ({counts[value]})
                </button>
              ))}
            </div>

            <div className="relative w-full xl:w-80">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.catalog.search}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-4 text-sm outline-none focus:border-[#b9f54a]"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <button
              onClick={selectVisible}
              className="flex items-center gap-2 text-sm text-white/55 hover:text-white"
            >
              {filteredInventory.length > 0 &&
              filteredInventory.every((item) =>
                selected.includes(item.id)
              ) ? (
                <CheckSquare size={18} className="text-[#b9f54a]" />
              ) : (
                <Square size={18} />
              )}
              {t.catalog.selectVisible}
            </button>

            <span className="text-sm text-white/40">
              {filteredInventory.length} {t.catalog.shown}
            </span>
          </div>
        </section>

        {selected.length > 0 && (
          <section className="sticky top-4 z-20 mt-5 rounded-2xl border border-[#b9f54a]/30 bg-[#151a12] p-4 shadow-2xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <strong>{selected.length} {t.catalog.selected}</strong>
                <span className="ml-3 text-sm text-white/45">
                  {t.catalog.currentValue}: {crc.format(selectedValue)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  disabled={working}
                  onClick={() =>
                    void changePricingMode(selected, "default")
                  }
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/[.05] disabled:opacity-40"
                >
                  {t.catalog.setDefault}
                </button>

                <button
                  disabled={working}
                  onClick={() =>
                    void changePricingMode(selected, "custom")
                  }
                  className="rounded-xl border border-amber-400/25 bg-amber-300/[.06] px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-40"
                >
                  {t.catalog.setCustom}
                </button>

                <button
                  disabled={working}
                  onClick={() =>
                    void changePricingMode(selected, "discount")
                  }
                  className="rounded-xl bg-[#b9f54a] px-4 py-2 text-sm font-bold text-[#11150d] disabled:opacity-40"
                >
                  {t.catalog.setDiscount}
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]">
          {filteredInventory.length === 0 ? (
            <div className="p-12 text-center">
              <Store className="mx-auto text-white/20" size={38} />
              <p className="mt-4 text-white/50">
                {t.catalog.noListings}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredInventory.map((item) => {
                const card = item.cards;
                const price = calculatePrice(item, settings);
                const isSelected = selected.includes(item.id);

                return (
                  <article
                    key={item.id}
                    className={`grid gap-4 p-4 transition md:grid-cols-[auto_64px_1fr_auto] md:items-center ${
                      isSelected ? "bg-[#b9f54a]/[.055]" : ""
                    }`}
                  >
                    <button
                      onClick={() => toggleSelected(item.id)}
                      className="text-white/45 hover:text-white"
                    >
                      {isSelected ? (
                        <CheckSquare
                          size={20}
                          className="text-[#b9f54a]"
                        />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>

                    <div className="h-20 w-14 overflow-hidden rounded-lg bg-white/[.05]">
                      {card?.image_uri ? (
                        <img
                          src={card.image_uri}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-[10px] text-white/25">
                          {t.catalog.noImage}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">
                        {card?.name || t.catalog.unknownCard}
                      </h2>

                      <p className="mt-1 text-sm text-white/40">
                        {card?.set_code?.toUpperCase()} #
                        {card?.collector_number} · {item.condition} ·{" "}
                        {item.language} · {item.finish}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-lg bg-white/[.05] px-2 py-1 text-white/45">
                          {t.catalog.qty} {item.quantity}
                        </span>

                        <span
                          className={`rounded-lg px-2 py-1 ${
                            item.pricing_mode === "custom"
                              ? "bg-amber-300/[.08] text-amber-200"
                              : item.pricing_mode === "discount"
                              ? "bg-[#b9f54a]/10 text-[#b9f54a]"
                              : "bg-white/[.05] text-white/55"
                          }`}
                        >
                          {item.pricing_mode === "custom"
                            ? t.catalog.custom
                            : item.pricing_mode === "discount"
                            ? `${t.catalog.discount} ${settings.discount_percent}%`
                            : t.catalog.default}
                        </span>

                        <span
                          className={`rounded-lg px-2 py-1 ${
                            item.available
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-white/[.05] text-white/35"
                          }`}
                        >
                          {item.available ? t.catalog.available : t.catalog.hidden}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-48 md:text-right">
                      <p className="text-xs uppercase tracking-wide text-white/35">
                        {t.catalog.cardKingdom}
                      </p>

                      <p className="mt-1 text-sm text-white/60">
                        {card?.cardkingdom_price_usd != null
                          ? `$${Number(
                              card.cardkingdom_price_usd
                            ).toFixed(2)} USD`
                          : t.catalog.pending}
                      </p>

                      <p className="mt-3 text-xs uppercase tracking-wide text-white/35">
                        {t.catalog.salePrice}
                      </p>

                      {item.pricing_mode === "custom" ? (
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <span className="text-sm text-white/45">
                            ₡
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={item.custom_price_crc ?? 0}
                            onChange={(e) =>
                              setInventory((current) =>
                                current.map((row) =>
                                  row.id === item.id
                                    ? {
                                        ...row,
                                        custom_price_crc:
                                          Number(e.target.value) || 0,
                                      }
                                    : row
                                )
                              )
                            }
                            onBlur={(e) =>
                              void updateCustomPrice(
                                item,
                                Number(e.target.value)
                              )
                            }
                            className="h-9 w-28 rounded-lg border border-amber-400/25 bg-black/25 px-3 text-right text-sm outline-none focus:border-amber-300"
                          />
                        </div>
                      ) : (
                        <p className="mt-1 text-lg font-bold text-[#b9f54a]">
                          {price == null ? t.catalog.pending : crc.format(price)}
                        </p>
                      )}

                      {item.pricing_mode === "custom" && (
                        <p className="mt-2 max-w-52 text-xs leading-relaxed text-amber-200/55">
                          {t.catalog.customWarning}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}