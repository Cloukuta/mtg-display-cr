"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type ColorChoice = "W" | "U" | "B" | "R" | "G" | "C" | "M";

type Props = {
  value: ColorChoice[];
  onChange: (value: ColorChoice[]) => void;
  language: "es" | "en";
  className?: string;
  heightClass?: string;
};

const OPTIONS: { value: ColorChoice; es: string; en: string }[] = [
  { value: "W", es: "Blanco", en: "White" },
  { value: "U", es: "Azul", en: "Blue" },
  { value: "B", es: "Negro", en: "Black" },
  { value: "R", es: "Rojo", en: "Red" },
  { value: "G", es: "Verde", en: "Green" },
  { value: "C", es: "Incoloro", en: "Colorless" },
  { value: "M", es: "Multicolor", en: "Multicolor" },
];

export function ColorMultiSelect({ value, onChange, language, className = "", heightClass = "h-12" }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const es = language === "es";
  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const label = value.length === 0 ? (es ? "Color: Todos" : "Color: All") : value.length === 1 ? `Color: ${value[0]}` : `Color: [${value.join(",")}]`;
  function toggle(choice: ColorChoice) { onChange(value.includes(choice) ? value.filter(v => v !== choice) : [...value, choice]); }
  return <div ref={root} className={`relative ${className}`}>
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className={`${heightClass} flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 text-left text-sm outline-none transition hover:border-primary/50 focus:border-primary`}>
      <span className="truncate">{label}</span><ChevronDown size={16} className={`shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`}/>
    </button>
    {open && <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-2xl">
      {OPTIONS.map(option => <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-secondary/60">
        <input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} className="h-4 w-4 accent-[hsl(var(--primary))]"/>
        <span className="w-5 font-mono font-bold text-primary">{option.value}</span><span>{es ? option.es : option.en}</span>
      </label>)}
      {value.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-1 w-full border-t border-border px-3 pt-2 text-left text-xs font-semibold text-muted-foreground hover:text-foreground">{es ? "Limpiar selección" : "Clear selection"}</button>}
    </div>}
  </div>;
}

export function matchesColorSelection(colors: string[] | null | undefined, selected: ColorChoice[]) {
  if (!selected.length) return true;
  const cardColors = colors ?? [];
  return selected.some(choice => {
    if (choice === "C") return cardColors.length === 0;
    if (choice === "M") return cardColors.length >= 2;
    return cardColors.length === 1 && cardColors[0] === choice;
  });
}
