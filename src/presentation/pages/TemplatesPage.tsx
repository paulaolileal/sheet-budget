import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCategories,
  useAccounts,
  useTemplates,
  useTransactions,
  useCreateTransaction,
} from "@/hooks/queries";
import { useUiStore } from "@/store/uiStore";
import { competenciaLabel, currentCompetencia } from "@/utils/format";
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

  const catMap = useMemo(() => Object.fromEntries((categories ?? []).map((c) => [c.category_id, c.nome])), [categories]);
  const accMap = useMemo(() => Object.fromEntries((accounts ?? []).map((a) => [a.account_id, a.nome])), [accounts]);

  const filtered = (templates ?? []).filter((t) =>
    !filter || t.nome.toLowerCase().includes(filter.toLowerCase()),
  );

  /** Para cada template ativo cuja primeira_competencia <= competencia atual,
   *  gera o lançamento se não existir nessa competência. */
  async function gerarMes() {
    if (!templates || !txs) return;
    setRunning(true);
    let criados = 0;
    try {
      const target = competencia;
      const existing = new Set(
        txs.filter((t) => t.competencia === target).map((t) => `${t.template_id ?? ""}|${t.descricao}`),
      );
      for (const tpl of templates) {
        if (!tpl.ativo) continue;
        if (tpl.primeira_competencia > target) continue;
        const key = `${tpl.template_id}|${tpl.nome}`;
        if (existing.has(key)) continue;
        const sample = txs.find((t) => t.template_id === tpl.template_id);
        await create.mutateAsync({
          competencia: target,
          descricao: tpl.nome,
          categoria_id: tpl.categoria_id,
          valor_previsto: sample?.valor_previsto ?? 0,
          valor_final: null,
          status: "PLANEJADO",
          considerar_resumo: tpl.considerar_resumo,
          payment_account_id: tpl.payment_account_id,
          payment_group_id: null,
          tipo_lancamento: "RECORRENTE",
          origem: `template:${tpl.template_id}`,
          template_id: tpl.template_id,
        });
        criados++;
      }
      toast.success(`${criados} lançamento(s) gerados para ${competenciaLabel(target)}`);
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
          <Button onClick={gerarMes} disabled={running || isLoading}>
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
                  Desde {competenciaLabel(t.primeira_competencia)} · {t.considerar_resumo ? "no resumo" : "fora do resumo"}
                </CardContent>
              </Card>
            ))}
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Dica: ao abrir um novo mês, use o botão acima para materializar todos os templates ativos.
        Lançamentos existentes nunca são duplicados.
      </p>
      {/* gambi para silenciar warning de variável usada apenas em mensagem */}
      <span className="hidden">{currentCompetencia()}</span>
    </div>
  );
}
