import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl, competenciaLabel } from "@/utils/format";
import { cn } from "@/lib/utils";
import {
  VERDICT_ICON,
  VERDICT_LABEL,
  VERDICT_TONE,
  deltaTone,
  verdictFor,
} from "./MonthComparison";

function countPhrase(delta: number): string {
  if (delta === 0) return "a quantidade de lançamentos se manteve";
  const verb = delta > 0 ? "aumentou" : "diminuiu";
  const n = Math.abs(delta);
  return `a quantidade de lançamentos ${verb} em ${n} ${n === 1 ? "item" : "itens"}`;
}

function valuePhrase(delta: number): string {
  if (delta === 0) return "o valor total se manteve";
  const verb = delta > 0 ? "subiu" : "desceu";
  return `o valor ${verb} em ${brl(Math.abs(delta))}`;
}

/**
 * Month-over-month comparison, rendered as a dashboard KPI card — two stat tiles
 * (Lançamentos / Valor total) with their own delta chip, not the thin inline stat-bar
 * used on the Lançamentos page (`MonthComparison`), which this reuses only for the
 * verdict/delta color logic.
 */
export function MonthComparisonCard({
  currentValue,
  prevValue,
  currentCount,
  prevCount,
  prevCompetencia,
}: {
  currentValue: number;
  prevValue: number;
  currentCount: number;
  prevCount: number;
  prevCompetencia: string;
}) {
  if (prevValue === 0 && currentValue === 0) return null;
  const deltaCount = currentCount - prevCount;
  const deltaValue = currentValue - prevValue;
  const verdict = verdictFor(deltaCount, deltaValue);
  const VerdictIcon = VERDICT_ICON[verdict];
  const countDeltaLabel = `${deltaCount > 0 ? "+" : ""}${deltaCount} vs ${competenciaLabel(prevCompetencia)}`;
  const valueDeltaLabel = `${deltaValue > 0 ? "+" : deltaValue < 0 ? "-" : ""}${brl(Math.abs(deltaValue))} vs ${competenciaLabel(prevCompetencia)}`;

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Comparado ao mês anterior</CardTitle>
          <CardDescription>
            Em relação a {competenciaLabel(prevCompetencia)}, {countPhrase(deltaCount)} e{" "}
            {valuePhrase(deltaValue)}.
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={cn("font-normal border-0 text-xs gap-1 shrink-0", VERDICT_TONE[verdict])}
        >
          <VerdictIcon className="h-3 w-3" />
          {VERDICT_LABEL[verdict]}
        </Badge>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <ComparisonTile
          label="Lançamentos"
          value={String(currentCount)}
          delta={deltaCount}
          deltaLabel={countDeltaLabel}
        />
        <ComparisonTile
          label="Valor total"
          value={brl(currentValue)}
          delta={deltaValue}
          deltaLabel={valueDeltaLabel}
        />
      </CardContent>
    </Card>
  );
}

function ComparisonTile({
  label,
  value,
  delta,
  deltaLabel,
}: {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
}) {
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold tabular-nums">{value}</p>
      <p
        className={cn("mt-1 inline-flex items-center gap-1 text-xs font-medium", deltaTone(delta))}
      >
        <Icon className="h-3 w-3" />
        {deltaLabel}
      </p>
    </div>
  );
}
