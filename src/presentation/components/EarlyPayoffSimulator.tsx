import { MonthYearPicker } from "./MonthYearPicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { presentValueDiscount, type AmortizationInstallment } from "@/lib/amortization";
import { brl, competenciaLabel, monthsBetween, shiftCompetencia } from "@/utils/format";
import type { Competencia } from "@/domain/types";

interface EarlyPayoffSimulatorProps {
  rows: AmortizationInstallment[];
  competenciaInicio: Competencia;
  taxaMensal: number;
  /** Intended payment competência per installment number; defaults to the installment's own due date when absent. */
  payoffDates: Record<number, Competencia>;
  onChangePayoffDate: (numeroParcela: number, competencia: Competencia) => void;
}

/**
 * Lets the user pick, per installment, when they actually intend to pay it — and shows the
 * present-value discount for paying ahead of the due date, at the contract's own monthly
 * rate (the "quitação antecipada" discount lenders owe under CDC art. 52 §2º). Validated
 * against a real financing payoff statement — see `presentValueDiscount` in amortization.ts.
 */
export function EarlyPayoffSimulator({
  rows,
  competenciaInicio,
  taxaMensal,
  payoffDates,
  onChangePayoffDate,
}: EarlyPayoffSimulatorProps) {
  const items = rows.map((row) => {
    const vencimento = shiftCompetencia(competenciaInicio, row.numero_parcela - 1);
    const pretendePagar = payoffDates[row.numero_parcela] ?? vencimento;
    const mesesAntecipados = Math.max(0, monthsBetween(pretendePagar, vencimento));
    const valor = presentValueDiscount(row.valor_parcela, taxaMensal, mesesAntecipados);
    return { row, vencimento, pretendePagar, mesesAntecipados, valor };
  });

  const totalNominal = rows.reduce((s, r) => s + r.valor_parcela, 0);
  const totalSimulado = items.reduce((s, it) => s + it.valor, 0);
  const economia = totalNominal - totalSimulado;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Simular quitação antecipada</CardTitle>
        <CardDescription>
          Ajuste quando pretende pagar cada parcela para ver o valor com desconto de juros — quanto
          mais cedo, maior o desconto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-80 overflow-y-auto rounded-md border divide-y">
          {items.map(({ row, vencimento, pretendePagar, mesesAntecipados, valor }) => (
            <div key={row.numero_parcela} className="flex flex-col gap-1.5 px-3 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium tabular-nums">
                  {row.numero_parcela}ª · venc. {competenciaLabel(vencimento)}
                </span>
                <span className="text-muted-foreground">nominal {brl(row.valor_parcela)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <MonthYearPicker
                    value={pretendePagar}
                    onChange={(v) => onChangePayoffDate(row.numero_parcela, v)}
                  />
                </div>
                <span
                  className={cn(
                    "font-semibold tabular-nums shrink-0 w-24 text-right",
                    mesesAntecipados > 0 && "text-[color:var(--color-success)]",
                  )}
                >
                  {brl(valor)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm border-t pt-3">
          <span className="text-muted-foreground">Total pagando nessas datas</span>
          <span className="font-semibold tabular-nums">{brl(totalSimulado)}</span>
        </div>
        {economia > 0.01 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Economia de juros</span>
            <span className="font-semibold tabular-nums text-[color:var(--color-success)]">
              {brl(economia)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
