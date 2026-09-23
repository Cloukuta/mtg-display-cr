"use client";

import { useEffect, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Bridge Global Catalog / seller-comparison links into the existing public
 * display filters without exposing the Scryfall UUID in the search field.
 *
 * The catalog passes ?card=<scryfall_id>. We resolve that stable printing ID
 * to its human-readable name + set, then drive the existing controlled search
 * and set inputs. The public display remains the single source of truth for
 * inventory/cart behavior.
 */
export default function SellerDisplayLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const scryfallId = new URLSearchParams(window.location.search).get("card")?.trim();
    if (!scryfallId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      const supabase = getSupabase();
      if (!supabase) return;

      const { data } = await supabase
        .from("cards")
        .select("scryfall_id,name,set_code,collector_number")
        .eq("scryfall_id", scryfallId)
        .maybeSingle();

      if (cancelled || !data) return;

      let attempts = 0;
      timer = setInterval(() => {
        attempts += 1;

        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder="Search by name or set…"], input[placeholder="Buscar por nombre o set…"]',
        );
        const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"));
        const setSelect = selects.find((select) =>
          Array.from(select.options).some(
            (option) => option.value.toLowerCase() === String(data.set_code).toLowerCase(),
          ),
        );

        if (searchInput && setSelect) {
          const inputSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set;
          const selectSetter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            "value",
          )?.set;

          inputSetter?.call(searchInput, data.name);
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          searchInput.dispatchEvent(new Event("change", { bubbles: true }));

          selectSetter?.call(setSelect, String(data.set_code).toLowerCase());
          setSelect.dispatchEvent(new Event("change", { bubbles: true }));

          if (timer) clearInterval(timer);
        } else if (attempts >= 40 && timer) {
          clearInterval(timer);
        }
      }, 100);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return children;
}
