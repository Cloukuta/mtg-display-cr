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

function getStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const stored = window.localStorage.getItem(
    LANGUAGE_STORAGE_KEY
  );

  return stored === "en" || stored === "es"
    ? stored
    : DEFAULT_LANGUAGE;
}

export default function LanguageSwitch({
  onLanguageChange,
}: LanguageSwitchProps) {
  const [language, setLanguage] =
    useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const initialLanguage = getStoredLanguage();

    setLanguage(initialLanguage);
    onLanguageChange?.(initialLanguage);

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
      onLanguageChange?.(customEvent.detail);
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
  }, [onLanguageChange]);

  function changeLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;

    setLanguage(nextLanguage);

    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      nextLanguage
    );

    window.dispatchEvent(
      new CustomEvent<Language>(
        "mtg-language-change",
        {
          detail: nextLanguage,
        }
      )
    );

    /*
      Some legacy pages still read the language only when they mount. Reloading
      after persisting + broadcasting keeps the language contract consistent on
      every route while those pages are progressively migrated to live listeners.
    */
    window.requestAnimationFrame(() => {
      window.location.reload();
    });
  }

  return (
    <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/[.035] p-1">
      <button
        type="button"
        onClick={() => changeLanguage("es")}
        aria-label="Español"
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
        aria-label="English"
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