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

function value(record: Record<string, string>, candidates: readonly string[]) {
  const key = Object.keys(record).find((item) => candidates.includes(item.trim().toLowerCase()));
  return key ? String(record[key] ?? "").trim() : "";
}

export function parseMoxfieldCsv(file: File): Promise<MoxfieldRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete(result) {
        if (result.errors.length) return reject(new Error(result.errors[0].message));
        const rows = result.data.map((record, index) => {
          const rawFinish = value(record, aliases.finish).toLowerCase();
          return {
            rowNumber: index + 2,
            quantity: Math.max(1, Number.parseInt(value(record, aliases.quantity), 10) || 1),
            name: value(record, aliases.name),
            setCode: value(record, aliases.setCode).toLowerCase(),
            collectorNumber: value(record, aliases.collectorNumber),
            scryfallId: value(record, aliases.scryfallId),
            condition: value(record, aliases.condition) || "NM",
            language: value(record, aliases.language) || "en",
            finish: ["true", "yes", "foil", "1"].includes(rawFinish) ? "foil" : (rawFinish || "nonfoil"),
          };
        }).filter((row) => row.name || row.scryfallId || (row.setCode && row.collectorNumber));
        if (!rows.length) return reject(new Error("El archivo no contiene filas reconocibles de Moxfield."));
        resolve(rows);
      },
      error(error) { reject(error); },
    });
  });
}

function cardImage(card: Record<string, any>) {
  return card.image_uris?.normal || card.card_faces?.find((face: any) => face.image_uris?.normal)?.image_uris.normal || null;
}

export async function resolveWithScryfall(row: MoxfieldRow): Promise<ResolvedCard> {
  let url = "";
  if (/^[0-9a-f-]{36}$/i.test(row.scryfallId)) url = `https://api.scryfall.com/cards/${row.scryfallId}`;
  else if (row.setCode && row.collectorNumber) url = `https://api.scryfall.com/cards/${encodeURIComponent(row.setCode)}/${encodeURIComponent(row.collectorNumber)}`;
  else if (row.name) url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(row.name)}${row.setCode ? `&set=${encodeURIComponent(row.setCode)}` : ""}`;
  if (!url) return { ...row, status: "unresolved", error: "Faltan nombre o datos de impresión." };
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status === 404 ? "Impresión no encontrada" : `Scryfall respondió ${response.status}`);
    const result = await response.json();
    return { ...row, status: "resolved", card: { scryfall_id: result.id, name: result.name, set_code: result.set, set_name: result.set_name, collector_number: result.collector_number, colors: result.colors || [], rarity: result.rarity, image_uri: cardImage(result) } };
  } catch (error) {
    return { ...row, status: "unresolved", error: error instanceof Error ? error.message : "No se pudo validar" };
  }
}

export async function resolveBatch(rows: MoxfieldRow[], onProgress?: (done: number) => void) {
  const output: ResolvedCard[] = [];
  for (let index = 0; index < rows.length; index += 10) {
    const batch = await Promise.all(rows.slice(index, index + 10).map(resolveWithScryfall));
    output.push(...batch);
    onProgress?.(Math.min(index + batch.length, rows.length));
    if (index + 10 < rows.length) await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return output;
}

