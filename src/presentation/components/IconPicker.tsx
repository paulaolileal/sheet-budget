import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ICON_LIST, getIcon } from "@/utils/iconRegistry";
import { cn } from "@/lib/utils";

interface IconPickerProps {
  value?: string;
  onChange: (id: string | undefined) => void;
  placeholder?: string;
}

export function IconPicker({ value, onChange, placeholder = "Escolher ícone" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const CurrentIcon = value ? getIcon(value) : null;

  const filtered = search
    ? ICON_LIST.filter(({ id }) => id.toLowerCase().includes(search.toLowerCase()))
    : ICON_LIST;

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  function clear() {
    onChange(undefined);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="h-9 gap-2 px-3 justify-start">
          {CurrentIcon ? (
            <CurrentIcon size={16} />
          ) : (
            <Tag size={16} className="text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">{value ?? placeholder}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] p-3" align="start">
        <div className="space-y-2">
          <Input
            placeholder="Buscar ícone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />

          {value && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={clear}
            >
              <X size={12} className="mr-1" />
              Sem ícone
            </Button>
          )}

          {/* 6 colunas × 54px = 324px < 360px−24px (padding) = 336px */}
          <ScrollArea className="h-64">
            <div className="grid grid-cols-6 gap-1 pr-1">
              {filtered.map(({ id, component: Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={id}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 h-14 w-full rounded-md transition-colors hover:bg-accent",
                    value === id && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  onClick={() => select(id)}
                >
                  <Icon size={20} />
                  <span className="text-[9px] leading-none opacity-60 truncate w-full text-center px-0.5">
                    {id}
                  </span>
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                  Nenhum ícone encontrado
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
