import { useEffect } from "react";
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
import { IconPicker } from "./IconPicker";
import { useCreateCategory, useUpdateCategory } from "@/hooks/queries";
import { categoryInputSchema, type CategoryInput } from "@/domain/schemas";
import type { Category } from "@/domain/types";

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: Category | null;
}) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const isEditing = category !== null;

  const { control, handleSubmit, register, reset, formState } = useForm<CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: { nome: "", icon_id: undefined },
  });

  useEffect(() => {
    if (open) {
      reset(
        category
          ? { nome: category.nome, icon_id: category.icon_id }
          : { nome: "", icon_id: undefined },
      );
    }
  }, [open, category, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (isEditing && category) {
      await update.mutateAsync({ ...category, ...values });
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
          <DialogTitle>{isEditing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Altere os dados da categoria." : "Adicione uma categoria de gastos."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input {...register("nome")} autoFocus placeholder="Ex: Alimentação, Transporte..." />
            {formState.errors.nome && (
              <p className="text-xs text-destructive mt-1">{formState.errors.nome.message}</p>
            )}
          </div>

          <div>
            <Label className="mb-1.5 block">Ícone</Label>
            <Controller
              control={control}
              name="icon_id"
              render={({ field }) => (
                <IconPicker value={field.value} onChange={field.onChange} />
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
      </DialogContent>
    </Dialog>
  );
}
