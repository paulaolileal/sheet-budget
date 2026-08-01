import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, MessageCircle, CopyPlus } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { CompetenciaSelector } from "../components/CompetenciaSelector";
import { DebtorDialog } from "../components/DebtorDialog";
import { DebtDialog } from "../components/DebtDialog";
import {
  useDebtors,
  useDebts,
  useDeleteDebtor,
  useDeleteDebt,
  useUpdateDebt,
  useDuplicatePreviousMonthDebts,
} from "@/hooks/queries";
import { useUiStore } from "@/store/uiStore";
import { brl } from "@/utils/format";
import { buildChargeMessage, whatsappChargeUrl } from "@/utils/whatsapp";
import { cn } from "@/lib/utils";
import type { Debt, DebtStatus, Debtor } from "@/domain/types";

const STATUS_TONES: Record<DebtStatus, string> = {
  PENDENTE: "bg-[color:var(--color-warning)]/20 text-[color:var(--color-warning)]",
  PAGO: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
};

export function DebtorsPage() {
  const competencia = useUiStore((s) => s.competencia);
  const { data: debtors, isLoading: loadingDebtors } = useDebtors();
  const { data: debts, isLoading: loadingDebts } = useDebts();
  const deleteDebtor = useDeleteDebtor();
  const deleteDebt = useDeleteDebt();
  const updateDebt = useUpdateDebt();
  const duplicatePreviousMonth = useDuplicatePreviousMonthDebts();

  const [debtorDialogOpen, setDebtorDialogOpen] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [deletingDebtorId, setDeletingDebtorId] = useState<string | null>(null);

  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtDialogDebtorId, setDebtDialogDebtorId] = useState<string | null>(null);
  const [deletingDebtId, setDeletingDebtId] = useState<string | null>(null);

  const isLoading = loadingDebtors || loadingDebts;

  const debtsByDebtor = useMemo(() => {
    const map = new Map<string, Debt[]>();
    for (const debt of debts ?? []) {
      if (debt.competencia !== competencia) continue;
      const list = map.get(debt.debtor_id) ?? [];
      list.push(debt);
      map.set(debt.debtor_id, list);
    }
    return map;
  }, [debts, competencia]);

  const { totalPendente, totalPago } = useMemo(() => {
    let pendente = 0;
    let pago = 0;
    for (const debt of debts ?? []) {
      if (debt.competencia !== competencia) continue;
      if (debt.status === "PAGO") pago += debt.valor;
      else pendente += debt.valor;
    }
    return { totalPendente: pendente, totalPago: pago };
  }, [debts, competencia]);

  function openNewDebt(debtorId: string) {
    setDebtDialogDebtorId(debtorId);
    setEditingDebt(null);
    setDebtDialogOpen(true);
  }

  function openEditDebt(debt: Debt) {
    setDebtDialogDebtorId(debt.debtor_id);
    setEditingDebt(debt);
    setDebtDialogOpen(true);
  }

  function handleCharge(debtor: Debtor) {
    const pending = (debtsByDebtor.get(debtor.debtor_id) ?? []).filter(
      (d) => d.status === "PENDENTE",
    );
    const message = buildChargeMessage(debtor.nome, pending);
    window.open(whatsappChargeUrl(debtor.telefone ?? "", message), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="px-4 py-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Devedores"
        description="Controle de empréstimos e valores a receber de outras pessoas."
        actions={
          <>
            <CompetenciaSelector />
            <Button
              variant="outline"
              onClick={() => duplicatePreviousMonth.mutate()}
              disabled={duplicatePreviousMonth.isPending}
            >
              <CopyPlus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Duplicar mês anterior</span>
            </Button>
            <Button
              onClick={() => {
                setEditingDebtor(null);
                setDebtorDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Novo devedor</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Pendente no mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-semibold tabular-nums text-[color:var(--color-warning)]">
                {brl(totalPendente)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/40 border-dashed">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Recebido no mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-semibold tabular-nums text-[color:var(--color-success)]">
                {brl(totalPago)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : (debtors ?? []).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhum devedor cadastrado</CardTitle>
            <CardDescription>
              Cadastre uma pessoa usando o botão "Novo devedor" para começar a controlar valores a
              receber.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {(debtors ?? []).map((debtor) => {
            const debtorDebts = debtsByDebtor.get(debtor.debtor_id) ?? [];
            const total = debtorDebts.reduce((s, d) => s + d.valor, 0);
            const hasPending = debtorDebts.some((d) => d.status === "PENDENTE");

            return (
              <Card key={debtor.debtor_id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div>
                    <CardTitle className="text-base">{debtor.nome}</CardTitle>
                    <CardDescription className="tabular-nums">
                      Total no mês: {brl(total)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      disabled={!hasPending || !debtor.telefone}
                      title={
                        !debtor.telefone
                          ? "Cadastre o telefone do devedor"
                          : !hasPending
                            ? "Nenhuma pendência neste mês"
                            : "Cobrar no WhatsApp"
                      }
                      onClick={() => handleCharge(debtor)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Cobrar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingDebtor(debtor);
                        setDebtorDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7",
                        deletingDebtorId === debtor.debtor_id
                          ? "text-destructive hover:text-destructive"
                          : "text-muted-foreground",
                      )}
                      disabled={deleteDebtor.isPending}
                      onClick={async () => {
                        if (deletingDebtorId !== debtor.debtor_id) {
                          setDeletingDebtorId(debtor.debtor_id);
                          return;
                        }
                        await deleteDebtor.mutateAsync(debtor.debtor_id);
                        setDeletingDebtorId(null);
                      }}
                      onBlur={() => {
                        if (deletingDebtorId === debtor.debtor_id) setDeletingDebtorId(null);
                      }}
                      title={
                        deletingDebtorId === debtor.debtor_id ? "Confirmar exclusão" : "Excluir"
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {debtorDebts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nenhuma dívida neste mês.</p>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {debtorDebts.map((debt) => (
                            <tr key={debt.debt_id} className="border-t first:border-t-0">
                              <td className="px-3 py-2 font-medium">{debt.descricao}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {brl(debt.valor)}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDebt.mutate({
                                      id: debt.debt_id,
                                      patch: {
                                        status: debt.status === "PAGO" ? "PENDENTE" : "PAGO",
                                      },
                                    })
                                  }
                                >
                                  <Badge
                                    variant="outline"
                                    className={cn("cursor-pointer", STATUS_TONES[debt.status])}
                                  >
                                    {debt.status}
                                  </Badge>
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => openEditDebt(debt)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-6 w-6",
                                      deletingDebtId === debt.debt_id
                                        ? "text-destructive hover:text-destructive"
                                        : "text-muted-foreground",
                                    )}
                                    disabled={deleteDebt.isPending}
                                    onClick={async () => {
                                      if (deletingDebtId !== debt.debt_id) {
                                        setDeletingDebtId(debt.debt_id);
                                        return;
                                      }
                                      await deleteDebt.mutateAsync(debt.debt_id);
                                      setDeletingDebtId(null);
                                    }}
                                    onBlur={() => {
                                      if (deletingDebtId === debt.debt_id) setDeletingDebtId(null);
                                    }}
                                    title={
                                      deletingDebtId === debt.debt_id
                                        ? "Confirmar exclusão"
                                        : "Excluir"
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-muted-foreground"
                    onClick={() => openNewDebt(debtor.debtor_id)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar dívida
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DebtorDialog
        open={debtorDialogOpen}
        onOpenChange={(o) => {
          setDebtorDialogOpen(o);
          if (!o) setEditingDebtor(null);
        }}
        debtor={editingDebtor}
      />

      <DebtDialog
        open={debtDialogOpen}
        onOpenChange={(o) => {
          setDebtDialogOpen(o);
          if (!o) {
            setEditingDebt(null);
            setDebtDialogDebtorId(null);
          }
        }}
        debtorId={debtDialogDebtorId}
        debt={editingDebt}
      />
    </div>
  );
}
