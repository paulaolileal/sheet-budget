import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { MonthYearPicker } from "./MonthYearPicker";
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
import { useCreateIncome, useUpdateIncome } from "@/hooks/queries";
import { incomeInputSchema, type IncomeInput } from "@/domain/schemas";
import { IconPicker } from "./IconPicker";
import { useUiStore } from "@/store/uiStore";
import type { Income } from "@/domain/types";
import { Calendar, AlignLeft, DollarSign, Tag } from "lucide-react";

export function IncomeDialog({
  open,
  onOpenChange,
  income,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  income: Income | null;
}) {
  const competencia = useUiStore((s) => s.competencia);
  const create = useCreateIncome();
  const update = useUpdateIncome();
  const isEditing = income !== null;

  const { control, handleSubmit, register, reset, formState } = useForm<IncomeInput>({
    resolver: zodResolver(incomeInputSchema),
    defaultValues: { competencia, descricao: "", valor: 0, icon_id: undefined },
  });

  useEffect(() => {
    if (open) {
      reset(
        income
          ? {
              competencia: income.competencia,
              descricao: income.descricao,
              valor: income.valor,
              icon_id: income.icon_id,
            }
          : { competencia, descricao: "", valor: 0, icon_id: undefined },
      );
    }
  }, [open, income, competencia, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (isEditing && income) {
      await update.mutateAsync({ id: income.income_id, patch: values });
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
          <DialogTitle>{isEditing ? "Editar receita" : "Nova receita"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados da receita."
              : "Adicione um salário, bônus ou outra entrada positiva."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Competência
            </Label>
            <Controller
              control={control}
              name="competencia"
              render={({ field }) => (
                <MonthYearPicker value={field.value} onChange={field.onChange} />
              )}
            />
            {formState.errors.competencia && (
              <p className="text-xs text-destructive mt-1">
                {formState.errors.competencia.message}
              </p>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-1.5">
              <AlignLeft className="h-3.5 w-3.5" />
              Descrição
            </Label>
            <Input
              {...register("descricao")}
              autoFocus
              placeholder="Ex: Salário, Freelance, Bônus..."
            />
            {formState.errors.descricao && (
              <p className="text-xs text-destructive mt-1">{formState.errors.descricao.message}</p>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Valor (R$)
            </Label>
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
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Tag className="h-3.5 w-3.5" />
              Ícone
            </Label>
            <Controller
              control={control}
              name="icon_id"
              render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
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
      </DialogContent>
    </Dialog>
  );
}
