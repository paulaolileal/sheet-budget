import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "../components/PageHeader";
import { useAccounts, useBulkPayByAccount, useTransactions } from "@/hooks/queries";
import { brl, competenciaLabel, currentCompetencia } from "@/utils/format";
import type { Transaction } from "@/domain/types";
import { CreditCard, CheckCircle2, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DerivedFatura {
  key: string;
  payment_account_id: string;
  competencia: string;
  nome: string;
  isPaid: boolean;
  total: number;
  transactions: Transaction[];
}

function addMonths(competencia: string, delta: number): string {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.split("-")[0]));

  const selectedYear = Number(value.split("-")[0]);
  const selectedMonth = Number(value.split("-")[1]) - 1;

  const select = (monthIndex: number) => {
    onChange(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="gap-2 text-base font-semibold px-3">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {competenciaLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((label, i) => (
            <Button
              key={label}
              variant={year === selectedYear && i === selectedMonth ? "default" : "ghost"}
              size="sm"
              className="text-xs h-8"
              onClick={() => select(i)}
            >
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CardsPage() {
  const { data: txs, isLoading } = useTransactions();
  const { data: accounts } = useAccounts();
  const bulkPay = useBulkPayByAccount();

  const [competencia, setCompetencia] = useState(() => currentCompetencia());
  const [selected, setSelected] = useState<DerivedFatura | null>(null);
  const [confirming, setConfirming] = useState<DerivedFatura | null>(null);

  const accMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a])),
    [accounts],
  );

  const cardAccountIds = useMemo(
    () => new Set((accounts ?? []).filter((a) => a.tipo === "CARTAO").map((a) => a.account_id)),
    [accounts],
  );

  const installmentLabels = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of txs ?? []) {
      if (t.tipo_lancamento !== "PARCELADO") continue;
      if (!groups.has(t.descricao)) groups.set(t.descricao, []);
      groups.get(t.descricao)!.push(t);
    }
    const labels = new Map<string, string>();
    for (const group of groups.values()) {
      const sorted = [...group].sort((a, b) => a.competencia.localeCompare(b.competencia));
      sorted.forEach((t, i) => labels.set(t.transaction_id, `(${i + 1}/${sorted.length})`));
    }
    return labels;
  }, [txs]);

  const faturas = useMemo<DerivedFatura[]>(() => {
    const grouped = new Map<string, Transaction[]>();
    for (const t of txs ?? []) {
      if (!t.payment_account_id || !cardAccountIds.has(t.payment_account_id)) continue;
      const key = `${t.payment_account_id}:${t.competencia}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }
    return Array.from(grouped.entries())
      .map(([key, txList]) => {
        const [accountId, comp] = key.split(":");
        const account = accMap[accountId];
        return {
          key,
          payment_account_id: accountId,
          competencia: comp,
          nome: `Fatura ${account?.nome ?? accountId} ${comp}`,
          isPaid: txList.every((t) => t.status === "PAGO"),
          total: txList.reduce((s, t) => s + (t.valor_final ?? t.valor_previsto), 0),
          transactions: txList,
        };
      })
      .sort((a, b) => b.competencia.localeCompare(a.competencia));
  }, [txs, cardAccountIds, accMap]);

  const allMonths = useMemo(
    () => [...new Set(faturas.map((f) => f.competencia))].sort(),
    [faturas],
  );

  const monthFaturas = useMemo(
    () => faturas.filter((f) => f.competencia === competencia),
    [faturas, competencia],
  );

  const canGoPrev = allMonths.length > 0 && competencia > allMonths[0];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <PageHeader title="Cartões & Faturas" description="Navegue pelas faturas por mês." />

      <div className="flex items-center justify-center gap-1 mb-8">
        <Button
          variant="ghost"
          size="icon"
          disabled={!canGoPrev}
          onClick={() => setCompetencia((c) => addMonths(c, -1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <MonthPicker value={competencia} onChange={setCompetencia} />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCompetencia((c) => addMonths(c, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : monthFaturas.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhuma fatura</CardTitle>
            <CardDescription>
              Não há transações de cartão em {competenciaLabel(competencia)}.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className={cn("grid gap-4", monthFaturas.length > 1 && "grid-cols-1 sm:grid-cols-2")}>
          {monthFaturas.map((f) => (
            <Card key={f.key} className={cn("transition-all", f.isPaid && "opacity-75")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-sm">
                    {accMap[f.payment_account_id]?.nome ?? "Cartão"}
                  </CardDescription>
                  {f.isPaid ? (
                    <Badge className="bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-0 text-[11px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px]">Em aberto</Badge>
                  )}
                </div>
                <CardTitle className="text-lg flex items-center gap-2 mt-1">
                  <CreditCard className="h-5 w-5 shrink-0" />
                  {f.nome}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold tabular-nums mb-6">{brl(f.total)}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(f)}>
                    Ver transações
                  </Button>
                  {!f.isPaid && (
                    <Button size="sm" onClick={() => setConfirming(f)}>
                      Pagar fatura
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.nome}</DialogTitle>
            <DialogDescription>
              {selected && `${selected.transactions.length} transações — total ${brl(selected.total)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Descrição</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {(selected?.transactions ?? []).map((t) => (
                  <tr key={t.transaction_id} className="border-t">
                    <td className="px-3 py-2">
                      {t.descricao}
                      {installmentLabels.has(t.transaction_id) && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {installmentLabels.get(t.transaction_id)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {brl(t.valor_final ?? t.valor_previsto)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            {selected && !selected.isPaid && (
              <Button onClick={() => setConfirming(selected)}>Pagar fatura</Button>
            )}
            <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
            <DialogDescription>
              {confirming &&
                `Marcar "${confirming.nome}" como paga? Todas as transações vinculadas ficarão com status PAGO.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!confirming) return;
                await bulkPay.mutateAsync({
                  payment_account_id: confirming.payment_account_id,
                  competencia: confirming.competencia,
                });
                setConfirming(null);
                setSelected(null);
              }}
              disabled={bulkPay.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
