import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Repeat,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { CompetenciaSelector } from "../components/CompetenciaSelector";
import { AppIcon } from "../components/AppIcon";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAccounts,
  useCategories,
  useGenerateRecurring,
  useTemplates,
  useTransactions,
  useUpdateTransaction,
} from "@/hooks/queries";
import { useUiStore } from "@/store/uiStore";
import { brl, competenciaLabel } from "@/utils/format";
import { isTemplateActive } from "@/domain/types";
import type { Transaction, TransactionStatus, TipoLancamento } from "@/domain/types";
import { TransactionDialog } from "../components/TransactionDialog";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<TransactionStatus, string> = {
  PENDENTE: "bg-[color:var(--color-warning)]/20 text-[color:var(--color-warning)]",
  PAGO: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  ADIANTADO: "bg-purple-500/15 text-purple-500",
  IGNORADO: "bg-muted text-muted-foreground opacity-60",
};

const STATUS_ORDER: Record<TransactionStatus, number> = {
  PENDENTE: 0,
  PAGO: 1,
  ADIANTADO: 2,
  IGNORADO: 3,
};

const TIPO_ORDER: Record<TipoLancamento, number> = {
  RECORRENTE: 0,
  PARCELADO: 1,
  MANUAL: 2,
};

const ACTIONABLE_STATUSES: TransactionStatus[] = ["PENDENTE", "PAGO", "ADIANTADO", "IGNORADO"];

// Palette for category group header rows — full class strings for Tailwind JIT
// Avoids green/yellow/red to prevent confusion with status colors (PAGO/PENDENTE)
const CAT_PALETTE = [
  "border-l-blue-400 bg-blue-500/10",
  "border-l-violet-400 bg-violet-500/10",
  "border-l-orange-400 bg-orange-500/10",
  "border-l-sky-400 bg-sky-500/10",
  "border-l-pink-400 bg-pink-500/10",
  "border-l-cyan-400 bg-cyan-500/10",
  "border-l-indigo-400 bg-indigo-500/10",
  "border-l-fuchsia-400 bg-fuchsia-500/10",
] as const;

const COL_COUNT = 6;

function parseParcela(descricao: string, tipo: TipoLancamento): string | null {
  if (tipo !== "PARCELADO") return null;
  const m = descricao.match(/\((\d+\/\d+)\)$/);
  return m ? m[1] : null;
}

function stripParcela(descricao: string): string {
  return descricao.replace(/\s*\(\d+\/\d+\)$/, "");
}

function isSettled(tx: Transaction): boolean {
  return tx.status === "PAGO" || tx.status === "ADIANTADO" || tx.status === "IGNORADO";
}

interface CategoryGroup {
  categoria_id: string;
  transactions: Transaction[];
  total: number;
  aPagar: number;
  pago: number;
  allSettled: boolean;
}

