import { useState } from "react";
import { useUiStore } from "@/store/uiStore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { competenciaLabel, currentCompetencia } from "@/utils/format";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function shift(c: string, months: number) {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CompetenciaSelector() {
  const { competencia, setCompetencia } = useUiStore();
  const today = currentCompetencia();

  const [open, setOpen] = useState(false);
  const [popoverYear, setPopoverYear] = useState(() => Number(competencia.split("-")[0]));

  const selectedYear = Number(competencia.split("-")[0]);
  const selectedMonth = Number(competencia.split("-")[1]) - 1;

  function handleOpenChange(o: boolean) {
    if (o) setPopoverYear(Number(competencia.split("-")[0]));
    setOpen(o);
  }

  function handleMonthSelect(monthIdx: number) {
    setCompetencia(`${popoverYear}-${String(monthIdx + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div className="inline-flex items-center gap-0 border rounded-md bg-card">
      <Button variant="ghost" size="icon" onClick={() => setCompetencia(shift(competencia, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="px-2 text-sm font-medium tabular-nums min-w-[88px] text-center py-2 hover:bg-accent transition-colors rounded-sm"
          >
            {competenciaLabel(competencia)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3" align="center">
          <div className="flex items-center justify-between mb-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPopoverYear((y) => y - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{popoverYear}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPopoverYear((y) => y + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, idx) => (
              <button
                key={name}
                type="button"
                onClick={() => handleMonthSelect(idx)}
                className={cn(
                  "text-xs py-1.5 rounded-md transition-colors hover:bg-accent",
                  selectedMonth === idx && selectedYear === popoverYear
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-foreground",
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

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
