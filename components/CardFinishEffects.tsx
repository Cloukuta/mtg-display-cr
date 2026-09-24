"use client";

import { useEffect } from "react";

function normalizeFinish(value: string) {
  const finish = value.trim().toLowerCase().replace(/[ _-]+/g, "");
  if (finish === "normal") return "nonfoil";
  return finish;
}

function finishFromCard(card: Element) {
  const explicit = card.getAttribute("data-card-finish");
  if (explicit) return normalizeFinish(explicit);

  const text = card.textContent || "";
  if (/surge[\s_-]*foil/i.test(text)) return "surgefoil";
  if (/etched[\s_-]*foil|\betched\b/i.test(text)) return "etched";
  if (/\bfoil\b/i.test(text) && !/non[\s_-]*foil/i.test(text)) return "foil";
  return "nonfoil";
}

function decorateFinishLabel(card: Element, finish: string) {
  card.querySelectorAll("span").forEach((span) => {
    const value = normalizeFinish(span.textContent || "");
    if (!["nonfoil", "foil", "surgefoil", "etched"].includes(value)) return;
    span.classList.remove("text-muted-foreground", "text-violet-400", "text-fuchsia-400", "text-purple-300", "font-semibold");
    span.classList.add("mtg-finish-label");
    if (value === "foil") span.classList.add("text-violet-400");
    else if (value === "surgefoil") span.classList.add("font-semibold", "text-fuchsia-400");
    else if (value === "etched") span.classList.add("text-purple-300");
    else span.classList.add("text-muted-foreground");
  });

  card.setAttribute("data-card-finish", finish);
}

/**
 * Adds the same optical finish treatment everywhere cards are rendered.
 * Public storefronts use <article>; home/global catalog cards are links, so
 * both renderers are supported. Explicit data-card-finish remains preferred,
 * while the text fallback keeps older card renderers compatible.
 */
export default function CardFinishEffects() {
  useEffect(() => {
    const decorate = () => {
      document.querySelectorAll("article, a").forEach((card) => {
        const image = card.querySelector("img");
        if (!(image instanceof HTMLImageElement)) return;

        const finish = finishFromCard(card);
        decorateFinishLabel(card, finish);

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
