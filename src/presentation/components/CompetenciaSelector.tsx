import { useUiStore } from "@/store/uiStore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { competenciaLabel, currentCompetencia } from "@/utils/format";

function shift(c: string, months: number) {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CompetenciaSelector() {
  const { competencia, setCompetencia } = useUiStore();
  const today = currentCompetencia();
  return (
    <div className="inline-flex items-center gap-0 border rounded-md bg-card">
      <Button variant="ghost" size="icon" onClick={() => setCompetencia(shift(competencia, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="px-2 text-sm font-medium tabular-nums min-w-[88px] text-center">
        {competenciaLabel(competencia)}
      </span>
      <Button variant="ghost" size="icon" onClick={() => setCompetencia(shift(competencia, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="w-px h-5 bg-border mx-0.5" />
      <Button
        variant={competencia === today ? "default" : "ghost"}
        size="sm"
        className="text-xs px-2.5 h-8 rounded-l-none"
        onClick={() => setCompetencia(today)}
      >
        Hoje
      </Button>
    </div>
  );
}
