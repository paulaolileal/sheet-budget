import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { MonthYearPicker } from "./MonthYearPicker";
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
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useCreateTemplate,
  useDeleteTransaction,
  useTemplates,
  useTransactions,
  useUpdateTransaction,
  useUpdateTransactionSeries,
} from "@/hooks/queries";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Transaction, TipoLancamento, TransactionStatus } from "@/domain/types";
import { useUiStore } from "@/store/uiStore";
import { competenciaSchema } from "@/domain/schemas";
import {
  Trash2,
  AlignLeft,
  Calendar,
  Layers,
  Hash,
  FolderOpen,
  Wallet,
  DollarSign,
  CircleDot,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  descricao: z.string().trim().min(1, "Obrigatório").max(200),
  competencia: competenciaSchema,
  categoria_id: z.string().min(1, "Selecione"),
  payment_account_id: z.string().min(1, "Selecione"),
  valor: z.coerce.number().nonnegative("Inválido"),
  valor_total: z.coerce.number().nonnegative().optional(),
  status: z.enum(["PENDENTE", "PAGO", "ADIANTADO", "IGNORADO"]),
  tipo_lancamento: z.enum(["RECORRENTE", "PARCELADO", "MANUAL"]),
  parcelas: z.coerce.number().int().min(1).max(120).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const STATUSES = ["PENDENTE", "PAGO", "ADIANTADO", "IGNORADO"] as const;

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
  draft,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction?: Transaction;
  /**
   * Pre-fills the "new transaction" form (ignored when editing an existing
   * `transaction`). Used by `ShareTargetPage` to seed values extracted from a
   * shared receipt — categoria/conta are intentionally left out, they still
   * require the user to pick.
   */
  draft?: {
    descricao?: string;
    valor?: number;
    competencia?: string;
    status?: TransactionStatus;
  };
}) {
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: allTransactions = [] } = useTransactions();
  const { data: templates = [] } = useTemplates();
  const create = useCreateTransaction();
  const createTemplate = useCreateTemplate();
  const update = useUpdateTransaction();
  const updateSeries = useUpdateTransactionSeries();
  const remove = useDeleteTransaction();
  const competencia = useUiStore((s) => s.competencia);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [scopeDialog, setScopeDialog] = useState<{
    patch: Partial<Transaction>;
  } | null>(null);

  const serie = useMemo(() => {
    if (!transaction) return [];
    if (transaction.template_id) {
      return allTransactions.filter((tx) => tx.template_id === transaction.template_id);
    }
    if (transaction.tipo_lancamento === "PARCELADO") {
      const baseDesc = transaction.descricao.replace(/\s*\(\d+\/\d+\)$/, "").trim();
      return allTransactions.filter(
        (tx) =>
          tx.tipo_lancamento === "PARCELADO" &&
          tx.descricao.replace(/\s*\(\d+\/\d+\)$/, "").trim() === baseDesc,
      );
    }
    return [transaction];
  }, [allTransactions, transaction]);

  const debtSummary = useMemo(() => {
    if (!transaction) return null;
    const txComp = transaction.competencia;
    const txYear = txComp.slice(0, 4);
    const total = serie
      .filter((tx) => tx.competencia <= txComp)
      .reduce((sum, tx) => sum + tx.valor, 0);
    const noAno = serie
      .filter((tx) => tx.competencia.startsWith(txYear) && tx.competencia <= txComp)
      .reduce((sum, tx) => sum + tx.valor, 0);
    const restante = serie
      .filter((tx) => tx.competencia > txComp)
      .reduce((sum, tx) => sum + tx.valor, 0);
    return { total, noAno, restante };
  }, [serie, transaction]);

  const isEditing = !!transaction;

  const { control, handleSubmit, watch, register, reset, setValue, formState } =
    useForm<FormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        descricao: transaction?.descricao ?? draft?.descricao ?? "",
        competencia: transaction?.competencia ?? draft?.competencia ?? competencia,
        categoria_id: transaction?.categoria_id ?? "",
        payment_account_id: transaction?.payment_account_id ?? "",
        valor: transaction?.valor ?? draft?.valor ?? 0,
        valor_total: 0,
        status: transaction?.status ?? draft?.status ?? "PENDENTE",
        tipo_lancamento: transaction?.tipo_lancamento ?? "MANUAL",
        parcelas: 1,
      },
    });

  useEffect(() => {
    if (open) {
      reset({
        descricao: transaction?.descricao ?? draft?.descricao ?? "",
        competencia: transaction?.competencia ?? draft?.competencia ?? competencia,
        categoria_id: transaction?.categoria_id ?? "",
        payment_account_id: transaction?.payment_account_id ?? "",
        valor: transaction?.valor ?? draft?.valor ?? 0,
        valor_total: 0,
        status: transaction?.status ?? draft?.status ?? "PENDENTE",
        tipo_lancamento: transaction?.tipo_lancamento ?? "MANUAL",
        parcelas: 1,
      });
      setConfirmDelete(false);
      setSummaryOpen(false);
    }
  }, [open, transaction, competencia, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const tipo = watch("tipo_lancamento");
  const numParcelas = watch("parcelas") ?? 1;

  const showParcelaFields = tipo === "PARCELADO" && numParcelas > 1 && !isEditing;

  const onSubmit = handleSubmit(async (values) => {
    const base = {
      descricao: values.descricao,
      categoria_id: values.categoria_id,
      payment_account_id: values.payment_account_id,
      valor: values.valor,
      status: values.status,
      tipo_lancamento: values.tipo_lancamento,
    };

    if (isEditing && transaction) {
      // Only include fields the user actually changed, so propagating to a
      // series (this-and-future/all) never touches untouched fields.
      const patch: Partial<Transaction> = {};
      if (values.descricao !== transaction.descricao) patch.descricao = values.descricao;
      if (values.categoria_id !== transaction.categoria_id)
        patch.categoria_id = values.categoria_id;
      if (values.payment_account_id !== transaction.payment_account_id)
        patch.payment_account_id = values.payment_account_id;
      if (values.valor !== transaction.valor) patch.valor = values.valor;
      if (values.tipo_lancamento !== transaction.tipo_lancamento)
        patch.tipo_lancamento = values.tipo_lancamento;
      if (values.status !== transaction.status) patch.status = values.status;
      if (values.competencia !== transaction.competencia) patch.competencia = values.competencia;

      const hasSeries = serie.length > 1;
      const seriesFieldChanged =
        patch.descricao !== undefined ||
        patch.categoria_id !== undefined ||
        patch.payment_account_id !== undefined ||
        patch.valor !== undefined ||
        patch.tipo_lancamento !== undefined;

      if (hasSeries && seriesFieldChanged) {
        setScopeDialog({ patch });
        return;
      }

      await update.mutateAsync({ id: transaction.transaction_id, patch });
      onOpenChange(false);
      return;
    }

    const descSlug = slugify(values.descricao);
    const n = values.parcelas ?? 1;

    if (values.tipo_lancamento === "RECORRENTE") {
      const templateId = `tpl-${descSlug}`;
      await createTemplate.mutateAsync({
        template_id: templateId,
        nome: values.descricao,
        categoria_id: values.categoria_id,
        payment_account_id: values.payment_account_id,
        primeira_competencia: values.competencia,
        recurrence_type: "M",
      });
      for (let i = 0; i < n; i++) {
        const comp = nextCompetencia(values.competencia, i);
        await create.mutateAsync({
          ...base,
          transaction_id: `tx-${comp}-${descSlug}`,
          competencia: comp,
          template_id: templateId,
        });
      }
      toast.success(
        n > 1
          ? `Template e ${n} lançamentos recorrentes criados`
          : "Template e lançamento recorrente criados",
      );
    } else if (values.tipo_lancamento === "PARCELADO" && n > 1) {
      for (let i = 0; i < n; i++) {
        const comp = nextCompetencia(values.competencia, i);
        await create.mutateAsync({
          ...base,
          transaction_id: `tx-${comp}-${descSlug}`,
          descricao: values.descricao,
          competencia: comp,
          template_id: null,
        });
      }
      toast.success(`${n} parcelas criadas`);
    } else {
      await create.mutateAsync({
        ...base,
        transaction_id: `tx-${values.competencia}-${descSlug}`,
        competencia: values.competencia,
        template_id: null,
      });
      toast.success("Lançamento criado");
    }

    reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Alterações são salvas direto na fonte."
              : "Crie despesa única, recorrente ou parcelada."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {isEditing && debtSummary && (
            <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-xs text-muted-foreground border rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <span>Resumo da série</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${summaryOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-3 divide-x border border-t-0 rounded-b-md bg-muted/30">
                  {(
                    [
                      { label: "Total", value: debtSummary.total },
                      { label: "No ano", value: debtSummary.noAno },
                      { label: "Restante", value: debtSummary.restante },
                    ] as const
                  ).map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center py-3 px-2 gap-1">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        {label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div>
            <Label className="flex items-center gap-1.5">
              <AlignLeft className="h-3.5 w-3.5" />
              Descrição
            </Label>
            <Input {...register("descricao")} autoFocus />
            {formState.errors.descricao && (
              <p className="text-xs text-destructive mt-1">{formState.errors.descricao.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Tipo
              </Label>
              <Controller
                control={control}
                name="tipo_lancamento"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as TipoLancamento)}
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUAL">À vista</SelectItem>
                      <SelectItem value="RECORRENTE">Recorrente</SelectItem>
                      <SelectItem value="PARCELADO">Parcelado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
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
          </div>

          {(tipo === "PARCELADO" || tipo === "RECORRENTE") && !isEditing && (
            <div>
              <Label className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                {tipo === "RECORRENTE" ? "Gerar instâncias (meses)" : "Número de parcelas"}
              </Label>
              <Controller
                control={control}
                name="parcelas"
                render={({ field }) => (
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      const n = parseInt(e.target.value) || 1;
                      if (tipo === "PARCELADO" && n > 1) {
                        const currentValor = watch("valor");
                        setValue("valor_total", parseFloat((currentValor * n).toFixed(2)));
                      }
                    }}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {tipo === "RECORRENTE"
                  ? "Serão criadas N instâncias mensais e um template de recorrência."
                  : "Serão criados N lançamentos a partir da competência informada."}
              </p>
            </div>
          )}

          {showParcelaFields ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Valor da parcela
                </Label>
                <Controller
                  control={control}
                  name="valor"
                  render={({ field }) => (
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        const v = parseFloat(e.target.value) || 0;
                        setValue("valor_total", parseFloat((v * numParcelas).toFixed(2)));
                      }}
                    />
                  )}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Valor total
                </Label>
                <Controller
                  control={control}
                  name="valor_total"
                  render={({ field }) => (
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        const total = parseFloat(e.target.value) || 0;
                        setValue("valor", parseFloat((total / numParcelas).toFixed(2)));
                      }}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground mt-1">Calculado automaticamente</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Valor
                </Label>
                <Input type="number" step="0.01" {...register("valor")} />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5" />
                  Status
                </Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          )}

          {showParcelaFields && (
            <div>
              <Label className="flex items-center gap-1.5">
                <CircleDot className="h-3.5 w-3.5" />
                Status
              </Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.category_id} value={c.category_id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
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
                {confirmDelete ? "Confirmar exclusão" : "Excluir lançamento"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              type="submit"
              disabled={
                create.isPending ||
                update.isPending ||
                createTemplate.isPending ||
                updateSeries.isPending
              }
            >
              {isEditing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={!!scopeDialog} onOpenChange={(o) => !o && setScopeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar série</AlertDialogTitle>
            <AlertDialogDescription>
              Este lançamento faz parte de uma série. O que deseja atualizar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={async () => {
                if (!scopeDialog || !transaction) return;
                await updateSeries.mutateAsync({
                  transaction,
                  patch: scopeDialog.patch,
                  scope: "only_this",
                  allTransactions,
                  templates,
                });
                setScopeDialog(null);
                onOpenChange(false);
              }}
              disabled={updateSeries.isPending}
            >
              Somente este
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!scopeDialog || !transaction) return;
                await updateSeries.mutateAsync({
                  transaction,
                  patch: scopeDialog.patch,
                  scope: "this_and_future",
                  allTransactions,
                  templates,
                });
                setScopeDialog(null);
                onOpenChange(false);
              }}
              disabled={updateSeries.isPending}
            >
              Esse e os próximos
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!scopeDialog || !transaction) return;
                await updateSeries.mutateAsync({
                  transaction,
                  patch: scopeDialog.patch,
                  scope: "all",
                  allTransactions,
                  templates,
                });
                setScopeDialog(null);
                onOpenChange(false);
              }}
              disabled={updateSeries.isPending}
            >
              Todos da série
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
