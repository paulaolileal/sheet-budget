import { Fragment, useMemo, useState } from "react";
import { Search, Plus, Repeat, RefreshCw, CalendarCheck, CheckCircle2, EyeOff, Pencil } from "lucide-react";
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
import type { Transaction, TransactionStatus, TipoLancamento } from "@/domain/types";
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

const STATUS_ORDER: Record<TransactionStatus, number> = {
  PENDENTE: 0,
  AGENDADO: 1,
  PLANEJADO: 2,
  PAGO: 3,
  IGNORADO: 4,
  CANCELADO: 5,
};

const TIPO_ORDER: Record<TipoLancamento, number> = {
  RECORRENTE: 0,
  PARCELADO: 1,
  MANUAL: 2,
};

const TIPO_LABEL: Record<TipoLancamento, string> = {
  RECORRENTE: "Rec",
  PARCELADO: "Parc",
  MANUAL: "Man",
};

function currentCompetencia(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseParcela(descricao: string, tipo: TipoLancamento): string | null {
  if (tipo !== "PARCELADO") return null;
  const m = descricao.match(/\((\d+\/\d+)\)$/);
  return m ? m[1] : null;
}

function stripParcela(descricao: string): string {
  return descricao.replace(/\s*\(\d+\/\d+\)$/, "");
}

interface CategoryGroup {
  categoria_id: string;
  transactions: Transaction[];
  total: number;
  aPagar: number;
  pago: number;
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

  const catMap = useMemo(
    () => Object.fromEntries((categories ?? []).map((c) => [c.category_id, c.nome])),
    [categories],
  );
  const accMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a.nome])),
    [accounts],
  );

  const pendingTemplates = useMemo(() => {
    if (!templates || !txs) return [];
    const existingKeys = new Set(
      txs
        .filter((t) => t.competencia === competencia && t.template_id && t.status !== "CANCELADO")
        .map((t) => t.template_id!),
    );
    return templates.filter((tpl) => {
      if (!tpl.ativo) return false;
      if (tpl.primeira_competencia > competencia) return false;
      if (tpl.ultima_competencia && competencia > tpl.ultima_competencia) return false;
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
        const active = transactions.filter(
          (t) => t.status !== "CANCELADO" && t.status !== "IGNORADO",
        );
        const paid = transactions.filter((t) => t.status === "PAGO");
        const unpaid = active.filter((t) => t.status !== "PAGO");
        return {
          categoria_id,
          transactions,
          total: active.reduce((s, t) => s + t.valor_previsto, 0),
          aPagar: unpaid.reduce((s, t) => s + t.valor_previsto, 0),
          pago: paid.reduce((s, t) => s + (t.valor_final ?? t.valor_previsto), 0),
        };
      })
      .sort((a, b) => (catMap[a.categoria_id] ?? a.categoria_id).localeCompare(catMap[b.categoria_id] ?? b.categoria_id));
  }, [filtered, catMap]);

  const totalPrevisto = filtered
    .filter((t) => t.status !== "CANCELADO" && t.status !== "IGNORADO")
    .reduce((s, t) => s + t.valor_previsto, 0);

  function handlePay(e: React.MouseEvent, tx: Transaction) {
    e.stopPropagation();
    updateTransaction({
      id: tx.transaction_id,
      patch: { status: "PAGO", valor_final: tx.valor_final ?? tx.valor_previsto },
    });
  }

  function handleIgnore(e: React.MouseEvent, tx: Transaction) {
    e.stopPropagation();
    updateTransaction({ id: tx.transaction_id, patch: { status: "IGNORADO" } });
  }

  function handleEdit(e: React.MouseEvent, tx: Transaction) {
    e.stopPropagation();
    setEditing(tx);
  }

  const today = currentCompetencia();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Lançamentos"
        description={`${filtered.length} lançamentos em ${competenciaLabel(competencia)} — total ${brl(totalPrevisto)}`}
        actions={
          <div className="flex items-center gap-2">
            {competencia !== today && (
              <Button variant="outline" size="sm" onClick={() => setCompetencia(today)}>
                <CalendarCheck className="h-4 w-4 mr-1" />
                Mês atual
              </Button>
            )}
            <CompetenciaSelector />
            <Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={isGenerating}>
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Repeat className="h-4 w-4 mr-1" />
              )}
              Recorrências
            </Button>
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
            ...(["PLANEJADO", "AGENDADO", "PENDENTE", "PAGO", "CANCELADO", "IGNORADO"] as TransactionStatus[]).map(
              (s) => ({ value: s, label: s }),
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

      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Descrição
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">
                Parcela
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
              <th className="px-4 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : grouped.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhum lançamento encontrado para este filtro.
                </td>
              </tr>
            ) : (
              grouped.map((group) => (
                <Fragment key={group.categoria_id}>
                  <tr className="bg-muted/60 border-b border-t">
                    <td className="px-4 py-2 font-semibold text-xs uppercase tracking-wide text-foreground/80">
                      {catMap[group.categoria_id] ?? group.categoria_id}
                    </td>
                    <td />
                    <td />
                    <td />
                    <td className="px-4 py-2 text-right">
                      <span className="text-xs text-muted-foreground">Total </span>
                      <span className="text-xs font-medium tabular-nums">{brl(group.total)}</span>
                    </td>
                    <td className="px-4 py-2" colSpan={2}>
                      <div className="flex items-center gap-3 text-xs tabular-nums">
                        <span>
                          <span className="text-muted-foreground">A pagar </span>
                          <span className="font-medium text-[color:var(--color-warning)]">
                            {brl(group.aPagar)}
                          </span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">Pago </span>
                          <span className="font-medium text-[color:var(--color-success)]">
                            {brl(group.pago)}
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                  {group.transactions.map((tx) => {
                    const parcela = parseParcela(tx.descricao, tx.tipo_lancamento);
                    const descricao = parcela ? stripParcela(tx.descricao) : tx.descricao;
                    const isPaid = tx.status === "PAGO";
                    const isIgnored = tx.status === "IGNORADO";
                    const isCancelled = tx.status === "CANCELADO";
                    const canPay = !isPaid && !isCancelled;
                    const canIgnore = !isIgnored && !isCancelled && !isPaid;
                    return (
                      <tr
                        key={tx.transaction_id}
                        className={cn(
                          "border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer",
                          (isIgnored || isCancelled) && "opacity-50",
                        )}
                        onClick={() => setEditing(tx)}
                      >
                        <td className="px-4 py-2.5 font-medium">{descricao}</td>
                        <td className="px-4 py-2.5">
                          {parcela && (
                            <Badge variant="outline" className="text-xs font-normal px-1.5">
                              {parcela}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {tx.payment_account_id ? (accMap[tx.payment_account_id] ?? "—") : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-muted-foreground">
                            {TIPO_LABEL[tx.tipo_lancamento]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {brl(tx.valor_final ?? tx.valor_previsto)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={cn("font-normal border-0 text-xs", STATUS_TONES[tx.status])}
                          >
                            {tx.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {canPay && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[color:var(--color-success)] hover:text-[color:var(--color-success)] hover:bg-[color:var(--color-success)]/10"
                                title="Marcar como pago"
                                onClick={(e) => handlePay(e, tx)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canIgnore && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-muted-foreground hover:bg-muted"
                                title="Ignorar"
                                onClick={(e) => handleIgnore(e, tx)}
                              >
                                <EyeOff className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              title="Editar"
                              onClick={(e) => handleEdit(e, tx)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TransactionDialog open={creating} onOpenChange={(o) => !o && setCreating(false)} />
      <TransactionDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        transaction={editing ?? undefined}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
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
                      {catMap[tpl.categoria_id] ?? tpl.categoria_id}
                      {tpl.payment_account_id ? ` · ${accMap[tpl.payment_account_id]}` : ""}
                    </p>
                  </div>
                  {tpl.valor_padrao != null && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {brl(tpl.valor_padrao)}
                    </span>
                  )}
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
