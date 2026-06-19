import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MONTH_ABBR = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "../components/PageHeader";
import { CompetenciaSelector } from "../components/CompetenciaSelector";
import { useUiStore } from "@/store/uiStore";
import {
  useAccounts,
  useCategories,
  useIncomes,
  useInvoiceAmounts,
  useTransactions,
} from "@/hooks/queries";
import { brl, centeredMonthRange, competenciaLabel } from "@/utils/format";

export function DashboardPage() {
  const competencia = useUiStore((s) => s.competencia);
  const { data: txs, isLoading } = useTransactions();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: incomes } = useIncomes();
  const { data: invoiceAmounts } = useInvoiceAmounts();

  const [summaryStart, setSummaryStart] = useState(() => centeredMonthRange(competencia, 3)[0]);
  const [summaryEnd, setSummaryEnd] = useState(() => centeredMonthRange(competencia, 3)[6]);

  const rangeMonths = useMemo(() => {
    const result: string[] = [];
    let current = summaryStart;
    if (current > summaryEnd) return result;
    while (current <= summaryEnd) {
      result.push(current);
      const y = Number(current.slice(0, 4));
      const m = Number(current.slice(5));
      const next = new Date(y, m, 1);
      current = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    }
    return result;
  }, [summaryStart, summaryEnd]);

  const filtered = useMemo(
    () =>
      (txs ?? []).filter(
        (t) => t.competencia === competencia && (t.status === "PAGO" || t.status === "PENDENTE"),
      ),
    [txs, competencia],
  );

  const totalPrevisto = filtered.reduce((s, t) => s + t.valor, 0);
  const totalPago = filtered.filter((t) => t.status === "PAGO").reduce((s, t) => s + t.valor, 0);
  const saldo = totalPrevisto - totalPago;
  const pagoPercent = totalPrevisto > 0 ? Math.round((totalPago / totalPrevisto) * 100) : 0;

  const pendentes = filtered.filter((t) => t.status === "PENDENTE");
  const totalPendente = pendentes.reduce((s, t) => s + t.valor, 0);

  const fixos = filtered
    .filter((t) => t.tipo_lancamento === "RECORRENTE")
    .reduce((s, t) => s + t.valor, 0);

  const cartao = filtered
    .filter((t) => accounts?.find((a) => a.account_id === t.payment_account_id)?.tipo === "CARTAO")
    .reduce((s, t) => s + t.valor, 0);

  const totalReceitas = useMemo(
    () =>
      (incomes ?? []).filter((i) => i.competencia === competencia).reduce((s, i) => s + i.valor, 0),
    [incomes, competencia],
  );

  const cardIds = useMemo(
    () => new Set((accounts ?? []).filter((a) => a.tipo === "CARTAO").map((a) => a.account_id)),
    [accounts],
  );

  const extraFatura = useMemo(() => {
    const cardTxTotal = filtered
      .filter((t) => cardIds.has(t.payment_account_id ?? ""))
      .reduce((s, t) => s + t.valor, 0);
    const invoiceTotal = (invoiceAmounts ?? [])
      .filter((ia) => ia.competencia === competencia)
      .reduce((s, ia) => s + ia.valor_real, 0);
    return Math.max(0, invoiceTotal - cardTxTotal);
  }, [filtered, invoiceAmounts, cardIds, competencia]);

  const totalSaidasReais = totalPrevisto + extraFatura;

  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t) => {
      map.set(t.categoria_id, (map.get(t.categoria_id) ?? 0) + t.valor);
    });
    return Array.from(map.entries())
      .map(([id, total]) => ({
        nome: categories?.find((c) => c.category_id === id)?.nome ?? id,
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filtered, categories]);

  const tipoChartData = useMemo(() => {
    const map = new Map<string, number>([
      ["RECORRENTE", 0],
      ["PARCELADO", 0],
      ["MANUAL", 0],
    ]);
    filtered.forEach((t) => {
      map.set(t.tipo_lancamento, (map.get(t.tipo_lancamento) ?? 0) + t.valor);
    });
    return [
      { nome: "Recorrente", total: Math.round((map.get("RECORRENTE") ?? 0) * 100) / 100 },
      { nome: "Parcelado", total: Math.round((map.get("PARCELADO") ?? 0) * 100) / 100 },
      { nome: "Manual", total: Math.round((map.get("MANUAL") ?? 0) * 100) / 100 },
    ].filter((d) => d.total > 0);
  }, [filtered]);

  const entradasSaidasData = useMemo(
    () => [
      { nome: "Receitas", total: Math.round(totalReceitas * 100) / 100 },
      { nome: "Saídas", total: Math.round(totalSaidasReais * 100) / 100 },
    ],
    [totalReceitas, totalSaidasReais],
  );

  const trendData = useMemo(() => {
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    const lastIncomeMonth = [...new Set((incomes ?? []).map((i) => i.competencia))]
      .filter((m) => m <= todayMonth)
      .sort()
      .at(-1);
    const lastIncomeValue = lastIncomeMonth
      ? Math.round(
          (incomes ?? [])
            .filter((i) => i.competencia === lastIncomeMonth)
            .reduce((s, i) => s + i.valor, 0) * 100,
        ) / 100
      : 0;

    const currentYear = Number(competencia.slice(0, 4));
    return rangeMonths.map((month) => {
      const year = Number(month.slice(0, 4));
      const monthNum = Number(month.slice(5));
      const abbr = MONTH_ABBR[monthNum - 1] ?? month.slice(5);
      const monthTxs = (txs ?? []).filter(
        (t) => t.competencia === month && (t.status === "PAGO" || t.status === "PENDENTE"),
      );
      const monthIncomes = (incomes ?? []).filter((i) => i.competencia === month);
      const cardTxTotal = monthTxs
        .filter((t) => cardIds.has(t.payment_account_id ?? ""))
        .reduce((s, t) => s + t.valor, 0);
      const invoiceTotal = (invoiceAmounts ?? [])
        .filter((ia) => ia.competencia === month)
        .reduce((s, ia) => s + ia.valor_real, 0);
      const extra = Math.max(0, invoiceTotal - cardTxTotal);

      const hasIncome = monthIncomes.length > 0;
      const isFuture = month > todayMonth;
      const isProjected = isFuture && !hasIncome;

      return {
        mes: year !== currentYear ? `${abbr}/${String(year).slice(2)}` : abbr,
        entradas: hasIncome
          ? Math.round(monthIncomes.reduce((s, i) => s + i.valor, 0) * 100) / 100
          : isProjected
            ? lastIncomeValue
            : 0,
        saidas: Math.round((monthTxs.reduce((s, t) => s + t.valor, 0) + extra) * 100) / 100,
        projecao: isProjected,
      };
    });
  }, [txs, incomes, invoiceAmounts, cardIds, competencia, rangeMonths]);

  const countData = useMemo(() => {
    const currentYear = Number(competencia.slice(0, 4));
    return rangeMonths.map((month) => {
      const year = Number(month.slice(0, 4));
      const monthNum = Number(month.slice(5));
      const abbr = MONTH_ABBR[monthNum - 1] ?? month.slice(5);
      const monthTxs = (txs ?? []).filter(
        (t) => t.competencia === month && (t.status === "PAGO" || t.status === "PENDENTE"),
      );
      return {
        mes: year !== currentYear ? `${abbr}/${String(year).slice(2)}` : abbr,
        recorrente: monthTxs.filter((t) => t.tipo_lancamento === "RECORRENTE").length,
        parcelado: monthTxs.filter((t) => t.tipo_lancamento === "PARCELADO").length,
        avista: monthTxs.filter((t) => t.tipo_lancamento === "MANUAL").length,
      };
    });
  }, [txs, competencia, rangeMonths]);

  const currentMonthLabel = MONTH_ABBR[Number(competencia.slice(5)) - 1] ?? competencia.slice(5);

  const palette = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
  };

  return (
    <div className="px-4 py-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description={`Resumo de ${competenciaLabel(competencia)}`}
        actions={<CompetenciaSelector />}
      />

      <Tabs defaultValue="mes-atual">
        <TabsList className="mb-6">
          <TabsTrigger value="mes-atual">Mês atual</TabsTrigger>
          <TabsTrigger value="geral">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="mes-atual">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <SummaryCard
              label="Total de receitas"
              value={totalReceitas}
              loading={isLoading}
              tone="success"
            />
            <SummaryCard label="Total previsto" value={totalPrevisto} loading={isLoading} />
            <SummaryCard label="Total pago" value={totalPago} loading={isLoading} tone="success" />
            <SummaryCard
              label="Saldo restante"
              value={saldo}
              loading={isLoading}
              tone={saldo < 0 ? "warning" : undefined}
            />
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wide">
                Progresso de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <div className="space-y-1.5">
                  <Progress value={pagoPercent} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{pagoPercent}% pago</span>
                    <span>
                      {brl(totalPago)} de {brl(totalPrevisto)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <SummaryCard
              label={`Pendentes (${pendentes.length})`}
              value={totalPendente}
              loading={isLoading}
              variant="muted"
              tone={pendentes.length > 0 ? "warning" : undefined}
            />
            <SummaryCard
              label="Gastos fixos (recorrentes)"
              value={fixos}
              loading={isLoading}
              variant="muted"
            />
            <SummaryCard
              label="Cartão de crédito"
              value={cartao}
              loading={isLoading}
              variant="muted"
            />
          </div>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Gastos por categoria</CardTitle>
              <CardDescription>Top 8 categorias do mês</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : categoryChartData.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">
                  Sem lançamentos neste mês.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryChartData}
                    margin={{ top: 8, right: 8, left: -10, bottom: 50 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="nome"
                      angle={-20}
                      textAnchor="end"
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickFormatter={(v) => brl(v).replace("R$", "")}
                    />
                    <Tooltip
                      formatter={(v: number) => brl(v)}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "var(--color-popover-foreground)" }}
                      itemStyle={{ color: "var(--color-popover-foreground)" }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {categoryChartData.map((_, i) => (
                        <Cell key={i} fill={palette[i % palette.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tipo de lançamento</CardTitle>
                <CardDescription>Distribuição por origem</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : tipoChartData.length === 0 ? (
                  <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">
                    Sem lançamentos neste mês.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tipoChartData}
                            dataKey="total"
                            nameKey="nome"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                          >
                            {tipoChartData.map((_, i) => (
                              <Cell key={i} fill={palette[i % palette.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number) => brl(v)}
                            contentStyle={tooltipStyle}
                            labelStyle={{ color: "var(--color-popover-foreground)" }}
                            itemStyle={{ color: "var(--color-popover-foreground)" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {tipoChartData.map((d, i) => (
                        <li key={i} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: palette[i % palette.length] }}
                            />
                            <span className="text-muted-foreground">{d.nome}</span>
                          </span>
                          <span className="tabular-nums font-medium">{brl(d.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Entradas vs Saídas</CardTitle>
                <CardDescription>Comparativo do mês atual</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={entradasSaidasData}
                      margin={{ top: 8, right: 8, left: -10, bottom: 8 }}
                      barSize={64}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="nome"
                        tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                        tickFormatter={(v) => brl(v).replace("R$", "")}
                      />
                      <Tooltip
                        formatter={(v: number) => brl(v)}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "var(--color-popover-foreground)" }}
                        itemStyle={{ color: "var(--color-popover-foreground)" }}
                      />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                        <Cell fill="var(--color-chart-2)" />
                        <Cell fill="var(--color-chart-3)" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="geral">
          <div className="flex items-center justify-end gap-2 mb-6">
            <span className="text-xs text-muted-foreground">Período:</span>
            <input
              type="month"
              value={summaryStart}
              max={summaryEnd}
              onChange={(e) => setSummaryStart(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <input
              type="month"
              value={summaryEnd}
              min={summaryStart}
              onChange={(e) => setSummaryEnd(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Tendência mensal</CardTitle>
              <CardDescription>
                Receitas e saídas por mês — meses futuros sem receita usam o último valor cadastrado
                como previsão *
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[260px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: -10, bottom: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickFormatter={(v) => brl(v).replace("R$", "")}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const isProjected = (
                          payload[0]?.payload as { projecao?: boolean }
                        )?.projecao;
                        return (
                          <div style={{ ...tooltipStyle, padding: "8px 12px" }}>
                            <p
                              style={{
                                color: "var(--color-popover-foreground)",
                                fontWeight: 500,
                                marginBottom: 4,
                              }}
                            >
                              {label}
                              {isProjected && " *"}
                            </p>
                            {payload.map((entry, i) => (
                              <p
                                key={i}
                                style={{
                                  color: entry.color as string,
                                  fontSize: 12,
                                  margin: "2px 0",
                                }}
                              >
                                {entry.name === "entradas" ? "Receitas" : "Saídas"}:{" "}
                                {brl(entry.value as number)}
                                {isProjected && entry.name === "entradas" && " (previsão)"}
                              </p>
                            ))}
                            {isProjected && (
                              <p
                                style={{
                                  color: "var(--color-muted-foreground)",
                                  fontSize: 11,
                                  marginTop: 6,
                                }}
                              >
                                * Baseado no último mês com receita cadastrada
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      formatter={(value) => (value === "entradas" ? "Receitas" : "Saídas")}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <ReferenceLine
                      x={currentMonthLabel}
                      stroke="var(--color-muted-foreground)"
                      strokeDasharray="4 2"
                      strokeOpacity={0.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="entradas"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="saidas"
                      stroke="var(--color-chart-3)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quantidade de lançamentos</CardTitle>
              <CardDescription>Recorrentes, parcelados e à vista por mês</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countData} margin={{ top: 8, right: 8, left: -10, bottom: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "var(--color-popover-foreground)" }}
                      itemStyle={{ color: "var(--color-popover-foreground)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine
                      x={currentMonthLabel}
                      stroke="var(--color-muted-foreground)"
                      strokeDasharray="4 2"
                      strokeOpacity={0.5}
                    />
                    <Bar
                      dataKey="recorrente"
                      name="Recorrente"
                      fill="var(--color-chart-1)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="parcelado"
                      name="Parcelado"
                      fill="var(--color-chart-2)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="avista"
                      name="À vista"
                      fill="var(--color-chart-4)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  loading,
  tone,
  variant,
}: {
  label: string;
  value: number;
  loading?: boolean;
  tone?: "success" | "warning";
  variant?: "muted";
}) {
  const color =
    tone === "success"
      ? "text-[color:var(--color-success)]"
      : tone === "warning"
        ? "text-[color:var(--color-warning)]"
        : "text-foreground";
  return (
    <Card className={variant === "muted" ? "bg-muted/40 border-dashed" : ""}>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className={`text-2xl font-semibold tabular-nums ${color}`}>{brl(value)}</div>
        )}
      </CardContent>
    </Card>
  );
}
