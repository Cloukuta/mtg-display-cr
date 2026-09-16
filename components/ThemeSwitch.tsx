"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import {
  DEFAULT_THEME,
  getStoredTheme,
  saveTheme,
  type Theme,
} from "@/lib/theme";

type ThemeSwitchProps = {
  onThemeChange?: (theme: Theme) => void;
};

export default function ThemeSwitch({
  onThemeChange,
}: ThemeSwitchProps) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const initialTheme = getStoredTheme();

    setTheme(initialTheme);
    saveTheme(initialTheme);
    onThemeChange?.(initialTheme);

    function handleThemeChange(event: Event) {
      const customEvent = event as CustomEvent<Theme>;

      if (
        customEvent.detail !== "dark" &&
        customEvent.detail !== "light"
      ) {
        return;
      }

      setTheme(customEvent.detail);
    }

    window.addEventListener(
      "mtg-theme-change",
      handleThemeChange
    );

    return () => {
      window.removeEventListener(
        "mtg-theme-change",
        handleThemeChange
      );
    };
  }, [onThemeChange]);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    saveTheme(nextTheme);
    onThemeChange?.(nextTheme);
  }

  return (
    <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/[.035] p-1">
      <button
        type="button"
        onClick={() => changeTheme("dark")}
        aria-label="Dark theme"
        aria-pressed={theme === "dark"}
        title="Dark"
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
          theme === "dark"
            ? "bg-[#b9f54a] text-[#11150d]"
            : "text-white/45 hover:text-white"
        }`}
      >
        <Moon size={14} />
        Dark
      </button>

      <button
        type="button"
        onClick={() => changeTheme("light")}
        aria-label="Light theme"
        aria-pressed={theme === "light"}
        title="Light"
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
          theme === "light"
            ? "bg-[#b9f54a] text-[#11150d]"
            : "text-white/45 hover:text-white"
        }`}
      >
        <Sun size={14} />
        Light
      </button>
    </div>
  );
}