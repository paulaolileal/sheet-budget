import { useUiStore } from "@/store/uiStore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { competenciaLabel } from "@/utils/format";

function shift(c: string, months: number) {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CompetenciaSelector() {
  const { competencia, setCompetencia } = useUiStore();
  return (
    <div className="inline-flex items-center gap-1 border rounded-md bg-card">
      <Button variant="ghost" size="icon" onClick={() => setCompetencia(shift(competencia, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="px-2 text-sm font-medium tabular-nums min-w-[88px] text-center">
        {competenciaLabel(competencia)}
      </span>
      <Button variant="ghost" size="icon" onClick={() => setCompetencia(shift(competencia, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
