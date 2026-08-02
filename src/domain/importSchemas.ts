import { z } from "zod";
import { ACCOUNT_TIPO, DEBT_STATUS, DEBT_TIPO, TIPO_LANCAMENTO, TRANSACTION_STATUS } from "./types";
import { competenciaSchema } from "./schemas";
import { parseCurrency } from "@/lib/currency";

/** CSV rows arrive as plain strings; trim before any further parsing. */
const csvString = z.string().transform((v) => v.trim());

const requiredCsvString = csvString.refine((v) => v.length > 0, "Campo obrigatório");

const csvValor = csvString
  .refine((v) => v.length > 0, "Campo obrigatório")
  .transform((v) => parseCurrency(v))
  .refine((v) => v > 0, "Valor deve ser maior que zero");

/** Matches an enum value case-insensitively, falling back to a default when blank. */
function csvEnum<T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return csvString.transform((v, ctx) => {
    if (!v) return fallback;
    const match = values.find((val) => val.toLowerCase() === v.toLowerCase());
    if (!match) {
      ctx.addIssue({
        code: "custom",
        message: `Valor inválido: "${v}". Esperado um de: ${values.join(", ")}`,
      });
      return z.NEVER;
    }
    return match as T[number];
  });
}

export const categoryImportRowSchema = z.object({
  nome: requiredCsvString,
  icone: csvString.optional().transform((v) => v || undefined),
});

export const accountImportRowSchema = z.object({
  nome: requiredCsvString,
  tipo: csvEnum(ACCOUNT_TIPO, "CONTA"),
  cor: csvString
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => !v || /^#[0-9a-fA-F]{6}$/.test(v), "Cor inválida, use #RRGGBB"),
  icone: csvString.optional().transform((v) => v || undefined),
});

export const incomeImportRowSchema = z.object({
  competencia: csvString.pipe(competenciaSchema),
  descricao: requiredCsvString,
  valor: csvValor,
  icone: csvString.optional().transform((v) => v || undefined),
});

export const debtorImportRowSchema = z.object({
  nome: requiredCsvString,
  telefone: csvString.optional().transform((v) => v || undefined),
});

export const transactionImportRowSchema = z.object({
  competencia: csvString.pipe(competenciaSchema),
  descricao: requiredCsvString,
  categoria: requiredCsvString,
  valor: csvValor,
  status: csvEnum(TRANSACTION_STATUS, "PENDENTE"),
  conta: csvString.optional().transform((v) => v || undefined),
  tipo_lancamento: csvEnum(TIPO_LANCAMENTO, "MANUAL"),
});

export const debtImportRowSchema = z.object({
  competencia: csvString.pipe(competenciaSchema),
  descricao: requiredCsvString,
  valor: csvValor,
  status: csvEnum(DEBT_STATUS, "PENDENTE"),
  tipo: csvEnum(DEBT_TIPO, "UNICO"),
  devedor: requiredCsvString,
});

export type CategoryImportRow = z.infer<typeof categoryImportRowSchema>;
export type AccountImportRow = z.infer<typeof accountImportRowSchema>;
export type IncomeImportRow = z.infer<typeof incomeImportRowSchema>;
export type DebtorImportRow = z.infer<typeof debtorImportRowSchema>;
export type TransactionImportRow = z.infer<typeof transactionImportRowSchema>;
export type DebtImportRow = z.infer<typeof debtImportRowSchema>;

export const IMPORT_KINDS = [
  "categorias",
  "contas",
  "receitas",
  "devedores",
  "transacoes",
  "dividas",
] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  categorias: "Categorias",
  contas: "Contas",
  receitas: "Receitas",
  devedores: "Devedores",
  transacoes: "Transações",
  dividas: "Dívidas",
};

export const IMPORT_ROW_SCHEMAS = {
  categorias: categoryImportRowSchema,
  contas: accountImportRowSchema,
  receitas: incomeImportRowSchema,
  devedores: debtorImportRowSchema,
  transacoes: transactionImportRowSchema,
  dividas: debtImportRowSchema,
} as const;

export const IMPORT_COLUMNS: Record<ImportKind, string[]> = {
  categorias: ["nome", "icone"],
  contas: ["nome", "tipo", "cor", "icone"],
  receitas: ["competencia", "descricao", "valor", "icone"],
  devedores: ["nome", "telefone"],
  transacoes: [
    "competencia",
    "descricao",
    "categoria",
    "valor",
    "status",
    "conta",
    "tipo_lancamento",
  ],
  dividas: ["competencia", "descricao", "valor", "status", "tipo", "devedor"],
};
