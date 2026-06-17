import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            <CurrentIcon size={15} />
          ) : (
            <Tag size={15} className="text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">{value ?? placeholder}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-3" align="start">
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

          <div className="grid grid-cols-7 gap-0.5 max-h-52 overflow-y-auto">
            {filtered.map(({ id, component: Icon }) => (
              <button
                key={id}
                type="button"
                title={id}
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-md transition-colors hover:bg-accent",
                  value === id && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
                onClick={() => select(id)}
              >
                <Icon size={16} />
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="col-span-7 py-4 text-center text-xs text-muted-foreground">
                Nenhum ícone encontrado
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
