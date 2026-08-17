/**
 * Business rules for the purchase-planning feature: projecting the user's monthly free
 * balance, and cross-referencing it against an amortization schedule to decide whether
 * a planned purchase fits the budget and when the best competencia to start it is.
 *
 * Builds on the pure math in `src/lib/amortization.ts`; this file is the layer that
 * knows about domain types (Transaction, Income, PurchasePlan, ...).
 */
import { shiftCompetencia, currentCompetencia } from "@/utils/format";
import {
  buildAmortizationTable,
  toMonthlyRate,
  type AmortizationInstallment,
  type AmortizationMethodInput,
} from "@/lib/amortization";
import type {
  Account,
  Competencia,
  Income,
  InvoiceAmount,
  PurchasePlan,
  Transaction,
} from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface MonthlyBalanceProjection {
  competencia: Competencia;
  receitas: number;
  despesas: number;
  saldoLivre: number;
  /** True when receitas for this month were estimated (no income lançada yet), not lançadas. */
  isProjected: boolean;
}

/**
 * Projects free monthly balance (receitas - despesas) across `months`. Extracted from
 * `DashboardPage`'s `trendData`: months without a lançada income project the last known
 * income value; despesas sum lançamentos (PAGO/PENDENTE) plus `extraFatura` (the gap
 * between a card's real invoice total in `invoice_amounts` and the transactions lançadas
 * for it that month). Keep this in sync with `trendData` if that logic ever changes.
 */
export function projectMonthlyBalance(
  txs: Transaction[],
  incomes: Income[],
  invoiceAmounts: InvoiceAmount[],
  accounts: Account[],
  months: Competencia[],
): MonthlyBalanceProjection[] {
  const todayMonth = currentCompetencia();
  const cardIds = new Set(accounts.filter((a) => a.tipo === "CARTAO").map((a) => a.account_id));

  const lastIncomeMonth = [...new Set(incomes.map((i) => i.competencia))]
    .filter((m) => m <= todayMonth)
    .sort()
    .at(-1);
  const lastIncomeValue = lastIncomeMonth
    ? round2(
        incomes.filter((i) => i.competencia === lastIncomeMonth).reduce((s, i) => s + i.valor, 0),
      )
    : 0;

  return months.map((month) => {
    const monthTxs = txs.filter(
      (t) => t.competencia === month && (t.status === "PAGO" || t.status === "PENDENTE"),
    );
    const monthIncomes = incomes.filter((i) => i.competencia === month);
    const cardTxTotal = monthTxs
      .filter((t) => cardIds.has(t.payment_account_id ?? ""))
      .reduce((s, t) => s + t.valor, 0);
    const invoiceTotal = invoiceAmounts
      .filter((ia) => ia.competencia === month)
      .reduce((s, ia) => s + ia.valor_real, 0);
    const extra = Math.max(0, invoiceTotal - cardTxTotal);

    const hasIncome = monthIncomes.length > 0;
    const isFuture = month > todayMonth;
    const isProjected = isFuture && !hasIncome;

    const receitas = hasIncome
      ? round2(monthIncomes.reduce((s, i) => s + i.valor, 0))
      : isProjected
        ? lastIncomeValue
        : 0;
    const despesas = round2(monthTxs.reduce((s, t) => s + t.valor, 0) + extra);

    return {
      competencia: month,
      receitas,
      despesas,
      saldoLivre: round2(receitas - despesas),
      isProjected,
    };
  });
}

export type MonthVerdict = "folga" | "apertado" | "nao_cabe";

const VERDICT_RANK: Record<MonthVerdict, number> = { folga: 0, apertado: 1, nao_cabe: 2 };

export function verdictForMargin(margemResultante: number, margemMinima: number): MonthVerdict {
  if (margemResultante < 0) return "nao_cabe";
  if (margemResultante < margemMinima) return "apertado";
  return "folga";
}

/** The worst verdict among a set of months "wins" — one tight month is enough to flag the whole plan. */
export function worstVerdict(evaluations: { veredito: MonthVerdict }[]): MonthVerdict {
  return evaluations.reduce<MonthVerdict>(
    (worst, e) => (VERDICT_RANK[e.veredito] > VERDICT_RANK[worst] ? e.veredito : worst),
    "folga",
  );
}

