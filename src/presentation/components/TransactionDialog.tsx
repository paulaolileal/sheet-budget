import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Switch } from "@/components/ui/switch";
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useCreateTemplate,
  useDeleteTransaction,
  useUpdateTransaction,
} from "@/hooks/queries";
import type { Transaction, TipoLancamento } from "@/domain/types";
import { useUiStore } from "@/store/uiStore";
import { competenciaSchema } from "@/domain/schemas";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const formSchema = z
  .object({
    descricao: z.string().trim().min(1, "Obrigatório").max(200),
    competencia: competenciaSchema,
    categoria_id: z.string().min(1, "Selecione"),
    payment_account_id: z.string().min(1, "Selecione"),
    valor_previsto: z.coerce.number().nonnegative("Inválido"),
    valor_final: z.union([z.coerce.number().nonnegative(), z.literal(""), z.nan()]).optional(),
    status: z.enum(["PLANEJADO", "AGENDADO", "PENDENTE", "PAGO", "CANCELADO", "IGNORADO"]),
    tipo_lancamento: z.enum(["RECORRENTE", "PARCELADO", "MANUAL"]),
    considerar_resumo: z.boolean(),
    parcelas: z.coerce.number().int().min(1).max(120).optional(),
  })
  .refine(
    (v) => v.status !== "PAGO" || (typeof v.valor_final === "number" && !Number.isNaN(v.valor_final)),
    { message: "valor_final é obrigatório quando status = PAGO", path: ["valor_final"] },
  );

type FormValues = z.infer<typeof formSchema>;

const CREATE_STATUSES = ["PENDENTE", "PAGO"] as const;
const ALL_STATUSES = ["PLANEJADO", "AGENDADO", "PENDENTE", "PAGO", "CANCELADO", "IGNORADO"] as const;

