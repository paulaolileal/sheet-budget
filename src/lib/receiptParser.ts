import { parseCurrency } from "./currency";

/**
 * Fields recovered from a Nubank transfer receipt screenshot ("Comprovante de
 * transferência"). Any field the regexes below fail to locate is left
 * `undefined` — the caller (`ShareTargetPage`) opens the transaction dialog
 * pre-filled with whatever was found and lets the user complete the rest.
 */
export interface ParsedReceipt {
  valor?: number;
  descricao?: string;
  competencia?: string; // YYYY-MM
}

const MONTHS_PT: Record<string, string> = {
  JAN: "01",
  FEV: "02",
  MAR: "03",
  ABR: "04",
  MAI: "05",
  JUN: "06",
  JUL: "07",
  AGO: "08",
  SET: "09",
  OUT: "10",
  NOV: "11",
  DEZ: "12",
};

/** First "R$ 1.234,56"-style amount in the OCR text — the receipt shows exactly one, next to "Valor". */
function extractValor(text: string): number | undefined {
  const match = text.match(/R\$\s*([\d.,]+)/);
  if (!match) return undefined;
  const valor = parseCurrency(match[1]);
  return valor > 0 ? valor : undefined;
}

/** The non-empty line right after the "Descrição" label. */
function extractDescricao(text: string): string | undefined {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const labelIndex = lines.findIndex((l) => /^descri[cç][aã]o$/i.test(l));
  if (labelIndex === -1 || labelIndex + 1 >= lines.length) return undefined;
  return lines[labelIndex + 1];
}

/** Header date "30 JUL 2026" → competência "2026-07". */
function extractCompetencia(text: string): string | undefined {
  const match = text.match(/\b(\d{1,2})\s+([A-Za-zÇç]{3})\s+(\d{4})\b/);
  if (!match) return undefined;
  const month = MONTHS_PT[match[2].toUpperCase()];
  if (!month) return undefined;
  return `${match[3]}-${month}`;
}

export function parseNubankReceipt(ocrText: string): ParsedReceipt {
  return {
    valor: extractValor(ocrText),
    descricao: extractDescricao(ocrText),
    competencia: extractCompetencia(ocrText),
  };
}
