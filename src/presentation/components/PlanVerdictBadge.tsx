import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  worstVerdict,
  type MonthVerdict,
  type PlanMonthEvaluation,
} from "@/domain/purchasePlanning";

export const VERDICT_LABEL: Record<MonthVerdict, string> = {
  folga: "Cabe com folga",
  apertado: "Aperta o orçamento",
  nao_cabe: "Não recomendado",
};

export const VERDICT_TONE: Record<MonthVerdict, string> = {
  folga: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  apertado: "bg-amber-500/15 text-amber-600",
  nao_cabe: "bg-red-500/15 text-red-500",
};

/** Text-only color, for icons/labels rendered outside the badge pill (e.g. table rows). */
export const VERDICT_TEXT_TONE: Record<MonthVerdict, string> = {
  folga: "text-[color:var(--color-success)]",
  apertado: "text-amber-600",
  nao_cabe: "text-red-500",
};

export const VERDICT_ICON: Record<MonthVerdict, typeof CheckCircle2> = {
  folga: CheckCircle2,
  apertado: AlertTriangle,
  nao_cabe: XCircle,
};

/** Badge summarizing a plan's fit across all its installment months — the worst month wins. */
export function PlanVerdictBadge({
  evaluations,
  className,
}: {
  evaluations: PlanMonthEvaluation[];
  className?: string;
}) {
  const verdict = worstVerdict(evaluations);
  const Icon = VERDICT_ICON[verdict];
  return (
    <Badge
      variant="outline"
      className={cn("font-normal border-0 text-xs gap-1", VERDICT_TONE[verdict], className)}
    >
      <Icon className="h-3 w-3" />
      {VERDICT_LABEL[verdict]}
    </Badge>
  );
}
