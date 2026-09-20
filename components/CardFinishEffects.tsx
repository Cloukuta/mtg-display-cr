"use client";

import { useEffect } from "react";

/**
 * Progressive visual enhancement for inventory/card images.
 * Reads the already-rendered finish metadata from each card article, so it
 * does not change inventory data, pricing, routing, or image URLs.
 */
export default function CardFinishEffects() {
  useEffect(() => {
    const decorate = () => {
      document.querySelectorAll("article").forEach((article) => {
        const image = article.querySelector("img");
        if (!(image instanceof HTMLImageElement)) return;

        const text = (article.textContent || "").toLowerCase();
        const parent = image.parentElement;
        if (!parent) return;

        parent.classList.remove("mtg-finish-foil", "mtg-finish-surge");

        const surge = /(?:surge[\s_-]*foil)/i.test(text);
        const foil = !surge && /(?:^|[·\s])foil(?:$|[·\s])/i.test(text) && !/(?:non[\s_-]*foil)/i.test(text);

        if (surge) parent.classList.add("mtg-finish-surge");
        else if (foil) parent.classList.add("mtg-finish-foil");
      });
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