function nextCompetencia(c: string, offset: number) {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction?: Transaction;
}) {
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const create = useCreateTransaction();
  const createTemplate = useCreateTemplate();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const competencia = useUiStore((s) => s.competencia);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = !!transaction;

  const { control, handleSubmit, watch, register, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: transaction?.descricao ?? "",
      competencia: transaction?.competencia ?? competencia,
      categoria_id: transaction?.categoria_id ?? "",
      payment_account_id: transaction?.payment_account_id ?? "",
      valor_previsto: transaction?.valor_previsto ?? 0,
      valor_final: transaction?.valor_final ?? undefined,
      status: transaction?.status ?? "PENDENTE",
      tipo_lancamento: transaction?.tipo_lancamento ?? "MANUAL",
      considerar_resumo: transaction?.considerar_resumo ?? true,
      parcelas: 1,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        descricao: transaction?.descricao ?? "",
        competencia: transaction?.competencia ?? competencia,
        categoria_id: transaction?.categoria_id ?? "",
        payment_account_id: transaction?.payment_account_id ?? "",
        valor_previsto: transaction?.valor_previsto ?? 0,
        valor_final: transaction?.valor_final ?? undefined,
        status: transaction?.status ?? "PENDENTE",
        tipo_lancamento: transaction?.tipo_lancamento ?? "MANUAL",
        considerar_resumo: transaction?.considerar_resumo ?? true,
        parcelas: 1,
      });
      setConfirmDelete(false);
    }
  }, [open, transaction, competencia, reset]);

  const tipo = watch("tipo_lancamento");
  const status = watch("status");

  const showValorFinal = isEditing || status === "PAGO";

  const onSubmit = handleSubmit(async (values) => {
    const valorFinal =
      values.status === "PAGO" &&
      typeof values.valor_final === "number" &&
      !Number.isNaN(values.valor_final)
        ? values.valor_final
        : null;

    const base = {
      descricao: values.descricao,
      categoria_id: values.categoria_id,
      payment_account_id: values.payment_account_id,
      valor_previsto: values.valor_previsto,
      valor_final: valorFinal,
      status: values.status,
      considerar_resumo: values.considerar_resumo,
      tipo_lancamento: values.tipo_lancamento,
    };

    if (isEditing && transaction) {
      await update.mutateAsync({ id: transaction.transaction_id, patch: base });
      onOpenChange(false);
      return;
    }

    const descSlug = slugify(values.descricao);
    const numParcelas = values.parcelas ?? 1;

    if (values.tipo_lancamento === "RECORRENTE") {
      const templateId = `tpl-${descSlug}`;
      await createTemplate.mutateAsync({
        template_id: templateId,
        nome: values.descricao,
        categoria_id: values.categoria_id,
        payment_account_id: values.payment_account_id,
        considerar_resumo: values.considerar_resumo,
        ativo: true,
        primeira_competencia: values.competencia,
        valor_padrao: values.valor_previsto,
      });
      for (let i = 0; i < numParcelas; i++) {
        const comp = nextCompetencia(values.competencia, i);
        await create.mutateAsync({
          ...base,
          transaction_id: `tx-${comp}-${descSlug}`,
          competencia: comp,
          template_id: templateId,
          payment_group_id: null,
          origem: templateId,
        });
      }
      toast.success(
        numParcelas > 1
          ? `Template e ${numParcelas} lançamentos recorrentes criados`
          : "Template e lançamento recorrente criados",
      );
    } else if (values.tipo_lancamento === "PARCELADO" && numParcelas > 1) {
      const groupOrigem = `parcelado-${descSlug}`;
      for (let i = 0; i < numParcelas; i++) {
        const comp = nextCompetencia(values.competencia, i);
        await create.mutateAsync({
          ...base,
          transaction_id: `tx-${comp}-${descSlug}`,
          descricao: `${values.descricao} (${i + 1}/${numParcelas})`,
          competencia: comp,
          template_id: null,
          payment_group_id: null,
          origem: groupOrigem,
        });
      }
      toast.success(`${numParcelas} parcelas criadas`);
    } else {
      await create.mutateAsync({
        ...base,
        transaction_id: `tx-${values.competencia}-${descSlug}`,
        competencia: values.competencia,
        template_id: null,
        payment_group_id: null,
        origem: "manual",
      });
      toast.success("Lançamento criado");
    }

    reset();
    onOpenChange(false);
  });

  const statusOptions = isEditing ? ALL_STATUSES : CREATE_STATUSES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Alterações são salvas direto na fonte." : "Crie despesa única, recorrente ou parcelada."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label>Descrição</Label>
            <Input {...register("descricao")} autoFocus />
            {formState.errors.descricao && (
              <p className="text-xs text-destructive mt-1">{formState.errors.descricao.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Competência</Label>
              <Input type="month" {...register("competencia")} disabled={isEditing} />
              {formState.errors.competencia && (
                <p className="text-xs text-destructive mt-1">{formState.errors.competencia.message}</p>
              )}
            </div>
            <div>
              <Label>Tipo</Label>
              <Controller
                control={control}
                name="tipo_lancamento"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as TipoLancamento)}
                    disabled={isEditing}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                      <SelectItem value="RECORRENTE">Recorrente</SelectItem>
                      <SelectItem value="PARCELADO">Parcelado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {(tipo === "PARCELADO" || tipo === "RECORRENTE") && !isEditing && (
            <div>
              <Label>{tipo === "RECORRENTE" ? "Gerar instâncias (meses)" : "Número de parcelas"}</Label>
              <Input type="number" min={1} max={120} {...register("parcelas")} />
              <p className="text-xs text-muted-foreground mt-1">
                {tipo === "RECORRENTE"
                  ? "Serão criadas N instâncias mensais e um template de recorrência."
                  : "Serão criados N lançamentos a partir da competência informada."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Controller
                control={control}
                name="categoria_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.category_id} value={c.category_id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>Conta de pagamento</Label>
              <Controller
                control={control}
                name="payment_account_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(accounts ?? []).map((a) => (
                        <SelectItem key={a.account_id} value={a.account_id}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className={`grid gap-3 ${showValorFinal ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <Label>Valor previsto</Label>
              <Input type="number" step="0.01" {...register("valor_previsto")} />
            </div>
            {showValorFinal && (
              <div>
                <Label>Valor final</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("valor_final")}
                  placeholder={status === "PAGO" ? "obrigatório" : "—"}
                />
                {formState.errors.valor_final && (
                  <p className="text-xs text-destructive mt-1">
                    {formState.errors.valor_final.message as string}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 h-10">
              <Label htmlFor="cr" className="text-sm font-normal cursor-pointer">
                Considerar no resumo
              </Label>
              <Controller
                control={control}
                name="considerar_resumo"
                render={({ field }) => (
                  <Switch id="cr" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive mr-auto"
                onClick={async () => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  await remove.mutateAsync(transaction!.transaction_id);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {confirmDelete ? "Confirmar cancelamento" : "Cancelar lançamento"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || update.isPending || createTemplate.isPending}
            >
              {isEditing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