export function TransactionsPage() {
  const { competencia, setCompetencia } = useUiStore();
  const { data: txs, isLoading } = useTransactions();
  const { mutate: generateRecurring, isPending: isGenerating } = useGenerateRecurring();
  const { mutate: updateTransaction } = useUpdateTransaction();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: templates } = useTemplates();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // IDs of all-settled categories that the user manually expanded
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  // IDs of settled transactions that the user manually expanded (show full row)
  const [expandedTxs, setExpandedTxs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedCats(new Set());
    setExpandedTxs(new Set());
  }, [competencia]);

  function toggleCat(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTx(id: string) {
    setExpandedTxs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const catMap = useMemo(
    () => Object.fromEntries((categories ?? []).map((c) => [c.category_id, c])),
    [categories],
  );
  const accMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a.nome])),
    [accounts],
  );

  const pendingTemplates = useMemo(() => {
    if (!templates || !txs) return [];
    const existingKeys = new Set(
      txs.filter((t) => t.competencia === competencia && t.template_id).map((t) => t.template_id!),
    );
    return templates.filter((tpl) => {
      if (!isTemplateActive(tpl, competencia)) return false;
      return !existingKeys.has(tpl.template_id);
    });
  }, [templates, txs, competencia]);

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

  const grouped = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const key = t.categoria_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const txList of map.values()) {
      txList.sort((a, b) => {
        const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (s !== 0) return s;
        const tp = TIPO_ORDER[a.tipo_lancamento] - TIPO_ORDER[b.tipo_lancamento];
        if (tp !== 0) return tp;
        return a.descricao.localeCompare(b.descricao);
      });
    }
    return [...map.entries()]
      .map(([categoria_id, transactions]) => {
        const active = transactions.filter((t) => t.status !== "IGNORADO");
        const paid = transactions.filter((t) => t.status === "PAGO");
        const unpaid = active.filter((t) => t.status !== "PAGO" && t.status !== "ADIANTADO");
        const pago = paid.reduce((s, t) => s + t.valor, 0);
        const aPagar = unpaid.reduce((s, t) => s + t.valor, 0);
        return {
          categoria_id,
          transactions,
          total: aPagar + pago,
          aPagar,
          pago,
          allSettled: transactions.length > 0 && transactions.every(isSettled),
        };
      })
      .sort((a, b) =>
        (catMap[a.categoria_id]?.nome ?? a.categoria_id).localeCompare(
          catMap[b.categoria_id]?.nome ?? b.categoria_id,
        ),
      );
  }, [filtered, catMap]);

  const parcelaMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    if (!txs) return map;
    const parcelados = txs.filter((t) => t.tipo_lancamento === "PARCELADO");
    const groups = new Map<string, Transaction[]>();
    for (const tx of parcelados) {
      const key = tx.template_id ?? stripParcela(tx.descricao);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.competencia.localeCompare(b.competencia));
      group.forEach((tx, i) => map.set(tx.transaction_id, `${i + 1}/${group.length}`));
    }
    return map;
  }, [txs]);

  const {
    globalAPagar,
    globalAPagarCount,
    globalPago,
    globalPagoCount,
    globalAdiantado,
    globalAdiantadoCount,
  } = useMemo(() => {
    const active = filtered.filter((t) => t.status !== "IGNORADO");
    const aPagarItems = active.filter((t) => t.status !== "PAGO" && t.status !== "ADIANTADO");
    const pagoItems = active.filter((t) => t.status === "PAGO");
    const adiantadoItems = active.filter((t) => t.status === "ADIANTADO");
    return {
      globalAPagar: aPagarItems.reduce((s, t) => s + t.valor, 0),
      globalAPagarCount: aPagarItems.length,
      globalPago: pagoItems.reduce((s, t) => s + t.valor, 0),
      globalPagoCount: pagoItems.length,
      globalAdiantado: adiantadoItems.reduce((s, t) => s + t.valor, 0),
      globalAdiantadoCount: adiantadoItems.length,
    };
  }, [filtered]);

  function handleStatusChange(tx: Transaction, newStatus: TransactionStatus) {
    updateTransaction({ id: tx.transaction_id, patch: { status: newStatus } });
  }

  return (
    <div className="px-4 py-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Lançamentos"
        description={`${filtered.length} lançamentos em ${competenciaLabel(competencia)}`}
        actions={
          <div className="flex items-center gap-2">
            <CompetenciaSelector />
            <Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={isGenerating}>
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 sm:mr-1 animate-spin" />
              ) : (
                <Repeat className="h-4 w-4 sm:mr-1" />
              )}
              <span className="hidden sm:inline">Recorrências</span>
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5 text-sm">
        <span className="text-muted-foreground">
          A pagar <span className="text-xs">({globalAPagarCount})</span>
        </span>
        <span className="font-semibold tabular-nums text-[color:var(--color-warning)]">
          {brl(globalAPagar)}
        </span>
        <div className="h-4 w-px bg-border" />
        <span className="text-muted-foreground">
          Pago <span className="text-xs">({globalPagoCount})</span>
        </span>
        <span className="font-semibold tabular-nums text-[color:var(--color-success)]">
          {brl(globalPago)}
        </span>
        {globalAdiantado > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">
              Adiantado <span className="text-xs">({globalAdiantadoCount})</span>
            </span>
            <span className="font-semibold tabular-nums text-purple-500">
              {brl(globalAdiantado)}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 mb-4 md:flex-row md:flex-wrap md:items-center">
        <div className="relative w-full md:flex-1 md:min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 md:contents">
          <FilterSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="Categoria"
            options={[
              { value: "all", label: "Todas categorias" },
              ...(categories ?? []).map((c) => ({ value: c.category_id, label: c.nome })),
            ]}
          />
          <FilterSelect
            value={accountFilter}
            onChange={setAccountFilter}
            placeholder="Conta"
            options={[
              { value: "all", label: "Todas contas" },
              ...(accounts ?? []).map((a) => ({ value: a.account_id, label: a.nome })),
            ]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Status"
            options={[
              { value: "all", label: "Todos status" },
              ...(["PENDENTE", "PAGO", "ADIANTADO", "IGNORADO"] as TransactionStatus[]).map(
                (s) => ({
                  value: s,
                  label: s,
                }),
              ),
            ]}
          />
          <FilterSelect
            value={tipoFilter}
            onChange={setTipoFilter}
            placeholder="Tipo"
            options={[
              { value: "all", label: "Todos tipos" },
              ...(["RECORRENTE", "PARCELADO", "MANUAL"] as TipoLancamento[]).map((t) => ({
                value: t,
                label: t,
              })),
            ]}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Descrição
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Conta
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">
                Tipo
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">
                Valor
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide w-28">
                Status
              </th>
              <th className="px-4 py-2.5 w-14" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {Array.from({ length: COL_COUNT }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : grouped.length === 0 ? (
              <tr>
                <td
                  colSpan={COL_COUNT}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhum lançamento encontrado para este filtro.
                </td>
              </tr>
            ) : (
              grouped.map((group, idx) => {
                const catCollapsed = group.allSettled && !expandedCats.has(group.categoria_id);
                const CatChevron = catCollapsed ? ChevronRight : ChevronDown;
                const settledCount = group.transactions.filter(isSettled).length;
                const paletteClass = CAT_PALETTE[idx % CAT_PALETTE.length];

                return (
                  <Fragment key={group.categoria_id}>
                    {/* Category group header */}
                    <tr
                      className={cn(
                        "border-b border-t border-l-4",
                        paletteClass,
                        group.allSettled &&
                          "cursor-pointer hover:brightness-95 transition-all select-none",
                      )}
                      onClick={group.allSettled ? () => toggleCat(group.categoria_id) : undefined}
                    >
                      <td className="px-4 py-2 font-semibold text-xs uppercase tracking-wide text-foreground/80">
                        <span className="inline-flex items-center gap-1.5">
                          {group.allSettled && (
                            <CatChevron className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <AppIcon
                            iconId={catMap[group.categoria_id]?.icon_id}
                            size={13}
                            className="shrink-0"
                          />
                          {catMap[group.categoria_id]?.nome ?? group.categoria_id}
                          {catCollapsed && (
                            <span className="font-normal normal-case tracking-normal text-muted-foreground ml-1">
                              · {settledCount} {settledCount === 1 ? "item" : "itens"}
                            </span>
                          )}
                        </span>
                      </td>
                      <td />
                      <td />
                      <td className="px-4 py-2 text-right">
                        <span className="text-xs text-muted-foreground">Total </span>
                        <span className="text-xs font-medium tabular-nums">{brl(group.total)}</span>
                      </td>
                      <td className="px-4 py-2" colSpan={2}>
                        <div className="flex items-center gap-3 text-xs tabular-nums">
                          {group.aPagar > 0 && (
                            <span>
                              <span className="text-muted-foreground">A pagar </span>
                              <span className="font-medium text-[color:var(--color-warning)]">
                                {brl(group.aPagar)}
                              </span>
                            </span>
                          )}
                          {group.pago > 0 && (
                            <span>
                              <span className="text-muted-foreground">Pago </span>
                              <span className="font-medium text-[color:var(--color-success)]">
                                {brl(group.pago)}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Transaction rows */}
                    {!catCollapsed &&
                      group.transactions.map((tx) => {
                        const parcela =
                          parcelaMap.get(tx.transaction_id) ??
                          parseParcela(tx.descricao, tx.tipo_lancamento);
                        const descricao = parcela ? stripParcela(tx.descricao) : tx.descricao;
                        const settled = isSettled(tx);
                        const txExpanded = expandedTxs.has(tx.transaction_id);
                        const txCollapsed = settled && !txExpanded;
                        const isIgnored = tx.status === "IGNORADO";

                        if (txCollapsed) {
                          return (
                            <tr
                              key={tx.transaction_id}
                              className="border-b last:border-0 opacity-40 hover:opacity-70 transition-opacity cursor-pointer"
                              title="Clique para expandir"
                              onClick={() => toggleTx(tx.transaction_id)}
                            >
                              <td className="px-4 py-0.5 text-xs text-muted-foreground">
                                {descricao}
                              </td>
                              <td className="px-4 py-0.5 text-xs text-muted-foreground">
                                {tx.payment_account_id ? (accMap[tx.payment_account_id] ?? "") : ""}
                              </td>
                              <td className="px-4 py-0.5">
                                <TipoCell tipo={tx.tipo_lancamento} parcela={parcela} />
                              </td>
                              <td className="px-4 py-0.5 text-right text-xs tabular-nums text-muted-foreground">
                                {brl(tx.valor)}
                              </td>
                              <td className="px-4 py-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-normal border-0 text-xs",
                                    STATUS_TONES[tx.status],
                                  )}
                                >
                                  {tx.status}
                                </Badge>
                              </td>
                              <td />
                            </tr>
                          );
                        }

                        const rowClick =
                          settled && txExpanded
                            ? () => toggleTx(tx.transaction_id)
                            : () => setEditing(tx);

                        return (
                          <tr
                            key={tx.transaction_id}
                            className={cn(
                              "border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer",
                              isIgnored && "opacity-50",
                            )}
                            onClick={rowClick}
                          >
                            <td className="px-4 py-2.5 font-medium">{descricao}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">
                              {tx.payment_account_id ? (accMap[tx.payment_account_id] ?? "—") : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <TipoCell tipo={tx.tipo_lancamento} parcela={parcela} />
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{brl(tx.valor)}</td>
                            <td className="px-4 py-2.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-normal border-0 text-xs",
                                  STATUS_TONES[tx.status],
                                )}
                              >
                                {tx.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuLabel className="text-xs py-1">
                                    Alterar status
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {ACTIONABLE_STATUSES.filter((s) => s !== tx.status).map(
                                    (status) => (
                                      <DropdownMenuItem
                                        key={status}
                                        className="text-xs gap-2 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(tx, status);
                                        }}
                                      >
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "font-normal border-0 text-xs",
                                            STATUS_TONES[status],
                                          )}
                                        >
                                          {status}
                                        </Badge>
                                      </DropdownMenuItem>
                                    ),
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-xs gap-2 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditing(tx);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Editar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2 bg-card">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum lançamento encontrado para este filtro.
          </div>
        ) : (
          grouped.map((group, idx) => {
            const catCollapsed = group.allSettled && !expandedCats.has(group.categoria_id);
            const CatChevron = catCollapsed ? ChevronRight : ChevronDown;
            const settledCount = group.transactions.filter(isSettled).length;
            const [borderCls, bgCls] = CAT_PALETTE[idx % CAT_PALETTE.length].split(" ");

            return (
              <div
                key={group.categoria_id}
                className={cn("rounded-lg border-l-4 overflow-hidden", borderCls)}
              >
                {/* Category header */}
                <div
                  className={cn(
                    "px-3 py-2.5 flex items-center justify-between gap-2",
                    bgCls,
                    group.allSettled && "cursor-pointer active:brightness-95 select-none",
                  )}
                  onClick={group.allSettled ? () => toggleCat(group.categoria_id) : undefined}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {group.allSettled && (
                      <CatChevron className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <AppIcon
                      iconId={catMap[group.categoria_id]?.icon_id}
                      size={13}
                      className="shrink-0"
                    />
                    <span className="font-semibold text-xs uppercase tracking-wide text-foreground/80 truncate">
                      {catMap[group.categoria_id]?.nome ?? group.categoria_id}
                      {catCollapsed && (
                        <span className="font-normal normal-case tracking-normal text-muted-foreground ml-1">
                          · {settledCount} {settledCount === 1 ? "item" : "itens"}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium tabular-nums">{brl(group.total)}</p>
                    <div className="flex gap-2 justify-end text-xs tabular-nums">
                      {group.aPagar > 0 && (
                        <span className="text-[color:var(--color-warning)]">
                          {brl(group.aPagar)}
                        </span>
                      )}
                      {group.pago > 0 && (
                        <span className="text-[color:var(--color-success)]">{brl(group.pago)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transaction items */}
                {!catCollapsed && (
                  <div className="divide-y bg-card">
                    {group.transactions.map((tx) => {
                      const parcela =
                        parcelaMap.get(tx.transaction_id) ??
                        parseParcela(tx.descricao, tx.tipo_lancamento);
                      const descricao = parcela ? stripParcela(tx.descricao) : tx.descricao;
                      const settled = isSettled(tx);
                      const txExpanded = expandedTxs.has(tx.transaction_id);
                      const txCollapsed = settled && !txExpanded;
                      const isIgnored = tx.status === "IGNORADO";

                      if (txCollapsed) {
                        return (
                          <div
                            key={tx.transaction_id}
                            className="px-3 py-1.5 flex items-center justify-between gap-2 opacity-40 active:opacity-70 transition-opacity cursor-pointer"
                            onClick={() => toggleTx(tx.transaction_id)}
                          >
                            <span className="text-xs text-muted-foreground truncate flex-1">
                              {descricao}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                              {brl(tx.valor)}
                            </span>
                          </div>
                        );
                      }

                      const rowClick =
                        settled && txExpanded
                          ? () => toggleTx(tx.transaction_id)
                          : () => setEditing(tx);

                      return (
                        <div
                          key={tx.transaction_id}
                          className={cn(
                            "px-3 py-3 flex items-center gap-2 cursor-pointer active:bg-muted/40 transition-colors",
                            isIgnored && "opacity-50",
                          )}
                          onClick={rowClick}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate leading-snug">{descricao}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-normal border-0 text-xs",
                                  STATUS_TONES[tx.status],
                                )}
                              >
                                {tx.status}
                              </Badge>
                              {tx.tipo_lancamento === "RECORRENTE" && (
                                <Repeat className="h-3 w-3 text-muted-foreground" />
                              )}
                              {parcela && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {parcela}
                                </span>
                              )}
                              {tx.payment_account_id && accMap[tx.payment_account_id] && (
                                <span className="text-xs text-muted-foreground truncate">
                                  · {accMap[tx.payment_account_id]}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm font-semibold tabular-nums shrink-0">
                            {brl(tx.valor)}
                          </p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel className="text-xs py-1">
                                Alterar status
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {ACTIONABLE_STATUSES.filter((s) => s !== tx.status).map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  className="text-xs gap-2 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(tx, status);
                                  }}
                                >
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "font-normal border-0 text-xs",
                                      STATUS_TONES[status],
                                    )}
                                  >
                                    {status}
                                  </Badge>
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-xs gap-2 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditing(tx);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <TransactionDialog open={creating} onOpenChange={(o) => !o && setCreating(false)} />
      <TransactionDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        transaction={editing ?? undefined}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar recorrências para {competenciaLabel(competencia)}</DialogTitle>
            <DialogDescription>
              {pendingTemplates.length === 0
                ? "Todos os templates já foram gerados para este mês."
                : `${pendingTemplates.length} lançamento(s) serão criados:`}
            </DialogDescription>
          </DialogHeader>

          {pendingTemplates.length > 0 && (
            <ul className="max-h-64 overflow-y-auto divide-y text-sm">
              {pendingTemplates.map((tpl) => (
                <li key={tpl.template_id} className="py-2 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{tpl.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {catMap[tpl.categoria_id]?.nome ?? tpl.categoria_id}
                      {tpl.payment_account_id ? ` · ${accMap[tpl.payment_account_id]}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                generateRecurring();
              }}
              disabled={pendingTemplates.length === 0 || isGenerating}
            >
              <Repeat className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TipoCell({ tipo, parcela }: { tipo: TipoLancamento; parcela: string | null }) {
  if (tipo === "RECORRENTE") {
    return <Repeat className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (tipo === "PARCELADO" && parcela) {
    return <span className="text-xs text-muted-foreground tabular-nums">{parcela}</span>;
  }
  return null;
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
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
