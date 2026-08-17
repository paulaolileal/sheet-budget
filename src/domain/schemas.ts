import { z } from "zod";
import {
  ACCOUNT_TIPO,
  AMORTIZATION_METHOD,
  DEBT_STATUS,
  DEBT_TIPO,
  PURCHASE_PLAN_STATUS,
  RATE_PERIODICITY,
  RECURRENCE_TYPE,
  TIPO_LANCAMENTO,
  TRANSACTION_STATUS,
} from "./types";

const competenciaRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const competenciaSchema = z
  .string()
  .regex(competenciaRegex, "Competência deve seguir o formato YYYY-MM");

/** Sanitiza string removendo tags HTML e caracteres de controle. */
const safeString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => {
      const noTags = v.replace(/<[^>]*>/g, "");
      return [...noTags].filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127).join("");
    });

export const transactionSchema = z.object({
  transaction_id: z.string().min(1),
  template_id: z.string().nullable(),
  competencia: competenciaSchema,
  descricao: safeString(200),
  categoria_id: z.string().min(1),
  valor: z.number().nonnegative(),
  status: z.enum(TRANSACTION_STATUS),
  payment_account_id: z.string().nullable(),
  tipo_lancamento: z.enum(TIPO_LANCAMENTO),
  plan_id: z.string().nullable().default(null),
});

export const transactionInputSchema = transactionSchema.extend({
  transaction_id: z.string().min(1).optional(),
});

export const templateSchema = z.object({
  template_id: z.string().min(1),
  nome: safeString(120),
  categoria_id: z.string().min(1),
  payment_account_id: z.string().nullable(),
  primeira_competencia: competenciaSchema,
  ultima_competencia: competenciaSchema.optional(),
  logo_url: z.string().optional(),
  icon_id: z.string().optional(),
  recurrence_type: z.enum(RECURRENCE_TYPE),
});

export const templateInputSchema = templateSchema.omit({ template_id: true });

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
  .optional();

export const accountSchema = z.object({
  account_id: z.string().min(1),
  nome: safeString(80),
  tipo: z.enum(ACCOUNT_TIPO),
  icon_id: z.string().optional(),
  color: hexColorSchema,
});

export const categorySchema = z.object({
  category_id: z.string().min(1),
  nome: safeString(120),
  icon_id: z.string().optional(),
});

export const accountInputSchema = z.object({
  nome: safeString(80),
  tipo: z.enum(ACCOUNT_TIPO),
  icon_id: z.string().optional(),
  color: hexColorSchema,
});

export const categoryInputSchema = z.object({
  nome: safeString(120),
  icon_id: z.string().optional(),
});

export const incomeSchema = z.object({
  income_id: z.string().min(1),
  competencia: competenciaSchema,
  descricao: safeString(200),
  valor: z.number().positive(),
  icon_id: z.string().optional(),
});

export const incomeInputSchema = incomeSchema.omit({ income_id: true });

export const invoiceAmountSchema = z.object({
  invoice_id: z.string().min(1),
  payment_account_id: z.string().min(1),
  competencia: competenciaSchema,
  valor_real: z.number().nonnegative(),
});

export const invoiceAmountInputSchema = invoiceAmountSchema.omit({ invoice_id: true });

export const debtorSchema = z.object({
  debtor_id: z.string().min(1),
  nome: safeString(80),
  telefone: safeString(20).optional(),
  icon_id: z.string().optional(),
});

export const debtorInputSchema = debtorSchema.omit({ debtor_id: true });

const debtBaseSchema = z.object({
  debt_id: z.string().min(1),
  debtor_id: z.string().min(1),
  competencia: competenciaSchema,
  descricao: safeString(120),
  // "EMPRESTIMO" rows store a running balance snapshot, which reaches 0 once settled.
  valor: z.number().nonnegative(),
  status: z.enum(DEBT_STATUS),
  tipo: z.enum(DEBT_TIPO),
  parent_debt_id: z.string().optional(),
});

const requirePositiveValorUnlessLoan = (d: { tipo: (typeof DEBT_TIPO)[number]; valor: number }) =>
  d.tipo === "EMPRESTIMO" || d.valor > 0;

export const debtSchema = debtBaseSchema.refine(requirePositiveValorUnlessLoan, {
  message: "Valor deve ser maior que zero.",
  path: ["valor"],
});

export const debtInputSchema = debtBaseSchema
  .omit({ debt_id: true })
  .refine(requirePositiveValorUnlessLoan, {
    message: "Valor deve ser maior que zero.",
    path: ["valor"],
  });

export const purchasePlanSchema = z.object({
  plan_id: z.string().min(1),
  nome: safeString(120),
  descricao: safeString(500).optional(),
  valor_compra: z.number().positive(),
  taxa_juros: z.number().nonnegative(),
  taxa_juros_periodicidade: z.enum(RATE_PERIODICITY),
  numero_parcelas: z.number().int().min(1).max(120),
  forma_amortizacao: z.enum(AMORTIZATION_METHOD),
  competencia_inicio: competenciaSchema,
  margem_minima: z.number().nonnegative(),
  categoria_id: z.string().optional(),
  payment_account_id: z.string().optional(),
  status: z.enum(PURCHASE_PLAN_STATUS),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export const purchasePlanInputSchema = purchasePlanSchema.omit({
  plan_id: true,
  created_at: true,
  updated_at: true,
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
export type TemplateFormInput = z.infer<typeof templateInputSchema>;
export type AccountInput = z.infer<typeof accountInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type IncomeInput = z.infer<typeof incomeInputSchema>;
export type InvoiceAmountInput = z.infer<typeof invoiceAmountInputSchema>;
export type DebtorInput = z.infer<typeof debtorInputSchema>;
export type DebtInput = z.infer<typeof debtInputSchema>;
export type PurchasePlanInput = z.infer<typeof purchasePlanInputSchema>;
