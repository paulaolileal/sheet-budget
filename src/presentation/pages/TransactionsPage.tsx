import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Search, Plus, ArrowUpDown } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { CompetenciaSelector } from "../components/CompetenciaSelector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAccounts,
  useCategories,
  useTransactions,
} from "@/hooks/queries";
import { useUiStore } from "@/store/uiStore";
import { brl, competenciaLabel } from "@/utils/format";
import type {
  Transaction,
  TransactionStatus,
  TipoLancamento,
} from "@/domain/types";
import { TransactionDialog } from "../components/TransactionDialog";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<TransactionStatus, string> = {
  PLANEJADO: "bg-muted text-muted-foreground",
  AGENDADO: "bg-[color:var(--color-chart-1)]/15 text-[color:var(--color-chart-1)]",
  PENDENTE: "bg-[color:var(--color-warning)]/20 text-[color:var(--color-warning)]",
  PAGO: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  CANCELADO: "bg-destructive/10 text-destructive line-through",
  IGNORADO: "bg-muted text-muted-foreground opacity-60",
};

export function TransactionsPage() {
  const competencia = useUiStore((s) => s.competencia);
  const isGenerating = useUiStore((s) => s.isGenerating);
  const { data: txs, isLoading } = useTransactions();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  const catMap = useMemo(
    () => Object.fromEntries((categories ?? []).map((c) => [c.category_id, c.nome])),
    [categories],
  );
  const accMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a.nome])),
    [accounts],
  );

  const filtered = useMemo(() => {
    return (txs ?? []).filter((t) => {
      if (t.competencia !== competencia) return false;
      if (categoryFilter !== "all" && t.categoria_id !== categoryFilter) return false;
      if (accountFilter !== "all" && t.payment_account_id !== accountFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (tipoFilter !== "all" && t.tipo_lancamento !== tipoFilter) return false;
      if (search && !t.descricao.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [txs, competencia, categoryFilter, accountFilter, statusFilter, tipoFilter, search]);

  const totalPrevisto = filtered.reduce((s, t) => s + t.valor_previsto, 0);

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: "descricao",
        header: ({ column }) => (
          <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => column.toggleSorting()}>
            Descrição <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.descricao}</span>,
      },
      {
        accessorKey: "categoria_id",
        header: "Categoria",
        cell: ({ row }) => <span className="text-muted-foreground">{catMap[row.original.categoria_id] ?? "—"}</span>,
      },
      {
        accessorKey: "payment_account_id",
        header: "Conta",
        cell: ({ row }) =>
          row.original.payment_account_id ? accMap[row.original.payment_account_id] ?? "—" : "—",
      },
      {
        accessorKey: "tipo_lancamento",
        header: "Tipo",
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.tipo_lancamento}</span>,
      },
      {
        accessorKey: "valor_previsto",
        header: ({ column }) => (
          <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => column.toggleSorting()}>
            Valor <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {brl(row.original.valor_final ?? row.original.valor_previsto)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("font-normal border-0", STATUS_TONES[row.original.status])}>
            {row.original.status}
          </Badge>
        ),
      },
    ],
    [catMap, accMap],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Lançamentos"
        description={`${filtered.length} lançamentos em ${competenciaLabel(competencia)} — total ${brl(totalPrevisto)}`}
        actions={
          <div className="flex items-center gap-2">
            <CompetenciaSelector />
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <FilterSelect value={categoryFilter} onChange={setCategoryFilter} placeholder="Categoria"
          options={[{ value: "all", label: "Todas categorias" }, ...(categories ?? []).map((c) => ({ value: c.category_id, label: c.nome }))]} />
        <FilterSelect value={accountFilter} onChange={setAccountFilter} placeholder="Conta"
          options={[{ value: "all", label: "Todas contas" }, ...(accounts ?? []).map((a) => ({ value: a.account_id, label: a.nome }))]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Status"
          options={[
            { value: "all", label: "Todos status" },
            ...(["PLANEJADO","AGENDADO","PENDENTE","PAGO","CANCELADO","IGNORADO"] as TransactionStatus[]).map((s) => ({ value: s, label: s })),
          ]} />
        <FilterSelect value={tipoFilter} onChange={setTipoFilter} placeholder="Tipo"
          options={[
            { value: "all", label: "Todos tipos" },
            ...(["RECORRENTE","PARCELADO","MANUAL"] as TipoLancamento[]).map((t) => ({ value: t, label: t })),
          ]} />
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading || (isGenerating && filtered.length === 0) ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[160px]" /></td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhum lançamento encontrado para este filtro.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => setEditing(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TransactionDialog
        open={creating}
        onOpenChange={(o) => !o && setCreating(false)}
      />
      <TransactionDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        transaction={editing ?? undefined}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