export interface PlanMonthEvaluation {
  competencia: Competencia;
  parcela: number;
  saldoLivre: number;
  /** saldoLivre - parcela: what's left over that month after paying this installment. */
  margemResultante: number;
  veredito: MonthVerdict;
}

/** Cross-references a projected balance with an amortization schedule starting at a given competencia. */
export function evaluatePlanFit(params: {
  projection: MonthlyBalanceProjection[];
  amortization: AmortizationInstallment[];
  competenciaInicio: Competencia;
  margemMinima: number;
}): PlanMonthEvaluation[] {
  const { projection, amortization, competenciaInicio, margemMinima } = params;
  const byCompetencia = new Map(projection.map((p) => [p.competencia, p]));

  return amortization.map((row) => {
    const competencia = shiftCompetencia(competenciaInicio, row.numero_parcela - 1);
    const saldoLivre = byCompetencia.get(competencia)?.saldoLivre ?? 0;
    const margemResultante = round2(saldoLivre - row.valor_parcela);
    return {
      competencia,
      parcela: row.valor_parcela,
      saldoLivre,
      margemResultante,
      veredito: verdictForMargin(margemResultante, margemMinima),
    };
  });
}

export interface StartSuggestion {
  competencia: Competencia;
  piorMargem: number;
  mesesNaoCabe: number;
  veredito: MonthVerdict;
}

/** Tests each candidate competencia as the plan's start and ranks them best-first. */
export function suggestBestStartCompetencia(params: {
  projection: MonthlyBalanceProjection[];
  principal: number;
  taxaMensal: number;
  parcelas: number;
  metodo: AmortizationMethodInput;
  margemMinima: number;
  candidateStarts: Competencia[];
}): StartSuggestion[] {
  const { projection, principal, taxaMensal, parcelas, metodo, margemMinima, candidateStarts } =
    params;
  const amortization = buildAmortizationTable({ principal, taxaMensal, parcelas, metodo });

  const suggestions = candidateStarts.map((competencia) => {
    const evaluations = evaluatePlanFit({
      projection,
      amortization,
      competenciaInicio: competencia,
      margemMinima,
    });
    const piorMargem = evaluations.length
      ? round2(Math.min(...evaluations.map((e) => e.margemResultante)))
      : 0;
    const mesesNaoCabe = evaluations.filter((e) => e.veredito === "nao_cabe").length;
    return { competencia, piorMargem, mesesNaoCabe, veredito: worstVerdict(evaluations) };
  });

  return suggestions.sort((a, b) => {
    if (a.mesesNaoCabe !== b.mesesNaoCabe) return a.mesesNaoCabe - b.mesesNaoCabe;
    return b.piorMargem - a.piorMargem;
  });
}

/** The amount actually financed: full price minus any down payment, floored at 0. */
export function financedAmount(plan: Pick<PurchasePlan, "valor_compra" | "valor_entrada">): number {
  return Math.max(0, plan.valor_compra - (plan.valor_entrada || 0));
}

/** Convenience: builds the amortization schedule directly from a saved/draft PurchasePlan. */
export function buildPlanAmortization(
  plan: Pick<
    PurchasePlan,
    | "valor_compra"
    | "valor_entrada"
    | "taxa_juros"
    | "taxa_juros_periodicidade"
    | "numero_parcelas"
    | "forma_amortizacao"
  >,
): AmortizationInstallment[] {
  const taxaMensal = toMonthlyRate(plan.taxa_juros, plan.taxa_juros_periodicidade);
  return buildAmortizationTable({
    principal: financedAmount(plan),
    taxaMensal,
    parcelas: plan.numero_parcelas,
    metodo: plan.forma_amortizacao,
  });
}

/** Generates the next `count` competencias starting at (and including) `from`. */
export function nextCompetencias(from: Competencia, count: number): Competencia[] {
  return Array.from({ length: count }, (_, i) => shiftCompetencia(from, i));
}
