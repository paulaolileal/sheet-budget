import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPicker } from "./IconPicker";
import { cn } from "@/lib/utils";
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
import { AlignLeft, FolderOpen, Wallet, Calendar, CalendarOff, Link, Tag, Repeat } from "lucide-react";

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
  const [iconMode, setIconMode] = useState(false);

  const { control, handleSubmit, register, reset, watch, setValue, formState } =
    useForm<TemplateFormInput>({
      resolver: zodResolver(templateInputSchema),
      defaultValues: {
        nome: "",
        categoria_id: "",
        payment_account_id: null,
        primeira_competencia: "",
        ultima_competencia: undefined,
        logo_url: undefined,
        icon_id: undefined,
        recurrence_type: "M",
      },
    });

  const watchedLogoUrl = watch("logo_url");
  const watchedIconId = watch("icon_id");
  const watchedNome = watch("nome");

  useEffect(() => {
    if (open) {
      setConfirmingDelete(false);
      setIconMode(template ? !!template.icon_id && !template.logo_url : false);
      reset(
        template
          ? {
              nome: template.nome,
              categoria_id: template.categoria_id,
              payment_account_id: template.payment_account_id,
              primeira_competencia: template.primeira_competencia,
              ultima_competencia: template.ultima_competencia,
              logo_url: template.logo_url,
              icon_id: template.icon_id,
              recurrence_type: template.recurrence_type ?? "M",
            }
          : {
              nome: "",
              categoria_id: "",
              payment_account_id: null,
              primeira_competencia: "",
              ultima_competencia: undefined,
              logo_url: undefined,
              icon_id: undefined,
              recurrence_type: "M",
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

  function handleModeSwitch(toIcon: boolean) {
    setIconMode(toIcon);
    if (toIcon) setValue("logo_url", undefined);
    else setValue("icon_id", undefined);
  }

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
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md flex flex-col max-h-[90vh]">
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
              <Label className="flex items-center gap-1.5">
                <AlignLeft className="h-3.5 w-3.5" />
                Nome
              </Label>
              <Input {...register("nome")} autoFocus placeholder="Ex: Aluguel, Streaming..." />
              {formState.errors.nome && (
                <p className="text-xs text-destructive mt-1">{formState.errors.nome.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Categoria
                </Label>
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
                <Label className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Conta de pagamento
                </Label>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Início
                </Label>
                <Controller
                  control={control}
                  name="primeira_competencia"
                  render={({ field }) => (
                    <MonthYearPicker value={field.value} onChange={field.onChange} />
                  )}
                />
                {formState.errors.primeira_competencia && (
                  <p className="text-xs text-destructive mt-1">
                    {formState.errors.primeira_competencia.message}
                  </p>
                )}
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <CalendarOff className="h-3.5 w-3.5" />
                  Fim (opcional)
                </Label>
                <Controller
                  control={control}
                  name="ultima_competencia"
                  render={({ field }) => (
                    <MonthYearPicker
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v === "" ? undefined : v)}
                      placeholder="Sem término"
                      optional
                    />
                  )}
                />
                {formState.errors.ultima_competencia && (
                  <p className="text-xs text-destructive mt-1">
                    {formState.errors.ultima_competencia.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                Tipo de recorrência
              </Label>
              <Controller
                control={control}
                name="recurrence_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Mensal</SelectItem>
                      <SelectItem value="A">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center gap-2">
                <ServiceLogo
                  logoUrl={watchedLogoUrl}
                  iconId={watchedIconId}
                  nome={watchedNome || "?"}
                  size={36}
                />

                <div className="inline-flex rounded-md border text-xs shrink-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch(false)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 transition-colors",
                      !iconMode
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50",
                    )}
                  >
                    <Link size={11} />
                    URL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch(true)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 border-l transition-colors",
                      iconMode
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50",
                    )}
                  >
                    <Tag size={11} />
                    Ícone
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  {iconMode ? (
                    <Controller
                      control={control}
                      name="icon_id"
                      render={({ field }) => (
                        <IconPicker value={field.value} onChange={field.onChange} />
                      )}
                    />
                  ) : (
                    <Input
                      {...register("logo_url")}
                      placeholder="https://exemplo.com/logo.png"
                      className="h-8 text-sm"
                    />
                  )}
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
