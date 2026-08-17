import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Check, TrendingUp } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { MonthYearPicker } from "../components/MonthYearPicker";
import { PlanVerdictBadge, VERDICT_LABEL } from "../components/PlanVerdictBadge";
import { AmortizationChart } from "../components/AmortizationChart";
import { AmortizationTable } from "../components/AmortizationTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useAccounts,
  useCategories,
  useConfirmPurchasePlan,
  useCreatePurchasePlan,
  useDeletePurchasePlan,
  usePurchasePlans,
  useTransactions,
  useUpdatePurchasePlan,
} from "@/hooks/queries";
import { useMonthlyBalanceProjection } from "@/hooks/useMonthlyBalanceProjection";
import {
  buildPlanAmortization,
  evaluatePlanFit,
  nextCompetencias,
  suggestBestStartCompetencia,
} from "@/domain/purchasePlanning";
import { buildAmortizationTable, toMonthlyRate, totalInterest } from "@/lib/amortization";
import { competenciaSchema } from "@/domain/schemas";
import { AMORTIZATION_METHOD, RATE_PERIODICITY } from "@/domain/types";
import type { AmortizationMethod, PurchasePlan } from "@/domain/types";
import { brl, competenciaLabel, currentCompetencia, shiftCompetencia } from "@/utils/format";

const AMORT_LABEL: Record<AmortizationMethod, string> = {
  PRICE: "Price",
  SAC: "SAC",
  SEM_JUROS: "Sem juros",
};

