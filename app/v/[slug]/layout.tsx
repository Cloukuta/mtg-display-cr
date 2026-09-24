"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Bridge Global Catalog / seller-comparison links into the existing public
 * display filters without exposing the Scryfall UUID in the search field.
 *
 * When a catalog link contains ?card=<scryfall_id>, keep the public display
 * behind a lightweight branded loading state until the existing controlled
 * filters have received the resolved card name + exact set. This prevents the
 * full seller inventory from flashing briefly before the selected card appears.
 */
export default function SellerDisplayLayout({ children }: { children: ReactNode }) {
  const [resolvingCatalogCard, setResolvingCatalogCard] = useState(false);

  useEffect(() => {
    const scryfallId = new URLSearchParams(window.location.search).get("card")?.trim();
    if (!scryfallId) return;

    setResolvingCatalogCard(true);
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const finish = () => {
      if (!cancelled) setResolvingCatalogCard(false);
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    void (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        finish();
        return;
      }

      const { data } = await supabase
        .from("cards")
        .select("scryfall_id,name,set_code,collector_number")
        .eq("scryfall_id", scryfallId)
        .maybeSingle();

      if (cancelled) return;
      if (!data) {
        finish();
        return;
      }

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

          // Give React one paint to commit both controlled filter updates before
          // revealing the display, so the unfiltered inventory never flashes.
          requestAnimationFrame(() => requestAnimationFrame(finish));
        } else if (attempts >= 40) {
          // Never trap the customer on the loading state if the filter UI cannot
          // be resolved for an unexpected reason.
          finish();
        }
      }, 100);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden={resolvingCatalogCard ? undefined : true}
        className={
          resolvingCatalogCard
            ? "fixed inset-0 z-[100] grid place-items-center bg-background"
            : "pointer-events-none fixed inset-0 z-[100] hidden"
        }
      >
        <div className="flex flex-col items-center gap-4">
          <img
            src="/favicon.svg"
            alt=""
            className="h-16 w-16 animate-spin sm:h-20 sm:w-20"
          />
          <div className="h-1 w-24 overflow-hidden rounded-full bg-border">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      </div>
      <div className={resolvingCatalogCard ? "invisible" : undefined}>{children}</div>
    </>
  );
}
