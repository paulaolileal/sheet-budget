import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { useCreateDebt, useDebts, useDeleteDebt, useUpdateDebt } from "@/hooks/queries";
import { debtInputSchema, type DebtInput } from "@/domain/schemas";
import { useUiStore } from "@/store/uiStore";
import { brl, competenciaLabel } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { Debt, DebtTipo } from "@/domain/types";
import { MonthYearPicker } from "./MonthYearPicker";

export function DebtDialog({
  open,
  onOpenChange,
  debtorId,
  debt,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  debtorId: string | null;
  debt: Debt | null;
}) {
  const competencia = useUiStore((s) => s.competencia);
  const create = useCreateDebt();
  const update = useUpdateDebt();
  const deleteDebt = useDeleteDebt();
  const { data: allDebts } = useDebts();
  const isEditing = debt !== null;

  // "EMPRESTIMO" debts are a chain of rows in the same sheet: the root row (no
  // parent_debt_id) holds the principal, and each abatement is a new row pointing
  // back at the root via parent_debt_id, holding the balance left after it.
  const rootId = debt ? (debt.parent_debt_id ?? debt.debt_id) : null;
  const loanChain = useMemo(() => {
    if (!debt || debt.tipo !== "EMPRESTIMO" || !rootId || !allDebts) return [];
    return allDebts
      .filter((d) => d.debt_id === rootId || d.parent_debt_id === rootId)
      .sort(
        (a, b) => a.competencia.localeCompare(b.competencia) || a.debt_id.localeCompare(b.debt_id),
      );
  }, [allDebts, debt, rootId]);

  // Any existing "EMPRESTIMO" debt opens into the loan view (balance + abatement
  // form + history) instead of the generic edit form — descricao/valor on the
  // root row aren't directly editable once created, to keep the running balance
  // in the chain consistent. Only brand-new debts use the generic form.
  const isLoanView = debt?.tipo === "EMPRESTIMO";
  const currentBalance = loanChain.length > 0 ? loanChain[loanChain.length - 1].valor : 0;
  const chainWithDeltas = useMemo(
    () =>
      loanChain.map((entry, i) => ({
        entry,
        delta: i === 0 ? null : loanChain[i - 1].valor - entry.valor,
      })),
    [loanChain],
  );

  const { control, handleSubmit, register, reset, formState } = useForm<DebtInput>({
    resolver: zodResolver(debtInputSchema),
    defaultValues: {
      debtor_id: debtorId ?? "",
      competencia,
      descricao: "",
      valor: 0,
      status: "PENDENTE",
      tipo: "UNICO",
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        debt
          ? {
              debtor_id: debt.debtor_id,
              competencia: debt.competencia,
              descricao: debt.descricao,
              valor: debt.valor,
              status: debt.status,
              tipo: debt.tipo,
              parent_debt_id: debt.parent_debt_id,
            }
          : {
              debtor_id: debtorId ?? "",
              competencia,
              descricao: "",
              valor: 0,
              status: "PENDENTE",
              tipo: "UNICO",
            },
      );
    }
  }, [open, debt, debtorId, competencia, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (isEditing && debt) {
      await update.mutateAsync({ id: debt.debt_id, patch: values });
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  });

  const isPending = create.isPending || update.isPending;

  const [abateValor, setAbateValor] = useState("");
  const [abateCompetencia, setAbateCompetencia] = useState(competencia);
  const [abateError, setAbateError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAbateValor("");
      setAbateCompetencia(competencia);
      setAbateError(null);
    }
  }, [open, competencia]);

  async function handleAbater() {
    setAbateError(null);
    const rootDebt = loanChain.find((d) => d.debt_id === rootId);
    if (!rootDebt || !rootId) return;
    const valorNum = Number(abateValor.replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setAbateError("Informe um valor maior que zero.");
      return;
    }
    if (valorNum > currentBalance) {
      setAbateError(`O abatimento não pode ser maior que o saldo atual (${brl(currentBalance)}).`);
      return;
    }
    await create.mutateAsync({
      debtor_id: rootDebt.debtor_id,
      competencia: abateCompetencia,
      descricao: rootDebt.descricao,
      valor: currentBalance - valorNum,
      status: "PENDENTE",
      tipo: "EMPRESTIMO",
      parent_debt_id: rootId,
    });
    setAbateValor("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
        {isLoanView && debt ? (
          <>
            <DialogHeader>
              <DialogTitle>{debt.descricao}</DialogTitle>
              <DialogDescription>Empréstimo — histórico de abatimentos.</DialogDescription>
            </DialogHeader>

            <div className="rounded-md bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo atual</p>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  currentBalance <= 0 && "text-[color:var(--color-success)]",
                )}
              >
                {brl(currentBalance)}
              </p>
              {currentBalance <= 0 && (
                <p className="text-xs text-[color:var(--color-success)] mt-1">Quitado</p>
              )}
            </div>

            {currentBalance > 0 && (
              <div className="space-y-2 border rounded-md p-3">
                <Label className="text-xs">Abater valor</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={currentBalance}
                    placeholder="0,00"
                    value={abateValor}
                    onChange={(e) => setAbateValor(e.target.value)}
                  />
                  <div className="w-36 shrink-0">
                    <MonthYearPicker value={abateCompetencia} onChange={setAbateCompetencia} />
                  </div>
                </div>
                {abateError && <p className="text-xs text-destructive">{abateError}</p>}
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={create.isPending || !abateValor}
                  onClick={handleAbater}
                >
                  {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Registrar abatimento
                </Button>
              </div>
            )}

            <div>
              <Label className="text-xs">Histórico</Label>
              <ul className="mt-1 max-h-48 overflow-y-auto divide-y text-sm border rounded-md">
                {[...chainWithDeltas].reverse().map(({ entry, delta }) => {
                  const isRoot = entry.debt_id === rootId;
                  const isDeletingThis =
                    deleteDebt.isPending && deleteDebt.variables === entry.debt_id;
                  return (
                    <li
                      key={entry.debt_id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="tabular-nums font-medium">{brl(entry.valor)}</p>
                        <p className="text-xs text-muted-foreground">
                          {competenciaLabel(entry.competencia)} ·{" "}
                          {isRoot ? "Empréstimo inicial" : `Abatimento de ${brl(delta ?? 0)}`}
                        </p>
                      </div>
                      {!isRoot && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground"
                          disabled={deleteDebt.isPending}
                          onClick={() => deleteDebt.mutate(entry.debt_id)}
                          title="Excluir este abatimento"
                        >
                          {isDeletingThis ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar dívida" : "Nova dívida"}</DialogTitle>
              <DialogDescription>
                {isEditing ? "Altere a descrição ou o valor." : "Adicione um lançamento a receber."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label>Descrição</Label>
                <Input {...register("descricao")} autoFocus placeholder="Ex: Spotify Família" />
                {formState.errors.descricao && (
                  <p className="text-xs text-destructive mt-1">
                    {formState.errors.descricao.message}
                  </p>
                )}
              </div>

              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register("valor", { valueAsNumber: true })}
                  placeholder="0,00"
                />
                {formState.errors.valor && (
                  <p className="text-xs text-destructive mt-1">{formState.errors.valor.message}</p>
                )}
              </div>

              <div>
                <Label>Tipo</Label>
                <Controller
                  control={control}
                  name="tipo"
                  render={({ field }) => (
                    <>
                      <Select
                        value={field.value}
                        onValueChange={(v) => field.onChange(v as DebtTipo)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNICO">Única</SelectItem>
                          <SelectItem value="RECORRENTE">Recorrente</SelectItem>
                          <SelectItem value="EMPRESTIMO">Empréstimo (valor acumulado)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {field.value === "EMPRESTIMO"
                          ? "O valor é o total emprestado. Aparece todo mês até ser quitado — abra a dívida depois de criada para lançar abatimentos."
                          : "Dívidas recorrentes podem ser copiadas para o próximo mês."}
                      </p>
                    </>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isEditing ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
