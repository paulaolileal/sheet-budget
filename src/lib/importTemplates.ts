import { IMPORT_COLUMNS, type ImportKind } from "@/domain/importSchemas";

const EXAMPLE_ROWS: Record<ImportKind, string[]> = {
  categorias: ["Mercado", ""],
  contas: ["Nubank", "CARTAO", "#8A05BE", ""],
  receitas: ["2026-01", "Salário", "5000,00", ""],
  devedores: ["João Silva", "5511999999999"],
  transacoes: ["2026-01", "Supermercado", "Mercado", "350,90", "PENDENTE", "Nubank", "MANUAL"],
  dividas: ["2026-01", "Empréstimo pessoal", "200,00", "PENDENTE", "UNICO", "João Silva"],
};

/** Builds a downloadable CSV template (header + one example row) for the given entity. */
export function buildImportTemplate(kind: ImportKind): string {
  const columns = IMPORT_COLUMNS[kind];
  const example = EXAMPLE_ROWS[kind];
  return [columns.join(","), example.join(",")].join("\n");
}

export function downloadImportTemplate(kind: ImportKind): void {
  const csv = buildImportTemplate(kind);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `modelo-${kind}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
