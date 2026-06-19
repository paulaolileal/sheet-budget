import { z } from "zod";
import { ACCOUNT_TIPO, TIPO_LANCAMENTO, TRANSACTION_STATUS } from "./types";

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
});

export const templateInputSchema = templateSchema.omit({ template_id: true });

export const accountSchema = z.object({
  account_id: z.string().min(1),
  nome: safeString(80),
  tipo: z.enum(ACCOUNT_TIPO),
  icon_id: z.string().optional(),
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

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
export type TemplateFormInput = z.infer<typeof templateInputSchema>;
export type AccountInput = z.infer<typeof accountInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type IncomeInput = z.infer<typeof incomeInputSchema>;
export type InvoiceAmountInput = z.infer<typeof invoiceAmountInputSchema>;
