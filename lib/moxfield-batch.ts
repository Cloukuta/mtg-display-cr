import { normalizeFinish, type MoxfieldRow, type ResolvedCard } from "@/lib/moxfield";

const COLLECTION_SIZE = 75;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;

type ScryfallIdentifier = { id: string } | { set: string; collector_number: string };
type Lookup = { key: string; identifier: ScryfallIdentifier };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cardImage(card: Record<string, any>) {
  return card.image_uris?.normal || card.card_faces?.find((face: any) => face.image_uris?.normal)?.image_uris.normal || null;
}

function detectSpecialFinish(card: Record<string, any>, sourceFinish: string) {
  const promoTypes = Array.isArray(card.promo_types)
    ? card.promo_types.map((value: unknown) => String(value).trim().toLowerCase().replace(/[-_\s]/g, ""))
    : [];
  return promoTypes.includes("surgefoil") ? "surgefoil" : sourceFinish;
}

function lookupForRow(row: MoxfieldRow): Lookup | null {
  if (/^[0-9a-f-]{36}$/i.test(row.scryfallId)) {
    return { key: `id:${row.scryfallId.toLowerCase()}`, identifier: { id: row.scryfallId } };
  }
  if (row.setCode && row.collectorNumber) {
    const set = row.setCode.toLowerCase();
    const collector = row.collectorNumber.trim();
    return { key: `sc:${set}:${collector.toLowerCase()}`, identifier: { set, collector_number: collector } };
  }
  return null;
}

function resultKey(card: Record<string, any>) {
  return `sc:${String(card.set || "").toLowerCase()}:${String(card.collector_number || "").toLowerCase()}`;
}

async function fetchCollection(identifiers: ScryfallIdentifier[]) {
  let lastError = "request failed";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifiers }),
      });
      if (response.ok) return response.json();
      lastError = `Scryfall returned ${response.status}`;
      if (![408, 425, 429].includes(response.status) && response.status < 500) throw new Error(lastError);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Failed to fetch";
    }
    if (attempt < MAX_ATTEMPTS) await wait(RETRY_BASE_MS * 2 ** (attempt - 1));
  }
  throw new Error(`Scryfall temporarily unavailable after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

function resolvedRow(row: MoxfieldRow, result: Record<string, any>): ResolvedCard {
  const sourceFinish = row.finish;
  const detectedFinish = detectSpecialFinish(result, sourceFinish);
  const validFinishes = Array.isArray(result.finishes)
    ? Array.from(new Set(result.finishes.map((finish: string) => normalizeFinish(finish)))) as string[]
    : [];
  if (detectedFinish === "surgefoil" && !validFinishes.includes("surgefoil")) validFinishes.push("surgefoil");

  return {
    ...row,
    finish: detectedFinish,
    sourceFinish,
    finishDetectedBy: detectedFinish !== sourceFinish ? "scryfall" : "moxfield",
    status: "resolved",
    validFinishes,
    card: {
      scryfall_id: result.id,
      name: result.name,
      set_code: result.set,
      set_name: result.set_name,
      collector_number: result.collector_number,
      colors: result.colors || [],
      rarity: result.rarity,
      image_uri: cardImage(result),
    },
  };
}

export async function resolveBatchWithCollection(rows: MoxfieldRow[], onProgress?: (done: number) => void): Promise<ResolvedCard[]> {
  const output = new Map<number, ResolvedCard>();
  const unique = new Map<string, Lookup>();
  const rowsByKey = new Map<string, MoxfieldRow[]>();
  const fallbackRows: MoxfieldRow[] = [];

  for (const row of rows) {
    const lookup = lookupForRow(row);
    if (!lookup) {
      fallbackRows.push(row);
      continue;
    }
    unique.set(lookup.key, lookup);
    rowsByKey.set(lookup.key, [...(rowsByKey.get(lookup.key) || []), row]);
  }

  const lookups = Array.from(unique.values());
  let processedRows = 0;

  for (let index = 0; index < lookups.length; index += COLLECTION_SIZE) {
    const chunk = lookups.slice(index, index + COLLECTION_SIZE);
    try {
      const payload = await fetchCollection(chunk.map((entry) => entry.identifier));
      const found = new Map<string, Record<string, any>>();
      for (const card of payload.data || []) {
        found.set(`id:${String(card.id).toLowerCase()}`, card);
        found.set(resultKey(card), card);
      }

      const missing = new Set<string>();
      for (const identifier of payload.not_found || []) {
        if (identifier.id) missing.add(`id:${String(identifier.id).toLowerCase()}`);
        else if (identifier.set && identifier.collector_number) missing.add(`sc:${String(identifier.set).toLowerCase()}:${String(identifier.collector_number).toLowerCase()}`);
      }

      for (const lookup of chunk) {
        const card = found.get(lookup.key);
        const matchingRows = rowsByKey.get(lookup.key) || [];
        for (const row of matchingRows) {
          output.set(row.rowNumber, card
            ? resolvedRow(row, card)
            : { ...row, status: "unresolved", error: missing.has(lookup.key) ? "Printing not found" : "Scryfall did not return this printing." });
          processedRows += 1;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scryfall batch validation failed";
      for (const lookup of chunk) {
        for (const row of rowsByKey.get(lookup.key) || []) {
          output.set(row.rowNumber, { ...row, status: "unresolved", error: message });
          processedRows += 1;
        }
      }
    }
    onProgress?.(Math.min(processedRows, rows.length));
    if (index + COLLECTION_SIZE < lookups.length) await wait(150);
  }

  // Name-only rows are uncommon in Moxfield exports. Keep the existing exact-name resolver
  // as a fallback instead of weakening exact printing validation for rows that include IDs.
  if (fallbackRows.length) {
    const { resolveWithScryfall } = await import("@/lib/moxfield");
    for (const row of fallbackRows) {
      output.set(row.rowNumber, await resolveWithScryfall(row));
      processedRows += 1;
      onProgress?.(Math.min(processedRows, rows.length));
    }
  }

  return rows.map((row) => output.get(row.rowNumber) || { ...row, status: "unresolved", error: "Validation failed" });
}
