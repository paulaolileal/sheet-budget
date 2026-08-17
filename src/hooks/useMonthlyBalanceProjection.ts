import { useMemo } from "react";
import { useAccounts, useIncomes, useInvoiceAmounts, useTransactions } from "./queries";
import { nextCompetencias, projectMonthlyBalance } from "@/domain/purchasePlanning";
import { currentCompetencia } from "@/utils/format";
import type { Competencia } from "@/domain/types";

/**
 * Projects the user's free monthly balance (receitas - despesas) over a horizon of
 * competencias, reusing the same rules as `DashboardPage`'s trend chart. Shared by the
 * Dashboard and the purchase-planning feature so the projection logic has one source of truth.
 */
export function useMonthlyBalanceProjection(horizonMonths = 12, fromCompetencia?: Competencia) {
  const { data: txs } = useTransactions();
  const { data: incomes } = useIncomes();
  const { data: invoiceAmounts } = useInvoiceAmounts();
  const { data: accounts } = useAccounts();

  return useMemo(() => {
    if (!txs || !incomes || !invoiceAmounts || !accounts) return undefined;
    const months = nextCompetencias(fromCompetencia ?? currentCompetencia(), horizonMonths);
    return projectMonthlyBalance(txs, incomes, invoiceAmounts, accounts, months);
  }, [txs, incomes, invoiceAmounts, accounts, horizonMonths, fromCompetencia]);
}
