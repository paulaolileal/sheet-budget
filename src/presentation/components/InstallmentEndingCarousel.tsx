import { useEffect, useState } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { AppIcon } from "./AppIcon";
import { brl } from "@/utils/format";
import { cn } from "@/lib/utils";
import { groupInstallments, stripParcela } from "@/lib/parcela";
import type { Category, Transaction } from "@/domain/types";

const AUTOPLAY_MS = 3500;

export interface InstallmentEndingCard {
  key: string;
  nome: string;
  categoria_id: string;
  totalParcelas: number;
  valor: number;
  paid: boolean;
}

/** Purchases whose final installment (N/N) falls in the given competencia. */
export function installmentsEndingIn(
  txs: Transaction[],
  competencia: string,
): InstallmentEndingCard[] {
  return groupInstallments(txs)
    .map((g) => ({ group: g, last: g.transactions[g.transactions.length - 1] }))
    .filter(({ last }) => last.competencia === competencia && last.status !== "IGNORADO")
    .map(({ group, last }) => ({
      key: group.key,
      nome: stripParcela(last.descricao),
      categoria_id: last.categoria_id,
      totalParcelas: group.transactions.length,
      valor: last.valor,
      paid: last.status === "PAGO" || last.status === "ADIANTADO",
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function InstallmentEndingCarousel({
  items,
  categories,
}: {
  items: InstallmentEndingCard[];
  categories?: Category[];
}) {
  const catMap = new Map((categories ?? []).map((c) => [c.category_id, c]));
  const [api, setApi] = useState<CarouselApi>();

  return (
    <Carousel opts={{ loop: items.length > 1, align: "start" }} setApi={setApi} className="w-full">
      <Autoplay api={api} enabled={items.length > 1} />
      <CarouselContent>
        {items.map((item) => {
          const category = catMap.get(item.categoria_id);
          return (
            <CarouselItem key={item.key} className="basis-[75%] sm:basis-[45%] md:basis-[32%]">
              <div
                className={cn(
                  "h-full rounded-lg border p-3 flex flex-col gap-2",
                  item.paid ? "bg-muted/30" : "bg-[color:var(--color-warning)]/5",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AppIcon iconId={category?.icon_id} size={16} className="shrink-0" />
                  <p className="text-sm font-medium truncate flex-1">{item.nome}</p>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {item.totalParcelas}/{item.totalParcelas}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs",
                      item.paid
                        ? "text-[color:var(--color-success)]"
                        : "text-[color:var(--color-warning)]",
                    )}
                  >
                    {item.paid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5" />
                    )}
                    {item.paid ? "Parcela finalizada" : "Parcela acaba esse mês"}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{brl(item.valor)}</span>
                </div>
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
    </Carousel>
  );
}

/** Drives the carousel forward on a timer — embla has no built-in autoplay, so this is a tiny
 * self-contained substitute for the `embla-carousel-autoplay` plugin (not installed). */
function Autoplay({ api, enabled }: { api: CarouselApi | undefined; enabled: boolean }) {
  useEffect(() => {
    if (!api || !enabled) return;
    const id = setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [api, enabled]);
  return null;
}
