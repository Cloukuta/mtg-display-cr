"use client";

import { useEffect } from "react";

function normalizeFinish(value: string) {
  return value.trim().toLowerCase().replace(/[ _-]+/g, "");
}

/**
 * Presentation-only enhancer for MTG card finishes.
 *
 * Preferred path: card artwork can expose `data-card-finish` directly.
 * Compatibility path: existing inventory/public-card articles are inspected
 * for their rendered finish until every card renderer has been migrated.
 *
 * The resolved finish is always written back as `data-card-finish` on the
 * artwork wrapper, making the visual state deterministic and easy to inspect.
 */
export default function CardFinishEffects() {
  useEffect(() => {
    const resolveFinish = (article: Element, wrapper: HTMLElement) => {
      const explicit =
        wrapper.dataset.cardFinish ||
        article.getAttribute("data-card-finish") ||
        "";

      if (explicit) return normalizeFinish(explicit);

      const text = (article.textContent || "").toLowerCase();
      if (/surge[\s_-]*foil/i.test(text)) return "surgefoil";
      if (/(?:^|[·\s])foil(?:$|[·\s])/i.test(text) && !/non[\s_-]*foil/i.test(text)) return "foil";
      return "nonfoil";
    };

    const decorate = () => {
      document.querySelectorAll("article").forEach((article) => {
        const image = article.querySelector("img");
        if (!(image instanceof HTMLImageElement)) return;

        const wrapper = image.parentElement;
        if (!(wrapper instanceof HTMLElement)) return;

        const finish = resolveFinish(article, wrapper);
        wrapper.dataset.cardFinish = finish;
        wrapper.classList.remove("mtg-finish-foil", "mtg-finish-surge");

        if (finish === "surgefoil") wrapper.classList.add("mtg-finish-surge");
        else if (finish === "foil") wrapper.classList.add("mtg-finish-foil");
      });
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
