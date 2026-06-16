import Papa from "papaparse";

/** Converte "20,9" ou "1.234,56" para 20.9 / 1234.56 */
export function parseBRNumber(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = v.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseBool(v: string | boolean | null | undefined): boolean {
  if (typeof v === "boolean") return v;
  return String(v ?? "").trim().toUpperCase() === "TRUE";
}

export function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function loadCsv<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url}`);
  const text = await res.text();
  const parsed = Papa.parse<T>(text, { header: true, skipEmptyLines: true });
  return parsed.data as T[];
}
