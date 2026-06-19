import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { TemplateDialog } from "../components/TemplateDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useAccounts, useTemplates } from "@/hooks/queries";
import { useUiStore } from "@/store/uiStore";
import { brl, competenciaLabel } from "@/utils/format";
import { Pencil, Plus } from "lucide-react";
import { ServiceLogo } from "../components/ServiceLogo";
import { isTemplateActive } from "@/domain/types";
import type { RecurrenceTemplate } from "@/domain/types";

const PAGE_SIZE = 12;

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const competencia = useUiStore((s) => s.competencia);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurrenceTemplate | null>(null);

  const catMap = useMemo(
    () => Object.fromEntries((categories ?? []).map((c) => [c.category_id, c.nome])),
    [categories],
  );
  const accMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a.nome])),
    [accounts],
  );

  const valid = useMemo(() => (templates ?? []).filter((t) => !!t.template_id), [templates]);

  const filtered = useMemo(() => {
    return valid.filter((t) => {
      const active = isTemplateActive(t, competencia);
      if (search && !t.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && t.categoria_id !== categoryFilter) return false;
      if (accountFilter !== "all" && t.payment_account_id !== accountFilter) return false;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      return true;
    });
  }, [valid, search, categoryFilter, accountFilter, statusFilter, competencia]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function applyFilter(fn: () => void) {
    fn();
    setPage(1);
  }

  function openCreate() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  function openEdit(t: RecurrenceTemplate) {
    setEditingTemplate(t);
    setDialogOpen(true);
  }

  return (
    <div className="px-4 py-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Recorrências"
        description="Templates que geram lançamentos mensais automaticamente."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Nova recorrência
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="Filtrar por nome..."
          value={search}
          onChange={(e) => applyFilter(() => setSearch(e.target.value))}
          className="max-w-xs"
        />

        <Select
          value={categoryFilter}
          onValueChange={(v) => applyFilter(() => setCategoryFilter(v))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.category_id} value={c.category_id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={accountFilter} onValueChange={(v) => applyFilter(() => setAccountFilter(v))}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {(accounts ?? []).map((a) => (
              <SelectItem key={a.account_id} value={a.account_id}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => applyFilter(() => setStatusFilter(v as typeof statusFilter))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : paged.map((t) => {
              const active = isTemplateActive(t, competencia);
              return (
                <Card key={t.template_id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <ServiceLogo
                        logoUrl={t.logo_url}
                        iconId={t.icon_id}
                        nome={t.nome}
                        size={36}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base truncate">{t.nome}</CardTitle>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant={active ? "default" : "outline"} className="text-[10px]">
                              {active ? "ativo" : "inativo"}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className="text-xs">
                          {catMap[t.categoria_id] ?? t.categoria_id}
                          {t.payment_account_id
                            ? ` · ${accMap[t.payment_account_id] ?? t.payment_account_id}`
                            : ""}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Desde {competenciaLabel(t.primeira_competencia)}
                    {t.ultima_competencia && ` até ${competenciaLabel(t.ultima_competencia)}`}
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground mt-6 text-center">
          Nenhuma recorrência encontrada.
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {safePage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            Próxima
          </Button>
        </div>
      )}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingTemplate(null);
        }}
        template={editingTemplate}
      />
    </div>
  );
}