const formSchema = z.object({
  nome: z.string().trim().min(1, "Obrigatório").max(120),
  descricao: z.string().trim().max(500).optional(),
  valor_compra: z.coerce.number().positive("Informe um valor"),
  taxa_juros: z.coerce.number().nonnegative(),
  taxa_juros_periodicidade: z.enum(RATE_PERIODICITY),
  numero_parcelas: z.coerce.number().int().min(1).max(120),
  forma_amortizacao: z.enum(AMORTIZATION_METHOD),
  competencia_inicio: competenciaSchema,
  margem_minima: z.coerce.number().nonnegative(),
  categoria_id: z.string().optional(),
  payment_account_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function defaultValues(existing?: PurchasePlan): FormValues {
  return {
    nome: existing?.nome ?? "",
    descricao: existing?.descricao ?? "",
    valor_compra: existing?.valor_compra ?? 0,
    taxa_juros: existing?.taxa_juros ?? 0.0199,
    taxa_juros_periodicidade: existing?.taxa_juros_periodicidade ?? "MENSAL",
    numero_parcelas: existing?.numero_parcelas ?? 12,
    forma_amortizacao: existing?.forma_amortizacao ?? "PRICE",
    competencia_inicio: existing?.competencia_inicio ?? shiftCompetencia(currentCompetencia(), 1),
    margem_minima: existing?.margem_minima ?? 0,
    categoria_id: existing?.categoria_id ?? "",
    payment_account_id: existing?.payment_account_id ?? "",
  };
}

export function PurchasePlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const isNew = planId === "novo";

  const { data: plans, isLoading: plansLoading } = usePurchasePlans();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: allTxs } = useTransactions();
  const projection = useMonthlyBalanceProjection(24);

  const plan = isNew ? undefined : plans?.find((p) => p.plan_id === planId);
  const notFound = !isNew && !plansLoading && !plan;
  const isConfirmed = plan?.status === "CONFIRMADO";

  const createPlan = useCreatePurchasePlan();
  const updatePlan = useUpdatePurchasePlan();
  const deletePlan = useDeletePurchasePlan();
  const confirmPlan = useConfirmPurchasePlan();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues(),
  });

  useEffect(() => {
    if (plan) reset(defaultValues(plan));
  }, [plan, reset]);

  const values = watch();

  const taxaMensal = toMonthlyRate(values.taxa_juros || 0, values.taxa_juros_periodicidade);

  const amortization = useMemo(
    () =>
      buildAmortizationTable({
        principal: values.valor_compra || 0,
        taxaMensal,
        parcelas: values.numero_parcelas || 1,
        metodo: values.forma_amortizacao,
      }),
    [values.valor_compra, taxaMensal, values.numero_parcelas, values.forma_amortizacao],
  );

  const evaluations = useMemo(() => {
    if (!projection || !competenciaSchema.safeParse(values.competencia_inicio).success) return [];
    return evaluatePlanFit({
      projection,
      amortization,
      competenciaInicio: values.competencia_inicio,
      margemMinima: values.margem_minima || 0,
    });
  }, [projection, amortization, values.competencia_inicio, values.margem_minima]);

  const suggestions = useMemo(() => {
    if (!projection) return [];
    return suggestBestStartCompetencia({
      projection,
      principal: values.valor_compra || 0,
      taxaMensal,
      parcelas: values.numero_parcelas || 1,
      metodo: values.forma_amortizacao,
      margemMinima: values.margem_minima || 0,
      candidateStarts: nextCompetencias(currentCompetencia(), 12),
    });
  }, [
    projection,
    values.valor_compra,
    taxaMensal,
    values.numero_parcelas,
    values.forma_amortizacao,
    values.margem_minima,
  ]);

  const bestSuggestion = suggestions[0];

  const comparison = useMemo(() => {
    const principal = values.valor_compra || 0;
    const parcelas = values.numero_parcelas || 1;
    return AMORTIZATION_METHOD.map((metodo) => ({
      metodo,
      total: totalInterest(buildAmortizationTable({ principal, taxaMensal, parcelas, metodo })),
    }));
  }, [values.valor_compra, taxaMensal, values.numero_parcelas]);

  const planTxs = useMemo(
    () => (allTxs ?? []).filter((t) => t.plan_id === plan?.plan_id),
    [allTxs, plan],
  );

  const desyncCount = useMemo(() => {
    if (!isConfirmed || !plan) return 0;
    return amortization.filter((row) => {
      const competencia = shiftCompetencia(plan.competencia_inicio, row.numero_parcela - 1);
      const match = planTxs.find((t) => t.competencia === competencia);
      return !match || Math.abs(match.valor - row.valor_parcela) > 0.01;
    }).length;
  }, [isConfirmed, plan, amortization, planTxs]);

  async function persist(data: FormValues, status: PurchasePlan["status"]): Promise<PurchasePlan> {
    const payload = {
      nome: data.nome,
      descricao: data.descricao || undefined,
      valor_compra: data.valor_compra,
      taxa_juros: data.taxa_juros,
      taxa_juros_periodicidade: data.taxa_juros_periodicidade,
      numero_parcelas: data.numero_parcelas,
      forma_amortizacao: data.forma_amortizacao,
      competencia_inicio: data.competencia_inicio,
      margem_minima: data.margem_minima,
      categoria_id: data.categoria_id || undefined,
      payment_account_id: data.payment_account_id || undefined,
      status,
    };
    if (plan) return updatePlan.mutateAsync({ id: plan.plan_id, patch: payload });
    return createPlan.mutateAsync(payload);
  }

  const onSaveDraft = handleSubmit(async (data) => {
    const saved = await persist(data, plan?.status ?? "SIMULANDO");
    if (isNew) navigate(`/planning/${saved.plan_id}`, { replace: true });
  });

  const onConfirm = handleSubmit(async (data) => {
    const saved = await persist(data, plan?.status ?? "SIMULANDO");
    const installments = buildAmortizationTable({
      principal: saved.valor_compra,
      taxaMensal: toMonthlyRate(saved.taxa_juros, saved.taxa_juros_periodicidade),
      parcelas: saved.numero_parcelas,
      metodo: saved.forma_amortizacao,
    });
    await confirmPlan.mutateAsync({ plan: saved, installments });
    navigate(`/planning/${saved.plan_id}`, { replace: true });
  });

  async function handleDelete() {
    if (!plan) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await deletePlan.mutateAsync(plan.plan_id);
    navigate("/planning", { replace: true });
  }

  const isPending = createPlan.isPending || updatePlan.isPending || confirmPlan.isPending;

  if (notFound) {
    return (
      <div className="px-4 py-4 md:p-8 max-w-4xl mx-auto text-center">
        <p className="text-sm text-muted-foreground mb-4">Planejamento não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/planning")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>
    );
  }

  if (!isNew && plansLoading) {
    return (
      <div className="px-4 py-4 md:p-8 max-w-4xl mx-auto space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title={plan?.nome || "Novo plano"}
        description="Simule parcelas, juros e veja se a compra cabe no seu orçamento."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/planning")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            {plan && !isConfirmed && (
              <Button
                variant={confirmingDelete ? "destructive" : "outline"}
                size="sm"
                onClick={handleDelete}
                onBlur={() => setConfirmingDelete(false)}
              >
                {confirmingDelete ? "Confirmar exclusão" : "Excluir"}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid md:grid-cols-[360px_1fr] gap-4 items-start">
        {/* Form column */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da compra</CardTitle>
            {isConfirmed && (
              <CardDescription className="text-xs">
                Compra confirmada — os parâmetros da simulação não podem mais ser alterados.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" placeholder="Ex: Carro" {...register("nome")} />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea id="descricao" rows={2} {...register("descricao")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valor_compra">Valor da compra</Label>
              <Input
                id="valor_compra"
                type="number"
                step="0.01"
                disabled={isConfirmed}
                {...register("valor_compra", { valueAsNumber: true })}
              />
              {errors.valor_compra && (
                <p className="text-xs text-destructive">{errors.valor_compra.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="taxa_juros">Taxa de juros</Label>
                <Input
                  id="taxa_juros"
                  type="number"
                  step="0.0001"
                  disabled={isConfirmed}
                  {...register("taxa_juros", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Periodicidade</Label>
                <Controller
                  control={control}
                  name="taxa_juros_periodicidade"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isConfirmed}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MENSAL">Mensal</SelectItem>
                        <SelectItem value="ANUAL">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero_parcelas">Número de parcelas</Label>
              <Input
                id="numero_parcelas"
                type="number"
                min={1}
                max={120}
                disabled={isConfirmed}
                {...register("numero_parcelas", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Forma de amortização</Label>
              <Controller
                control={control}
                name="forma_amortizacao"
                render={({ field }) => (
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList className="w-full grid grid-cols-3">
                      {AMORTIZATION_METHOD.map((m) => (
                        <TabsTrigger key={m} value={m} disabled={isConfirmed}>
                          {AMORT_LABEL[m]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Competência de início</Label>
              <Controller
                control={control}
                name="competencia_inicio"
                render={({ field }) => (
                  <MonthYearPicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isConfirmed}
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="margem_minima">Margem/reserva mínima desejada por mês</Label>
              <Input
                id="margem_minima"
                type="number"
                step="0.01"
                disabled={isConfirmed}
                {...register("margem_minima", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Categoria (opcional)</Label>
              <Controller
                control={control}
                name="categoria_id"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
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

            <div className="space-y-1.5">
              <Label>Conta/cartão (opcional)</Label>
              <Controller
                control={control}
                name="payment_account_id"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
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

            <div className="flex flex-col gap-2 pt-2">
              <Button type="button" onClick={onSaveDraft} disabled={isPending}>
                Salvar rascunho
              </Button>
              {!isConfirmed && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="secondary" disabled={isPending}>
                      <Check className="h-4 w-4 mr-1" />
                      Confirmar compra
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar esta compra?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Serão criadas {values.numero_parcelas || 0} transações parceladas em
                        Lançamentos, a partir de {competenciaLabel(values.competencia_inicio)}, com
                        os valores calculados por {AMORT_LABEL[values.forma_amortizacao]}. Essa ação
                        não pode ser desfeita automaticamente — só editando cada lançamento
                        manualmente depois.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onConfirm()}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Simulation column */}
        <div className="space-y-4">
          {isConfirmed && (
            <Card className="border-[color:var(--color-success)]/40">
              <CardContent className="py-4 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm">
                  <span className="font-medium">Compra confirmada.</span>{" "}
                  <span className="text-muted-foreground">
                    {planTxs.length} lançamento(s) em Lançamentos vinculados a este plano.
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/transactions")}>
                  Ver lançamentos
                </Button>
              </CardContent>
              {desyncCount > 0 && (
                <CardContent className="pt-0 text-xs text-amber-600">
                  {desyncCount} de {amortization.length} parcela(s) foram alteradas ou removidas
                  desde a confirmação.
                </CardContent>
              )}
            </Card>
          )}

          {bestSuggestion && !isConfirmed && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Melhor competência para começar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-semibold tabular-nums">
                    {competenciaLabel(bestSuggestion.competencia)}
                  </span>
                  <Badge variant="outline" className="font-normal">
                    {VERDICT_LABEL[bestSuggestion.veredito]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {bestSuggestion.veredito === "nao_cabe"
                    ? "Nenhuma das próximas competências cabe com folga — considere reduzir o valor ou aumentar o número de parcelas."
                    : `Com a parcela calculada, a menor margem livre ao longo do financiamento fica em ${brl(bestSuggestion.piorMargem)}.`}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setValue("competencia_inicio", bestSuggestion.competencia)}
                >
                  Usar esta competência
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div>
                <CardTitle className="text-base">Evolução do saldo devedor</CardTitle>
                <CardDescription>
                  Parcela de {brl(amortization[0]?.valor_parcela ?? 0)} ·{" "}
                  {AMORT_LABEL[values.forma_amortizacao]}
                </CardDescription>
              </div>
              {evaluations.length > 0 && <PlanVerdictBadge evaluations={evaluations} />}
            </CardHeader>
            <CardContent className="h-64">
              <AmortizationChart rows={amortization} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Parcelas</CardTitle>
              <CardDescription>
                Detalhamento mês a mês, com o veredito de cada competência.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AmortizationTable rows={amortization} evaluations={evaluations} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comparar formas de amortização</CardTitle>
              <CardDescription>
                Total de juros pago para o mesmo valor e número de parcelas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {comparison.map((c) => (
                <div
                  key={c.metodo}
                  className={`rounded-md border p-3 text-center ${
                    c.metodo === values.forma_amortizacao ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="text-xs text-muted-foreground">{AMORT_LABEL[c.metodo]}</div>
                  <div className="text-sm font-semibold tabular-nums mt-1">{brl(c.total)}</div>
                  <div className="text-[10px] text-muted-foreground">juros total</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
