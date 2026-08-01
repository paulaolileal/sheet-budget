import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { useCreateDebt, useUpdateDebt } from "@/hooks/queries";
import { debtInputSchema, type DebtInput } from "@/domain/schemas";
import { useUiStore } from "@/store/uiStore";
import type { Debt } from "@/domain/types";

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
  const isEditing = debt !== null;

  const { handleSubmit, register, reset, formState } = useForm<DebtInput>({
    resolver: zodResolver(debtInputSchema),
    defaultValues: {
      debtor_id: debtorId ?? "",
      competencia,
      descricao: "",
      valor: 0,
      status: "PENDENTE",
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
            }
          : {
              debtor_id: debtorId ?? "",
              competencia,
              descricao: "",
              valor: 0,
              status: "PENDENTE",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
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
              <p className="text-xs text-destructive mt-1">{formState.errors.descricao.message}</p>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEditing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
