import type { Transaction, TipoLancamento } from "@/domain/types";

/** Strips a trailing " (X/Y)" installment suffix from a transaction description. */
export function stripParcela(descricao: string): string {
  return descricao.replace(/\s*\(\d+\/\d+\)$/, "");
}

/** Extracts the "(X/Y)" installment suffix embedded in a description, when present. */
export function parseParcela(descricao: string, tipo: TipoLancamento): string | null {
  if (tipo !== "PARCELADO") return null;
  const m = descricao.match(/\((\d+\/\d+)\)$/);
  return m ? m[1] : null;
}

export interface InstallmentGroup {
  key: string;
  /** Sorted chronologically by competencia (oldest installment first). */
  transactions: Transaction[];
}

/**
 * Groups PARCELADO transactions into installment purchases — same `template_id`, or same
 * stripped description when there's no template (e.g. imported data) — each sorted
 * chronologically so index 0 is the first installment and the last entry is the final one.
 */
export function groupInstallments(txs: Transaction[]): InstallmentGroup[] {
  const parcelados = txs.filter((t) => t.tipo_lancamento === "PARCELADO");
  const map = new Map<string, Transaction[]>();
  for (const tx of parcelados) {
    const key = tx.template_id ?? stripParcela(tx.descricao);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  const groups: InstallmentGroup[] = [];
  for (const [key, list] of map) {
    list.sort((a, b) => a.competencia.localeCompare(b.competencia));
    groups.push({ key, transactions: list });
  }
  return groups;
}

export function isLastParcela(parcela: string | null): boolean {
  if (!parcela) return false;
  const [a, b] = parcela.split("/");
  return a === b;
}
