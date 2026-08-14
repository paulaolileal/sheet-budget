import { ArrowLeftRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { brl, competenciaLabel } from "@/utils/format";
import { cn } from "@/lib/utils";

export type Verdict = "melhor" | "pior" | "misto" | "igual";

export const VERDICT_LABEL: Record<Verdict, string> = {
  melhor: "Melhor",
  pior: "Pior",
  misto: "Misto",
  igual: "Igual",
};

export const VERDICT_TONE: Record<Verdict, string> = {
  melhor: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  pior: "bg-red-500/15 text-red-500",
  misto: "bg-amber-500/15 text-amber-600",
  igual: "bg-muted text-muted-foreground",
};

export const VERDICT_ICON: Record<Verdict, typeof TrendingDown> = {
  melhor: TrendingDown,
  pior: TrendingUp,
  misto: ArrowLeftRight,
  igual: Minus,
};

// "Melhor" = fewer and/or cheaper than last month (never more, never pricier).
// "Pior" is the mirror image; opposite signs on count vs. value are "Misto".
export function verdictFor(deltaCount: number, deltaValue: number): Verdict {
  if (deltaCount === 0 && deltaValue === 0) return "igual";
  if (deltaCount <= 0 && deltaValue <= 0) return "melhor";
  if (deltaCount >= 0 && deltaValue >= 0) return "pior";
  return "misto";
}

// Individual delta color, independent of the overall verdict: fewer/cheaper is good (green),
// more/pricier is bad (red), unchanged stays neutral.
export function deltaTone(delta: number): string {
  if (delta < 0) return "text-[color:var(--color-success)]";
  if (delta > 0) return "text-red-500";
  return "text-muted-foreground";
}

/** Month-over-month comparison for a value+count pair, styled as an inline summary-bar stat. */
export function MonthComparison({
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
  const countLabel = `${deltaCount > 0 ? "+" : ""}${deltaCount}`;
  const valueLabel = `${deltaValue > 0 ? "+" : deltaValue < 0 ? "-" : ""}${brl(Math.abs(deltaValue))}`;

  return (
    <div className="ml-auto flex items-center gap-x-3 gap-y-1 text-sm flex-wrap">
      <span className="text-xs text-muted-foreground">vs {competenciaLabel(prevCompetencia)}</span>
      <Badge
        variant="outline"
        className={cn("font-normal border-0 text-xs gap-1", VERDICT_TONE[verdict])}
      >
        <VerdictIcon className="h-3 w-3" />
        {VERDICT_LABEL[verdict]}
      </Badge>
      <div className="h-4 w-px bg-border" />
      <span className="text-muted-foreground">Itens</span>
      <span className={cn("font-semibold tabular-nums", deltaTone(deltaCount))}>{countLabel}</span>
      <div className="h-4 w-px bg-border" />
      <span className="text-muted-foreground">Valor</span>
      <span className={cn("font-semibold tabular-nums", deltaTone(deltaValue))}>{valueLabel}</span>
    </div>
  );
}
