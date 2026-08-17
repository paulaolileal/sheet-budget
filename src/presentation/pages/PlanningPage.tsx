import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { PlanVerdictBadge } from "../components/PlanVerdictBadge";
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
import { usePurchasePlans } from "@/hooks/queries";
import { useMonthlyBalanceProjection } from "@/hooks/useMonthlyBalanceProjection";
import { buildPlanAmortization, evaluatePlanFit } from "@/domain/purchasePlanning";
import { brl } from "@/utils/format";
import { PiggyBank, Plus } from "lucide-react";
import type { PurchasePlan } from "@/domain/types";

const PAGE_SIZE = 12;

const AMORT_LABEL: Record<PurchasePlan["forma_amortizacao"], string> = {
  PRICE: "Price",
  SAC: "SAC",
  SEM_JUROS: "Sem juros",
};

const STATUS_LABEL: Record<PurchasePlan["status"], string> = {
  RASCUNHO: "Rascunho",
  SIMULANDO: "Simulando",
  CONFIRMADO: "Confirmado",
  DESCARTADO: "Descartado",
};

type StatusFilter = "all" | "ativos" | "confirmados" | "descartados";

export function PlanningPage() {
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePurchasePlans();
  // 24-month horizon covers any plan started soon, even with a long installment count.
  const projection = useMonthlyBalanceProjection(24);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return (plans ?? []).filter((p) => {
      if (search && !p.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter === "ativos" && p.status !== "RASCUNHO" && p.status !== "SIMULANDO")
        return false;
      if (statusFilter === "confirmados" && p.status !== "CONFIRMADO") return false;
      if (statusFilter === "descartados" && p.status !== "DESCARTADO") return false;
      return true;
    });
  }, [plans, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function applyFilter(fn: () => void) {
    fn();
    setPage(1);
  }

  return (
    <div className="px-4 py-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Planejamento"
        description="Simule compras de alto valor antes de se comprometer — parcelas, juros e se cabem no orçamento."
        actions={
          <Button onClick={() => navigate("/planning/novo")}>
            <Plus className="h-4 w-4 mr-1" />
            Novo plano
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4 w-full">
        <Input
          placeholder="Filtrar por nome..."
          value={search}
          onChange={(e) => applyFilter(() => setSearch(e.target.value))}
          className="flex-1 min-w-[10rem]"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => applyFilter(() => setStatusFilter(v as StatusFilter))}
        >
          <SelectTrigger className="flex-1 min-w-[10rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="confirmados">Confirmados</SelectItem>
            <SelectItem value="descartados">Descartados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          : paged.map((p) => {
              const amortization = buildPlanAmortization(p);
              const parcela = amortization[0]?.valor_parcela ?? 0;
              const evaluations = projection
                ? evaluatePlanFit({
                    projection,
                    amortization,
                    competenciaInicio: p.competencia_inicio,
                    margemMinima: p.margem_minima,
                  })
                : [];

              return (
                <Card
                  key={p.plan_id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/planning/${p.plan_id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{p.nome}</CardTitle>
                        <CardDescription className="text-xs">
                          {brl(p.valor_compra)} em {p.numero_parcelas}x ·{" "}
                          {AMORT_LABEL[p.forma_amortizacao]}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={p.status === "CONFIRMADO" ? "default" : "outline"}
                        className="text-[10px] shrink-0"
                      >
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Parcela </span>
                      <span className="font-semibold tabular-nums">{brl(parcela)}</span>
                    </div>
                    {evaluations.length > 0 && <PlanVerdictBadge evaluations={evaluations} />}
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="mt-10 text-center">
          <PiggyBank className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Nenhum planejamento ainda. Simule uma compra grande antes de se comprometer.
          </p>
          <Button onClick={() => navigate("/planning/novo")}>
            <Plus className="h-4 w-4 mr-1" />
            Criar primeiro plano
          </Button>
        </div>
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
    </div>
  );
}
