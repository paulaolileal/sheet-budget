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
    .transform((v) => v.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, ""));

export const transactionSchema = z.object({
  transaction_id: z.string().min(1),
  template_id: z.string().nullable(),
  competencia: competenciaSchema,
  descricao: safeString(200),
  categoria_id: z.string().min(1),
  valor_previsto: z.number().nonnegative(),
  valor_final: z.number().nonnegative().nullable(),
  status: z.enum(TRANSACTION_STATUS),
  considerar_resumo: z.boolean(),
  payment_account_id: z.string().nullable(),
  tipo_lancamento: z.enum(TIPO_LANCAMENTO),
});

export const transactionInputSchema = transactionSchema
  .extend({
    transaction_id: z.string().min(1).optional(),
  })
  .refine((t) => t.status !== "PAGO" || (t.valor_final != null && t.valor_final >= 0), {
    message: "valor_final é obrigatório quando status = PAGO",
    path: ["valor_final"],
  });

export const templateSchema = z.object({
  template_id: z.string().min(1),
  nome: safeString(120),
  categoria_id: z.string().min(1),
  payment_account_id: z.string().nullable(),
  considerar_resumo: z.boolean(),
  ativo: z.boolean(),
  primeira_competencia: competenciaSchema,
  ultima_competencia: competenciaSchema.optional(),
  valor_padrao: z.number().nonnegative().optional(),
});

export const accountSchema = z.object({
  account_id: z.string().min(1),
  nome: safeString(80),
  tipo: z.enum(ACCOUNT_TIPO),
});

export const categorySchema = z.object({
  category_id: z.string().min(1),
  nome: safeString(120),
});

export const accountInputSchema = z.object({
  nome: safeString(80),
  tipo: z.enum(ACCOUNT_TIPO),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
export type AccountInput = z.infer<typeof accountInputSchema>;
