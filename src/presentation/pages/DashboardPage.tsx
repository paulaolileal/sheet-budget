import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "../components/PageHeader";
import { CompetenciaSelector } from "../components/CompetenciaSelector";
import { useUiStore } from "@/store/uiStore";
import {
  useAccounts,
  useCategories,
  useTransactions,
} from "@/hooks/queries";
import { brl, competenciaLabel } from "@/utils/format";

export function DashboardPage() {
  const competencia = useUiStore((s) => s.competencia);
  const { data: txs, isLoading } = useTransactions();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();

  const filtered = useMemo(
    () => (txs ?? []).filter((t) => t.competencia === competencia && t.status !== "IGNORADO"),
    [txs, competencia],
  );

  const totalPrevisto = filtered.reduce((s, t) => s + t.valor_previsto, 0);
  const totalPago = filtered
    .filter((t) => t.status === "PAGO")
    .reduce((s, t) => s + (t.valor_final ?? t.valor_previsto), 0);
  const saldo = totalPrevisto - totalPago;

  const cartao = filtered
    .filter((t) => accounts?.find((a) => a.account_id === t.payment_account_id)?.tipo === "CARTAO")
    .reduce((s, t) => s + t.valor_previsto, 0);
  const fixos = filtered
    .filter((t) => t.tipo_lancamento === "RECORRENTE")
    .reduce((s, t) => s + t.valor_previsto, 0);
  const parcelados = filtered
    .filter((t) => t.tipo_lancamento === "PARCELADO")
    .reduce((s, t) => s + t.valor_previsto, 0);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t) => {
      map.set(t.categoria_id, (map.get(t.categoria_id) ?? 0) + t.valor_previsto);
    });
    return Array.from(map.entries())
      .map(([id, total]) => ({
        nome: categories?.find((c) => c.category_id === id)?.nome ?? id,
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filtered, categories]);

  const palette = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description={`Resumo de ${competenciaLabel(competencia)}`}
        actions={<CompetenciaSelector />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Total previsto" value={totalPrevisto} loading={isLoading} />
        <SummaryCard label="Total pago" value={totalPago} loading={isLoading} tone="success" />
        <SummaryCard label="Saldo restante" value={saldo} loading={isLoading} tone={saldo < 0 ? "warning" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Gastos fixos (recorrentes)" value={fixos} loading={isLoading} variant="muted" />
        <SummaryCard label="Parcelamentos" value={parcelados} loading={isLoading} variant="muted" />
        <SummaryCard label="Cartão de crédito" value={cartao} loading={isLoading} variant="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gastos por categoria</CardTitle>
          <CardDescription>Top 8 categorias do mês</CardDescription>
        </CardHeader>
        <CardContent className="h-[340px]">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              Sem lançamentos neste mês.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => brl(v).replace("R$", "")} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
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
