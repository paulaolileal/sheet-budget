import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  useCategories,
  useAccounts,
  useTemplates,
  useTransactions,
  useCreateTransaction,
} from "@/hooks/queries";
import { useUiStore } from "@/store/uiStore";
import { brl, competenciaLabel } from "@/utils/format";
import { Play, Repeat } from "lucide-react";
import { toast } from "sonner";

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: txs } = useTransactions();
  const create = useCreateTransaction();
  const competencia = useUiStore((s) => s.competencia);
  const [filter, setFilter] = useState("");
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const catMap = useMemo(() => Object.fromEntries((categories ?? []).map((c) => [c.category_id, c.nome])), [categories]);
  const accMap = useMemo(() => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a.nome])), [accounts]);

  const filtered = (templates ?? []).filter((t) =>
    !filter || t.nome.toLowerCase().includes(filter.toLowerCase()),
  );

  const pendingTemplates = useMemo(() => {
    if (!templates || !txs) return [];
    const target = competencia;
    const existingKeys = new Set(
      txs.filter((t) => t.competencia === target && t.template_id).map((t) => t.template_id!),
    );
    return templates.filter((tpl) => {
      if (!tpl.ativo) return false;
      if (tpl.primeira_competencia > target) return false;
      if (tpl.ultima_competencia && target > tpl.ultima_competencia) return false;
      if (existingKeys.has(tpl.template_id)) return false;
      return true;
    });
  }, [templates, txs, competencia]);

  async function gerarMes() {
    setConfirmOpen(false);
    setRunning(true);
    let criados = 0;
    try {
      for (const tpl of pendingTemplates) {
        await create.mutateAsync({
          competencia,
          descricao: tpl.nome,
          categoria_id: tpl.categoria_id,
          valor_previsto: tpl.valor_padrao ?? 0,
          valor_final: null,
          status: "PENDENTE",
          considerar_resumo: tpl.considerar_resumo,
          payment_account_id: tpl.payment_account_id,
          tipo_lancamento: "RECORRENTE",
          origem: `template:${tpl.template_id}`,
          template_id: tpl.template_id,
        });
        criados++;
      }
      if (criados > 0) toast.success(`${criados} lançamento(s) gerados para ${competenciaLabel(competencia)}`);
      else toast.info(`Todos os templates já estão gerados para ${competenciaLabel(competencia)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Recorrências"
        description={`Templates ativos geram automaticamente lançamentos mensais.`}
        actions={
          <Button onClick={() => setConfirmOpen(true)} disabled={running || isLoading}>
            <Play className="h-4 w-4 mr-1" />
            Gerar para {competenciaLabel(competencia)}
          </Button>
        }
      />
      <div className="mb-4">
        <Input placeholder="Filtrar..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : filtered.map((t) => (
              <Card key={t.template_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Repeat className="h-4 w-4" /> {t.nome}
                    </CardTitle>
                    <Badge variant={t.ativo ? "default" : "outline"} className="text-[10px]">
                      {t.ativo ? "ativo" : "inativo"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {catMap[t.categoria_id] ?? t.categoria_id} · {t.payment_account_id ? accMap[t.payment_account_id] : "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Desde {competenciaLabel(t.primeira_competencia)}
                  {t.ultima_competencia && ` até ${competenciaLabel(t.ultima_competencia)}`}
                  {" · "}{t.considerar_resumo ? "no resumo" : "fora do resumo"}
                  {t.valor_padrao != null && ` · R$ ${t.valor_padrao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </CardContent>
              </Card>
            ))}
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Lançamentos são gerados automaticamente ao entrar em um novo mês. Use o botão acima para forçar a geração manualmente.
      </p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar lançamentos para {competenciaLabel(competencia)}</DialogTitle>
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
            <Button onClick={gerarMes} disabled={pendingTemplates.length === 0 || running}>
              <Play className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
