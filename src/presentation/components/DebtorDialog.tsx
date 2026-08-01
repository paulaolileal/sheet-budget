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
import { useCreateDebtor, useUpdateDebtor } from "@/hooks/queries";
import { debtorInputSchema, type DebtorInput } from "@/domain/schemas";
import type { Debtor } from "@/domain/types";

export function DebtorDialog({
  open,
  onOpenChange,
  debtor,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  debtor: Debtor | null;
}) {
  const create = useCreateDebtor();
  const update = useUpdateDebtor();
  const isEditing = debtor !== null;

  const { handleSubmit, register, reset, formState } = useForm<DebtorInput>({
    resolver: zodResolver(debtorInputSchema),
    defaultValues: { nome: "", telefone: undefined },
  });

  useEffect(() => {
    if (open) {
      reset(
        debtor
          ? { nome: debtor.nome, telefone: debtor.telefone }
          : { nome: "", telefone: undefined },
      );
    }
  }, [open, debtor, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (isEditing && debtor) {
      await update.mutateAsync({ id: debtor.debtor_id, data: values });
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
          <DialogTitle>{isEditing ? "Editar devedor" : "Novo devedor"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados do devedor."
              : "Cadastre uma pessoa que te deve dinheiro."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input {...register("nome")} autoFocus placeholder="Ex: Pierry" />
            {formState.errors.nome && (
              <p className="text-xs text-destructive mt-1">{formState.errors.nome.message}</p>
            )}
          </div>

          <div>
            <Label>WhatsApp (com DDD)</Label>
            <Input {...register("telefone")} placeholder="Ex: 11999999999" />
            <p className="text-xs text-muted-foreground mt-1">
              Usado para montar o link de cobrança no WhatsApp.
            </p>
            {formState.errors.telefone && (
              <p className="text-xs text-destructive mt-1">{formState.errors.telefone.message}</p>
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
