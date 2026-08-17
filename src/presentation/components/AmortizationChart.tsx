import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brl } from "@/utils/format";
import type { AmortizationInstallment } from "@/lib/amortization";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
};

/** Line chart of the remaining balance (saldo devedor) as each installment is paid off. */
export function AmortizationChart({ rows }: { rows: AmortizationInstallment[] }) {
  const data = rows.map((r) => ({ parcela: r.numero_parcela, saldo: r.saldo_devedor }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 10, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="parcela"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickFormatter={(v: number) => `${v}ª`}
        />
        <YAxis
          domain={[0, "auto"]}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickFormatter={(v: number) =>
            v === 0 ? "0" : `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
          }
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => brl(value)}
          labelFormatter={(label) => `Parcela ${label}ª`}
        />
        <Line
          type="monotone"
          dataKey="saldo"
          stroke="var(--color-chart-3)"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
