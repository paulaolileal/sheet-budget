import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { competenciaLabel, currentCompetencia } from "@/utils/format";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function shiftMonth(c: string, delta: number): string {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface MonthYearPickerProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  optional?: boolean;
}

export function MonthYearPicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Selecione",
  optional = false,
}: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [popoverYear, setPopoverYear] = useState(() =>
    Number((value || currentCompetencia()).split("-")[0]),
  );

  const selectedYear = value ? Number(value.split("-")[0]) : -1;
  const selectedMonth = value ? Number(value.split("-")[1]) - 1 : -1;

  function handleShift(delta: number) {
    const base = value || currentCompetencia();
    onChange(shiftMonth(base, delta));
  }

  function handleOpenChange(o: boolean) {
    if (o) setPopoverYear(Number((value || currentCompetencia()).split("-")[0]));
    setOpen(o);
  }

  function handleMonthSelect(monthIdx: number) {
    onChange(`${popoverYear}-${String(monthIdx + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div
      className={cn(
        "flex items-center w-full border rounded-md bg-background h-9",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-r-none border-r-0"
        onClick={() => handleShift(-1)}
        tabIndex={-1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex-1 text-sm font-medium text-center py-2 min-w-0 truncate hover:bg-accent transition-colors rounded-sm",
              !value && "text-muted-foreground font-normal",
            )}
          >
            {value ? competenciaLabel(value) : placeholder}
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

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-l-none border-l-0"
        onClick={() => handleShift(1)}
        tabIndex={-1}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {optional && (
        <>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-l-none text-muted-foreground hover:text-foreground"
            onClick={() => onChange("")}
            tabIndex={-1}
            title="Limpar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
