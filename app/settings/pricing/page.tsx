"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Percent,
  RefreshCw,
  Save,
} from "lucide-react";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  DEFAULT_LANGUAGE,
  getTranslation,
  type Language,
} from "@/lib/i18n";

import LanguageSwitch from "@/components/LanguageSwitch";
import AppHeader from "@/components/AppHeader";

type PricingSettings = {
  usd_to_crc: number;
  discount_percent: number;
};

export default function PricingSettingsPage() {
  const configured = isSupabaseConfigured();
  const supabase = getSupabase();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [language, setLanguage] =
    useState<Language>(DEFAULT_LANGUAGE);

  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);

  const [settings, setSettings] = useState<PricingSettings>({
    usd_to_crc: 520,
    discount_percent: 20,
  });

  const t = getTranslation(language);

  const handleLanguageChange = useCallback(
    (nextLanguage: Language) => {
      setLanguage(nextLanguage);
    },
    []
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;

    async function loadSettings() {
      setLoading(true);
      setNotice("");

      const { data, error } = await supabase
        .from("seller_pricing_settings")
        .select("usd_to_crc,discount_percent")
        .eq("seller_id", user.id)
        .maybeSingle();

      if (error) {
        setNotice(error.message);
      } else if (data) {
        setSettings({
          usd_to_crc: Number(data.usd_to_crc),
          discount_percent: Number(data.discount_percent),
        });
      }

      setLoading(false);
    }

    void loadSettings();
  }, [supabase, user]);

  async function saveSettings() {
    if (!supabase || !user) return;

    const exchangeRate = Number(settings.usd_to_crc);
    const discount = Number(settings.discount_percent);

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      setSuccess(false);
      setNotice(t.pricing.exchangeError);
      return;
    }

    if (
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount > 100
    ) {
      setSuccess(false);
      setNotice(t.pricing.discountError);
      return;
    }

    setWorking(true);
    setNotice("");
    setSuccess(false);

    const { error } = await supabase
      .from("seller_pricing_settings")
      .upsert(
        {
          seller_id: user.id,
          usd_to_crc: exchangeRate,
          discount_percent: discount,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "seller_id",
        }
      );

    if (error) {
      setNotice(error.message);
      setSuccess(false);
    } else {
      setSettings({
        usd_to_crc: exchangeRate,
        discount_percent: discount,
      });

      setNotice(t.pricing.saved);
      setSuccess(true);
    }

    setWorking(false);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0e0d] text-white/60">
        {t.pricing.loading}
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0e0d] p-5 text-[#f4f3ed]">
        <section className="max-w-lg rounded-3xl border border-amber-400/25 bg-amber-300/[.06] p-7">
          <div className="mb-5 flex justify-end">
            <LanguageSwitch
              onLanguageChange={handleLanguageChange}
            />
          </div>

          <AlertCircle className="mb-4 text-amber-300" />

          <h1 className="font-serif text-3xl">
            {t.pricing.supabaseRequired}
          </h1>

          <a
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 text-[#b9f54a]"
          >
            <ArrowLeft size={16} />
            {t.common.backToDashboard}
          </a>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0e0d] p-5 text-[#f4f3ed]">
        <section className="text-center">
          <div className="mb-6 flex justify-center">
            <LanguageSwitch
              onLanguageChange={handleLanguageChange}
            />
          </div>

          <DollarSign
            className="mx-auto text-[#b9f54a]"
            size={42}
          />

          <h1 className="mt-4 font-serif text-3xl">
            {t.pricing.title}
          </h1>

          <p className="mt-2 text-white/50">
            {t.pricing.signInDescription}
          </p>

          <a
            href="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-[#b9f54a] px-5 py-3 font-bold text-[#11150d]"
          >
            {t.pricing.goToDashboard}
          </a>
        </section>
      </main>
    );
  }

  const defaultExample = 10 * settings.usd_to_crc;

  const discountExample =
    defaultExample *
    (1 - settings.discount_percent / 100);

  return (
    <main className="min-h-screen bg-[#0b0e0d] text-[#f4f3ed]">
      <AppHeader currentPath="/settings/pricing" />

      <div className="mx-auto max-w-5xl px-5 py-8">
        <a
          href="/dashboard"
          className="mb-6 flex items-center gap-2 text-sm text-white/50 transition hover:text-white sm:hidden"
        >
          <ArrowLeft size={16} />
          {t.common.backToDashboard}
        </a>

        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">
            {t.pricing.eyebrow}
          </p>

          <h1 className="mt-2 font-serif text-4xl">
            {t.pricing.title}
          </h1>

          <p className="mt-3 max-w-2xl leading-relaxed text-white/50">
            {t.pricing.description}
          </p>
        </div>

        {notice && (
          <div
            className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              success
                ? "border-[#b9f54a]/25 bg-[#b9f54a]/[.06] text-[#dfff9e]"
                : "border-amber-400/25 bg-amber-300/[.05] text-amber-100"
            }`}
          >
            {success ? (
              <CheckCircle2
                size={19}
                className="mt-0.5 shrink-0 text-[#b9f54a]"
              />
            ) : (
              <AlertCircle
                size={19}
                className="mt-0.5 shrink-0 text-amber-300"
              />
            )}

            {notice}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#b9f54a]/10 text-[#b9f54a]">
                  <DollarSign size={21} />
                </div>

                <div>
                  <h2 className="font-serif text-2xl">
                    {t.pricing.exchangeTitle}
                  </h2>

                  <p className="mt-1 text-sm leading-relaxed text-white/45">
                    {t.pricing.exchangeDescription}
                  </p>
                </div>
              </div>

              <label className="mt-6 block">
                <span className="text-sm text-white/60">
                  {t.pricing.crcPerUsd}
                </span>

                <div className="mt-2 flex h-14 items-center rounded-xl border border-white/10 bg-black/20 focus-within:border-[#b9f54a]">
                  <span className="border-r border-white/10 px-4 text-xl text-white/40">
                    ₡
                  </span>

                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={settings.usd_to_crc}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        usd_to_crc: Number(e.target.value),
                      })
                    }
                    className="min-w-0 flex-1 bg-transparent px-4 text-xl font-bold text-white outline-none"
                  />
                </div>
              </label>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[400, 450, 500].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        usd_to_crc: rate,
                      })
                    }
                    className="rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-sm text-white/55 transition hover:border-[#b9f54a]/40 hover:text-white"
                  >
                    ₡{rate}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-white/35">
                {t.pricing.exchangeHelp}
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#b9f54a]/10 text-[#b9f54a]">
                  <Percent size={21} />
                </div>

                <div>
                  <h2 className="font-serif text-2xl">
                    {t.pricing.discountTitle}
                  </h2>

                  <p className="mt-1 text-sm leading-relaxed text-white/45">
                    {t.pricing.discountDescription}
                  </p>
                </div>
              </div>

              <label className="mt-6 block">
                <span className="text-sm text-white/60">
                  {t.pricing.discountPercentage}
                </span>

                <div className="mt-2 flex h-14 items-center rounded-xl border border-white/10 bg-black/20 focus-within:border-[#b9f54a]">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={settings.discount_percent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        discount_percent: Number(e.target.value),
                      })
                    }
                    className="min-w-0 flex-1 bg-transparent px-4 text-xl font-bold text-white outline-none"
                  />

                  <span className="border-l border-white/10 px-4 text-xl text-white/40">
                    %
                  </span>
                </div>
              </label>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {[10, 20, 30, 40].map((discount) => (
                  <button
                    key={discount}
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        discount_percent: discount,
                      })
                    }
                    className="rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-sm text-white/55 transition hover:border-[#b9f54a]/40 hover:text-white"
                  >
                    {discount}%
                  </button>
                ))}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-white/35">
                {t.pricing.discountHelp}
              </p>
            </section>

            <button
              disabled={working}
              onClick={() => void saveSettings()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b9f54a] font-bold text-[#11150d] transition hover:brightness-105 disabled:opacity-40"
            >
              <Save size={18} />

              {working
                ? t.common.saving
                : t.pricing.saveButton}
            </button>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#b9f54a]">
                {t.pricing.liveExample}
              </p>

              <h2 className="mt-2 font-serif text-2xl">
                {t.pricing.exampleTitle}
              </h2>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/35">
                    {t.pricing.cardKingdom}
                  </p>

                  <strong className="mt-1 block text-xl">
                    $10.00 USD
                  </strong>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/35">
                    {t.pricing.default}
                  </p>

                  <strong className="mt-1 block text-xl text-[#b9f54a]">
                    ₡
                    {Math.round(
                      defaultExample
                    ).toLocaleString("es-CR")}
                  </strong>

                  <p className="mt-1 text-xs text-white/35">
                    $10 × ₡{settings.usd_to_crc}
                  </p>
                </div>

                <div className="rounded-xl border border-[#b9f54a]/20 bg-[#b9f54a]/[.04] p-4">
                  <p className="text-xs uppercase tracking-wide text-white/35">
                    {t.pricing.discount}
                  </p>

                  <strong className="mt-1 block text-xl text-[#b9f54a]">
                    ₡
                    {Math.round(
                      discountExample
                    ).toLocaleString("es-CR")}
                  </strong>

                  <p className="mt-1 text-xs text-white/35">
                    {settings.discount_percent}%{" "}
                    {t.pricing.offDefault}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-400/20 bg-amber-300/[.04] p-4">
                  <p className="text-xs font-semibold text-amber-200">
                    {t.pricing.custom}
                  </p>

                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    {t.pricing.customWarning}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
              <div className="flex items-center gap-3">
                <RefreshCw
                  size={19}
                  className="text-[#b9f54a]"
                />

                <h2 className="font-semibold">
                  {t.pricing.ckPricing}
                </h2>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-white/45">
                {t.pricing.ckDescription}
              </p>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3 text-sm">
                <span className="text-white/35">
                  {t.pricing.status}
                </span>

                <span className="ml-2 text-amber-200">
                  {t.pricing.pendingIntegration}
                </span>
              </div>
            </section>

            <a
              href="/catalog"
              className="flex h-11 items-center justify-center rounded-xl border border-white/10 text-sm font-semibold text-white/65 transition hover:bg-white/[.04] hover:text-white"
            >
              {t.common.openCatalog}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}