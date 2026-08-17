import { cn } from "@/lib/utils";
import { brl, competenciaLabel } from "@/utils/format";
import { VERDICT_ICON, VERDICT_TEXT_TONE } from "./PlanVerdictBadge";
import type { AmortizationInstallment } from "@/lib/amortization";
import type { PlanMonthEvaluation } from "@/domain/purchasePlanning";

/** Scrollable row-per-installment breakdown, cross-referenced with the monthly fit verdict. */
export function AmortizationTable({
  rows,
  evaluations,
}: {
  rows: AmortizationInstallment[];
  evaluations: PlanMonthEvaluation[];
}) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
      {rows.map((row, i) => {
        const evalRow = evaluations[i];
        const Icon = evalRow ? VERDICT_ICON[evalRow.veredito] : null;
        return (
          <div
            key={row.numero_parcela}
            className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              {Icon && evalRow && (
                <Icon className={cn("h-3.5 w-3.5 shrink-0", VERDICT_TEXT_TONE[evalRow.veredito])} />
              )}
              <span className="font-medium tabular-nums shrink-0">{row.numero_parcela}ª</span>
              {evalRow && (
                <span className="text-muted-foreground truncate">
                  {competenciaLabel(evalRow.competencia)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 tabular-nums shrink-0">
              {row.juros > 0 && (
                <span className="text-muted-foreground">juros {brl(row.juros)}</span>
              )}
              <span className="font-semibold">{brl(row.valor_parcela)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
