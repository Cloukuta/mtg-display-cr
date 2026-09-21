import Papa from "papaparse";

export type MoxfieldRow = {
  rowNumber: number;
  quantity: number;
  name: string;
  setCode: string;
  collectorNumber: string;
  scryfallId: string;
  condition: string;
  language: string;
  finish: string;
};

export type ResolvedCard = MoxfieldRow & {
  status: "resolved" | "unresolved";
  error?: string;
  validFinishes?: string[];
  sourceFinish?: string;
  finishDetectedBy?: "moxfield" | "scryfall";
  card?: {
    scryfall_id: string;
    name: string;
    set_code: string;
    set_name: string;
    collector_number: string;
    colors: string[];
    rarity: string;
    image_uri: string | null;
  };
};

const aliases = {
  quantity: ["quantity", "qty", "count"],
  name: ["name", "card name", "card"],
  setCode: ["edition", "set", "set code", "setcode"],
  collectorNumber: ["collector number", "collector #", "collector", "number"],
  scryfallId: ["scryfall id", "scryfall_id"],
  condition: ["condition"],
  language: ["language", "lang"],
  finish: ["finish", "foil"],
} as const;

const SCRYFALL_BATCH_SIZE = 5;
const SCRYFALL_BATCH_DELAY_MS = 250;
const SCRYFALL_MAX_ATTEMPTS = 3;
const SCRYFALL_RETRY_BASE_MS = 400;

function value(record: Record<string, string>, candidates: readonly string[]) {
  const key = Object.keys(record).find((item) => candidates.includes(item.trim().toLowerCase()));
  return key ? String(record[key] ?? "").trim() : "";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeCondition(condition: string) {
  const normalized = condition.trim().toLowerCase();
  const conditions: Record<string, string> = {
    "near mint": "NM", nm: "NM",
    excellent: "EX", ex: "EX", "lightly played": "EX", lp: "EX",
    "very good": "VG", vg: "VG", "moderately played": "VG", mp: "VG", played: "VG", pl: "VG",
    good: "G", g: "G", "heavily played": "G", hp: "G", poor: "G", po: "G", damaged: "G", dmg: "G",
  };
  return conditions[normalized] ?? "NM";
}

function normalizeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  const languages: Record<string, string> = {
    english: "en", en: "en", spanish: "es", español: "es", espanol: "es", es: "es",
    french: "fr", français: "fr", francais: "fr", fr: "fr", german: "de", deutsch: "de", de: "de",
    italian: "it", italiano: "it", it: "it", portuguese: "pt", português: "pt", portugues: "pt", pt: "pt",
    japanese: "ja", ja: "ja", jp: "ja", korean: "ko", ko: "ko", russian: "ru", ru: "ru",
    chinese: "zhs", "simplified chinese": "zhs", zhs: "zhs", "traditional chinese": "zht", zht: "zht",
    phyrexian: "ph", ph: "ph",
  };
  return languages[normalized] ?? (normalized || "en");
}

export function normalizeFinish(finish: string) {
  const normalized = finish.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
  if (["true", "yes", "foil", "1"].includes(normalized)) return "foil";
  if (["etched", "etched foil"].includes(normalized)) return "etched";
  if (["surgefoil", "surge foil"].includes(normalized)) return "surgefoil";
  if (["nonfoil", "non foil", "normal", "false", "no", "0", ""].includes(normalized)) return "nonfoil";
  return normalized.replace(/\s/g, "") || "nonfoil";
}

export function parseMoxfieldCsv(file: File): Promise<MoxfieldRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim(),
      complete(result) {
        if (result.errors.length) return reject(new Error(result.errors[0].message));
        const rows = result.data.map((record, index) => ({
          rowNumber: index + 2,
          quantity: Math.max(1, Number.parseInt(value(record, aliases.quantity), 10) || 1),
          name: value(record, aliases.name), setCode: value(record, aliases.setCode).toLowerCase(),
          collectorNumber: value(record, aliases.collectorNumber), scryfallId: value(record, aliases.scryfallId),
          condition: normalizeCondition(value(record, aliases.condition)), language: normalizeLanguage(value(record, aliases.language)),
          finish: normalizeFinish(value(record, aliases.finish)),
        })).filter((row) => row.name || row.scryfallId || (row.setCode && row.collectorNumber));
        if (!rows.length) return reject(new Error("The file does not contain recognizable Moxfield rows."));
        resolve(rows);
      },
      error(error) { reject(error); },
    });
  });
}

function cardImage(card: Record<string, any>) {
  return card.image_uris?.normal || card.card_faces?.find((face: any) => face.image_uris?.normal)?.image_uris.normal || null;
}

function detectSpecialFinish(card: Record<string, any>, sourceFinish: string) {
  const promoTypes = Array.isArray(card.promo_types)
    ? card.promo_types.map((value: unknown) => String(value).trim().toLowerCase().replace(/[-_\s]/g, ""))
    : [];
  if (promoTypes.includes("surgefoil")) return "surgefoil";
  return sourceFinish;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchScryfallWithRetry(url: string) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= SCRYFALL_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json;q=0.9,*/*;q=0.8" } });
      if (response.ok) return response;
      if (response.status === 404) throw new Error("Printing not found");
      if (!isRetryableStatus(response.status)) throw new Error(`Scryfall returned ${response.status}`);
      lastError = new Error(`Scryfall returned ${response.status}`);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Scryfall request failed");
      if (normalized.message === "Printing not found" || normalized.message.startsWith("Scryfall returned 4")) throw normalized;
      lastError = normalized;
    }

    if (attempt < SCRYFALL_MAX_ATTEMPTS) await wait(SCRYFALL_RETRY_BASE_MS * 2 ** (attempt - 1));
  }

  throw new Error(`Scryfall temporarily unavailable after ${SCRYFALL_MAX_ATTEMPTS} attempts: ${lastError?.message || "request failed"}`);
}

export async function resolveWithScryfall(row: MoxfieldRow): Promise<ResolvedCard> {
  let url = "";
  if (/^[0-9a-f-]{36}$/i.test(row.scryfallId)) url = `https://api.scryfall.com/cards/${row.scryfallId}`;
  else if (row.setCode && row.collectorNumber) url = `https://api.scryfall.com/cards/${encodeURIComponent(row.setCode)}/${encodeURIComponent(row.collectorNumber)}`;
  else if (row.name) url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(row.name)}${row.setCode ? `&set=${encodeURIComponent(row.setCode)}` : ""}`;
  if (!url) return { ...row, status: "unresolved", error: "Card name or printing details are missing." };

  try {
    const response = await fetchScryfallWithRetry(url);
    const result = await response.json();
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
        scryfall_id: result.id, name: result.name, set_code: result.set, set_name: result.set_name,
        collector_number: result.collector_number, colors: result.colors || [], rarity: result.rarity,
        image_uri: cardImage(result),
      },
    };
  } catch (error) {
    return { ...row, status: "unresolved", error: error instanceof Error ? error.message : "Validation failed" };
  }
}

export async function resolveBatch(rows: MoxfieldRow[], onProgress?: (done: number) => void) {
  const output: ResolvedCard[] = [];
  for (let index = 0; index < rows.length; index += SCRYFALL_BATCH_SIZE) {
    const batch = await Promise.all(rows.slice(index, index + SCRYFALL_BATCH_SIZE).map(resolveWithScryfall));
    output.push(...batch);
    onProgress?.(Math.min(index + batch.length, rows.length));
    if (index + SCRYFALL_BATCH_SIZE < rows.length) await wait(SCRYFALL_BATCH_DELAY_MS);
  }
  return output;
}
