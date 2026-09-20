"use client";

import { useEffect } from "react";

function normalizeFinish(value: string) {
  return value.trim().toLowerCase().replace(/[ _-]+/g, "");
}

function finishFromArticle(article: Element) {
  const explicit = article.getAttribute("data-card-finish");
  if (explicit) return normalizeFinish(explicit);

  const text = article.textContent || "";
  if (/surge[\s_-]*foil/i.test(text)) return "surgefoil";
  if (/\bfoil\b/i.test(text) && !/non[\s_-]*foil/i.test(text)) return "foil";
  return "nonfoil";
}

/**
 * Adds a dedicated optical layer directly over card artwork.
 *
 * This deliberately does not rely on pseudo-elements attached to whatever
 * layout wrapper happens to contain the image. The overlay is inserted next
 * to the artwork and sized from the image itself, so the effect survives the
 * different Binder and storefront layouts.
 *
 * Renderers can opt into the preferred deterministic path by writing
 * `data-card-finish` on the article. The text fallback remains only for older
 * renderers while they are migrated.
 */
export default function CardFinishEffects() {
  useEffect(() => {
    const decorate = () => {
      document.querySelectorAll("article").forEach((article) => {
        const finish = finishFromArticle(article);
        article.setAttribute("data-card-finish", finish);

        const image = article.querySelector("img");
        if (!(image instanceof HTMLImageElement)) return;

        const host = image.parentElement;
        if (!(host instanceof HTMLElement)) return;

        host.style.position = "relative";
        host.style.overflow = "hidden";
        host.dataset.cardFinish = finish;

        let overlay = host.querySelector(":scope > .mtg-card-finish-overlay");
        if (!(overlay instanceof HTMLElement)) {
          overlay = document.createElement("span");
          overlay.className = "mtg-card-finish-overlay";
          overlay.setAttribute("aria-hidden", "true");
          host.appendChild(overlay);
        }

        overlay.className = "mtg-card-finish-overlay";
        if (finish === "foil") overlay.classList.add("is-foil");
        if (finish === "surgefoil") overlay.classList.add("is-surgefoil");
        overlay.hidden = finish !== "foil" && finish !== "surgefoil";
      });
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(decorate);
    };

    decorate();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
