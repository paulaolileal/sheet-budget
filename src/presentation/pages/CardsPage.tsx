import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "../components/PageHeader";
import {
  useAccounts,
  useMarkGroupPaid,
  usePaymentGroups,
  useTransactions,
} from "@/hooks/queries";
import { brl, competenciaLabel } from "@/utils/format";
import type { PaymentGroup } from "@/domain/types";
import { CreditCard, CheckCircle2 } from "lucide-react";

export function CardsPage() {
  const { data: groups, isLoading } = usePaymentGroups();
  const { data: txs } = useTransactions();
  const { data: accounts } = useAccounts();
  const markPaid = useMarkGroupPaid();
  const [selected, setSelected] = useState<PaymentGroup | null>(null);
  const [confirming, setConfirming] = useState<PaymentGroup | null>(null);

  const accMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a])),
    [accounts],
  );

  const open = (groups ?? []).filter((g) => g.status === "ABERTO").sort((a, b) => a.competencia.localeCompare(b.competencia));
  const paid = (groups ?? []).filter((g) => g.status === "PAGO").sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, 6);

  const totalFor = (g: PaymentGroup) =>
    (txs ?? [])
      .filter((t) => t.payment_group_id === g.payment_group_id)
      .reduce((s, t) => s + (t.valor_final ?? t.valor_previsto), 0);

  const detailTxs = useMemo(
    () => (selected ? (txs ?? []).filter((t) => t.payment_group_id === selected.payment_group_id) : []),
    [selected, txs],
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="Cartões & Faturas" description="Faturas abertas e histórico de pagamentos." />

      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Faturas em aberto</h2>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : open.length === 0 ? (
        <Card className="mb-8"><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma fatura em aberto.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {open.map((g) => (
            <Card key={g.payment_group_id} className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => setSelected(g)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs">{accMap[g.payment_account_id]?.nome ?? "Cartão"}</CardDescription>
                  <Badge variant="outline" className="text-[10px]">{competenciaLabel(g.competencia)}</Badge>
                </div>
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> {g.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{brl(totalFor(g))}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Faturas pagas (recentes)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {paid.map((g) => (
          <Card key={g.payment_group_id} className="opacity-80 cursor-pointer" onClick={() => setSelected(g)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs">{accMap[g.payment_account_id]?.nome ?? "Cartão"}</CardDescription>
                <Badge className="text-[10px] bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                </Badge>
              </div>
              <CardTitle className="text-base">{g.nome}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tabular-nums">{brl(totalFor(g))}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.nome}</DialogTitle>
            <DialogDescription>
              {selected && `${detailTxs.length} transações — total ${brl(totalFor(selected))}`}
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
                {detailTxs.map((t) => (
                  <tr key={t.transaction_id} className="border-t">
                    <td className="px-3 py-2">{t.descricao}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(t.valor_final ?? t.valor_previsto)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            {selected?.status === "ABERTO" && (
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
              {confirming && `Marcar "${confirming.nome}" como paga? Todas as transações vinculadas ficarão com status PAGO.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!confirming) return;
                await markPaid.mutateAsync(confirming.payment_group_id);
                setConfirming(null);
                setSelected(null);
              }}
              disabled={markPaid.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
