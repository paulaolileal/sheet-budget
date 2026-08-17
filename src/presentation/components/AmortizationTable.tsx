import { MonthYearPicker } from "./MonthYearPicker";
import { cn } from "@/lib/utils";
import { brl, monthsBetween, shiftCompetencia } from "@/utils/format";
import { presentValueDiscount, type AmortizationInstallment } from "@/lib/amortization";
import { VERDICT_ICON, VERDICT_TEXT_TONE } from "./PlanVerdictBadge";
import type { PlanMonthEvaluation } from "@/domain/purchasePlanning";
import type { Competencia } from "@/domain/types";

interface AmortizationTableProps {
  rows: AmortizationInstallment[];
  evaluations: PlanMonthEvaluation[];
  competenciaInicio: Competencia;
  taxaMensal: number;
  /** Intended payment competência per installment number; defaults to the installment's own due date when absent. */
  payoffDates: Record<number, Competencia>;
  onChangePayoffDate: (numeroParcela: number, competencia: Competencia) => void;
}

/**
 * Scrollable row-per-installment breakdown. Each row's competência is an editable picker —
 * when do you actually intend to pay that installment — defaulting to its due date. Paying
 * ahead of schedule discounts the value at the contract's own monthly rate
 * (`presentValueDiscount`), the "quitação antecipada" discount Brazilian lenders owe under
 * CDC art. 52 §2º. The verdict icon still reflects the ORIGINAL due month's budget fit —
 * that's what the projected balance was evaluated against, independent of when you plan to
 * actually settle it.
 */
export function AmortizationTable({
  rows,
  evaluations,
  competenciaInicio,
  taxaMensal,
  payoffDates,
  onChangePayoffDate,
}: AmortizationTableProps) {
  const items = rows.map((row, i) => {
    const vencimento = shiftCompetencia(competenciaInicio, row.numero_parcela - 1);
    const pretendePagar = payoffDates[row.numero_parcela] ?? vencimento;
    const mesesAntecipados = Math.max(0, monthsBetween(pretendePagar, vencimento));
    const valor = presentValueDiscount(row.valor_parcela, taxaMensal, mesesAntecipados);
    return { row, evalRow: evaluations[i], pretendePagar, mesesAntecipados, valor };
  });

  const totalNominal = rows.reduce((s, r) => s + r.valor_parcela, 0);
  const totalSimulado = items.reduce((s, it) => s + it.valor, 0);
  const economia = totalNominal - totalSimulado;

  return (
    <div className="space-y-3">
      <div className="max-h-96 overflow-y-auto rounded-md border divide-y">
        {items.map(({ row, evalRow, pretendePagar, mesesAntecipados, valor }) => {
          const Icon = evalRow ? VERDICT_ICON[evalRow.veredito] : null;
          return (
            <div key={row.numero_parcela} className="flex flex-col gap-1.5 px-3 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {Icon && evalRow && (
                    <Icon
                      className={cn("h-3.5 w-3.5 shrink-0", VERDICT_TEXT_TONE[evalRow.veredito])}
                    />
                  )}
                  <span className="font-medium tabular-nums shrink-0">{row.numero_parcela}ª</span>
                  <div className="flex-1 min-w-[120px] max-w-[170px]">
                    <MonthYearPicker
                      value={pretendePagar}
                      onChange={(v) => onChangePayoffDate(row.numero_parcela, v)}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    "font-semibold tabular-nums shrink-0",
                    mesesAntecipados > 0 && "text-[color:var(--color-success)]",
                  )}
                >
                  {brl(valor)}
                </span>
              </div>
              <div className="flex items-center gap-3 tabular-nums text-muted-foreground pl-5">
                {/* Amortização/juros/saldo describe the regular schedule (informational);
                    `valor` above is what you'd actually pay on the chosen date. */}
                <span>amortiza {brl(row.amortizacao)}</span>
                {row.juros > 0 && <span>juros {brl(row.juros)}</span>}
                <span className="ml-auto">saldo {brl(row.saldo_devedor)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-muted-foreground">Total pagando nessas datas</span>
        <span className="font-semibold tabular-nums">{brl(totalSimulado)}</span>
      </div>
      {economia > 0.01 && (
        <div className="flex items-center justify-between text-sm px-1">
          <span className="text-muted-foreground">Economia de juros</span>
          <span className="font-semibold tabular-nums text-[color:var(--color-success)]">
            {brl(economia)}
          </span>
        </div>
      )}
    </div>
  );
}
