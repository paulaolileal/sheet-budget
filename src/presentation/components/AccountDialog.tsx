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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateAccount, useUpdateAccount } from "@/hooks/queries";
import { accountInputSchema, type AccountInput } from "@/domain/schemas";
import { IconPicker } from "./IconPicker";
import type { Account, AccountTipo } from "@/domain/types";

const TIPO_LABELS: Record<AccountTipo, string> = {
  CONTA: "Conta bancária",
  CARTAO: "Cartão de crédito",
  CARTEIRA: "Carteira",
};

export function AccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account: Account | null;
}) {
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const isEditing = account !== null;

  const { control, handleSubmit, register, reset, formState, watch, setValue } =
    useForm<AccountInput>({
      resolver: zodResolver(accountInputSchema),
      defaultValues: { nome: "", tipo: "CONTA", icon_id: undefined, color: undefined },
    });

  const colorValue = watch("color");

  useEffect(() => {
    if (open) {
      reset(
        account
          ? { nome: account.nome, tipo: account.tipo, icon_id: account.icon_id, color: account.color }
          : { nome: "", tipo: "CONTA", icon_id: undefined, color: undefined },
      );
    }
  }, [open, account, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (isEditing && account) {
      await update.mutateAsync({ id: account.account_id, data: values });
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
          <DialogTitle>{isEditing ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados da conta."
              : "Adicione uma conta bancária, cartão ou carteira."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input {...register("nome")} autoFocus placeholder="Ex: Nubank, Bradesco..." />
            {formState.errors.nome && (
              <p className="text-xs text-destructive mt-1">{formState.errors.nome.message}</p>
            )}
          </div>

          <div>
            <Label>Tipo</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v as AccountTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TIPO_LABELS) as [AccountTipo, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Ícone</Label>
            <Controller
              control={control}
              name="icon_id"
              render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Cor do cartão</Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={colorValue ?? "#6366f1"}
                  onChange={(e) => setValue("color", e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                />
              </div>
              <span className="text-sm text-muted-foreground font-mono">
                {colorValue ?? "padrão"}
              </span>
              {colorValue && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setValue("color", undefined)}
                >
                  Remover
                </button>
              )}
            </div>
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
