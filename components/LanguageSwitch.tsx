"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from "@/lib/i18n";

type LanguageSwitchProps = {
  onLanguageChange?: (language: Language) => void;
};

export default function LanguageSwitch({
  onLanguageChange,
}: LanguageSwitchProps) {
  const [language, setLanguage] =
    useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = window.localStorage.getItem(
      LANGUAGE_STORAGE_KEY
    );

    const initialLanguage: Language =
      stored === "en" || stored === "es"
        ? stored
        : DEFAULT_LANGUAGE;

    setLanguage(initialLanguage);
    onLanguageChange?.(initialLanguage);
  }, [onLanguageChange]);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);

    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      nextLanguage
    );

    window.dispatchEvent(
      new CustomEvent("mtg-language-change", {
        detail: nextLanguage,
      })
    );

    onLanguageChange?.(nextLanguage);
  }

  return (
    <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/[.035] p-1">
      <button
        type="button"
        onClick={() => changeLanguage("es")}
        aria-pressed={language === "es"}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
          language === "es"
            ? "bg-[#b9f54a] text-[#11150d]"
            : "text-white/45 hover:text-white"
        }`}
      >
        ES
      </button>

      <button
        type="button"
        onClick={() => changeLanguage("en")}
        aria-pressed={language === "en"}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
          language === "en"
            ? "bg-[#b9f54a] text-[#11150d]"
            : "text-white/45 hover:text-white"
        }`}
      >
        EN
      </button>
    </div>
  );
}