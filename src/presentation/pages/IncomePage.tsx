import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { CompetenciaSelector } from "../components/CompetenciaSelector";
import { IncomeDialog } from "../components/IncomeDialog";
import { AppIcon } from "../components/AppIcon";
import { useIncomes, useDeleteIncome } from "@/hooks/queries";
import { useUiStore } from "@/store/uiStore";
import { brl } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { Income } from "@/domain/types";

export function IncomePage() {
  const competencia = useUiStore((s) => s.competencia);
  const { data: incomes, isLoading } = useIncomes();
  const deleteIncome = useDeleteIncome();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (incomes ?? []).filter((i) => i.competencia === competencia),
    [incomes, competencia],
  );

  const totalReceitas = useMemo(
    () => filtered.reduce((s, i) => s + i.valor, 0),
    [filtered],
  );

  return (
    <div className="px-4 py-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Receitas"
        description="Salários, bônus e outras entradas positivas."
        actions={
          <>
            <CompetenciaSelector />
            <Button
              onClick={() => {
                setEditingIncome(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nova</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Total de receitas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-semibold tabular-nums text-[color:var(--color-success)]">
                {brl(totalReceitas)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/40 border-dashed">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Entradas no mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-semibold">{filtered.length}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhuma receita neste mês</CardTitle>
            <CardDescription>
              Adicione salários, bônus ou outras entradas usando o botão "Nova receita".
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-8" />
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Descrição
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                  Competência
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Valor
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((income) => (
                <tr key={income.income_id} className="border-t">
                  <td className="px-4 py-2.5">
                    <AppIcon
                      iconId={income.icon_id}
                      size={15}
                      className="text-muted-foreground shrink-0"
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">{income.descricao}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">
                    {income.competencia}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[color:var(--color-success)] font-medium">
                    {brl(income.valor)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingIncome(income);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7",
                          deletingId === income.income_id
                            ? "text-destructive hover:text-destructive"
                            : "text-muted-foreground",
                        )}
                        disabled={deleteIncome.isPending}
                        onClick={async () => {
                          if (deletingId !== income.income_id) {
                            setDeletingId(income.income_id);
                            return;
                          }
                          await deleteIncome.mutateAsync(income.income_id);
                          setDeletingId(null);
                        }}
                        onBlur={() => {
                          if (deletingId === income.income_id) setDeletingId(null);
                        }}
                        title={deletingId === income.income_id ? "Confirmar exclusão" : "Excluir"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IncomeDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingIncome(null);
        }}
        income={editingIncome}
      />
    </div>
  );
}
