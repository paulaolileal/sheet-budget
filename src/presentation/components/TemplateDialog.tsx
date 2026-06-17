import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { IconPicker } from "./IconPicker";
import { ServiceLogo } from "./ServiceLogo";
import {
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useCategories,
  useAccounts,
} from "@/hooks/queries";
import { templateInputSchema, type TemplateFormInput } from "@/domain/schemas";
import { templateId } from "@/lib/idgen";
import type { RecurrenceTemplate } from "@/domain/types";

export function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: RecurrenceTemplate | null;
}) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const remove = useDeleteTemplate();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const isEditing = template !== null;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { control, handleSubmit, register, reset, watch, formState } = useForm<TemplateFormInput>({
    resolver: zodResolver(templateInputSchema),
    defaultValues: {
      nome: "",
      categoria_id: "",
      payment_account_id: null,
      considerar_resumo: true,
      primeira_competencia: "",
      ultima_competencia: undefined,
      logo_url: undefined,
      icon_id: undefined,
    },
  });

  const watchedLogoUrl = watch("logo_url");
  const watchedIconId = watch("icon_id");
  const watchedNome = watch("nome");

  useEffect(() => {
    if (open) {
      setConfirmingDelete(false);
      reset(
        template
          ? {
              nome: template.nome,
              categoria_id: template.categoria_id,
              payment_account_id: template.payment_account_id,
              considerar_resumo: template.considerar_resumo,
              primeira_competencia: template.primeira_competencia,
              ultima_competencia: template.ultima_competencia,
              logo_url: template.logo_url,
              icon_id: template.icon_id,
            }
          : {
              nome: "",
              categoria_id: "",
              payment_account_id: null,
              considerar_resumo: true,
              primeira_competencia: "",
              ultima_competencia: undefined,
              logo_url: undefined,
              icon_id: undefined,
            },
      );
    }
  }, [open, template, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (isEditing && template) {
      await update.mutateAsync({ ...template, ...values });
    } else {
      await create.mutateAsync({ template_id: templateId(values.nome), ...values });
    }
    onOpenChange(false);
  });

  async function handleDelete() {
    if (!template) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await remove.mutateAsync(template.template_id);
    onOpenChange(false);
  }

  const isPending = create.isPending || update.isPending || remove.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirmingDelete(false);
      }}
    >
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{isEditing ? "Editar recorrência" : "Nova recorrência"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados do template de recorrência."
              : "Crie um template que gerará lançamentos mensais automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div>
            <Label>Nome</Label>
            <Input {...register("nome")} autoFocus placeholder="Ex: Aluguel, Streaming..." />
            {formState.errors.nome && (
              <p className="text-xs text-destructive mt-1">{formState.errors.nome.message}</p>
            )}
          </div>

          <div>
            <Label>Categoria</Label>
            <Controller
              control={control}
              name="categoria_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.category_id} value={c.category_id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {formState.errors.categoria_id && (
              <p className="text-xs text-destructive mt-1">
                {formState.errors.categoria_id.message}
              </p>
            )}
          </div>

          <div>
            <Label>Conta de pagamento</Label>
            <Controller
              control={control}
              name="payment_account_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {(accounts ?? []).map((a) => (
                      <SelectItem key={a.account_id} value={a.account_id}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início (YYYY-MM)</Label>
              <Input {...register("primeira_competencia")} placeholder="2024-01" maxLength={7} />
              {formState.errors.primeira_competencia && (
                <p className="text-xs text-destructive mt-1">
                  {formState.errors.primeira_competencia.message}
                </p>
              )}
            </div>
            <div>
              <Label>Fim (YYYY-MM, opcional)</Label>
              <Input
                {...register("ultima_competencia", {
                  setValueAs: (v: string) => (v === "" ? undefined : v),
                })}
                placeholder="2024-12"
                maxLength={7}
              />
              {formState.errors.ultima_competencia && (
                <p className="text-xs text-destructive mt-1">
                  {formState.errors.ultima_competencia.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="considerar_resumo"
              render={({ field }) => (
                <Checkbox
                  id="considerar_resumo"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="considerar_resumo" className="cursor-pointer font-normal">
              Considerar no resumo
            </Label>
          </div>

          <div className="space-y-3 border-t pt-3">
            <div className="flex items-start gap-3">
              <ServiceLogo
                logoUrl={watchedLogoUrl}
                iconId={watchedIconId}
                nome={watchedNome || "?"}
                size={40}
              />
              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-xs">URL da logo (opcional)</Label>
                  <Input
                    {...register("logo_url")}
                    placeholder="https://exemplo.com/logo.png"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Ícone (se sem logo)</Label>
                  <div className="mt-1">
                    <Controller
                      control={control}
                      name="icon_id"
                      render={({ field }) => (
                        <IconPicker value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          </div>

          <DialogFooter className="gap-2 shrink-0 pt-4 border-t mt-2">
            {isEditing && (
              <Button
                type="button"
                variant={confirmingDelete ? "destructive" : "outline"}
                onClick={handleDelete}
                disabled={isPending}
                onBlur={() => setConfirmingDelete(false)}
              >
                {confirmingDelete ? "Confirmar exclusão" : "Excluir"}
              </Button>
            )}
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
