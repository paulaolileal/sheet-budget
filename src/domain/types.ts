/**
 * Tipos de domínio. Não dependem de UI nem de infraestrutura.
 */

export type Competencia = string; // formato YYYY-MM

export const TRANSACTION_STATUS = ["PENDENTE", "PAGO", "ADIANTADO", "IGNORADO"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUS)[number];

export const TIPO_LANCAMENTO = ["RECORRENTE", "PARCELADO", "MANUAL"] as const;
export type TipoLancamento = (typeof TIPO_LANCAMENTO)[number];

export const ACCOUNT_TIPO = ["CONTA", "CARTAO", "CARTEIRA"] as const;
export type AccountTipo = (typeof ACCOUNT_TIPO)[number];

export const RECURRENCE_TYPE = ["M", "A"] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPE)[number];

export interface Transaction {
  transaction_id: string;
  template_id: string | null;
  competencia: Competencia;
  descricao: string;
  categoria_id: string;
  valor: number;
  status: TransactionStatus;
  payment_account_id: string | null;
  tipo_lancamento: TipoLancamento;
}

export interface RecurrenceTemplate {
  template_id: string;
  nome: string;
  categoria_id: string;
  payment_account_id: string | null;
  primeira_competencia: Competencia;
  /** Inclusive end month. Absent means the recurrence runs indefinitely. */
  ultima_competencia?: Competencia;
  logo_url?: string;
  icon_id?: string;
  /** M = monthly (every month); A = annual (only in the month of primeira_competencia). */
  recurrence_type: RecurrenceType;
}

/** Derives active status from date range instead of a stored boolean. */
export function isTemplateActive(tpl: RecurrenceTemplate, competencia: Competencia): boolean {
  return (
    tpl.primeira_competencia <= competencia &&
    (!tpl.ultima_competencia || tpl.ultima_competencia >= competencia)
  );
}

export interface Category {
  category_id: string;
  nome: string;
  icon_id?: string;
}

export interface Account {
  account_id: string;
  nome: string;
  tipo: AccountTipo;
  icon_id?: string;
  color?: string;
}

export interface Income {
  income_id: string;
  competencia: Competencia;
  descricao: string;
  valor: number;
  icon_id?: string;
}

export interface InvoiceAmount {
  invoice_id: string;
  payment_account_id: string;
  competencia: Competencia;
  valor_real: number;
}
