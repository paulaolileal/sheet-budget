import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepository } from "@/application/repositoryProvider";
import type { Transaction, RecurrenceTemplate } from "@/domain/types";
import { transactionInputSchema, type TransactionInput } from "@/domain/schemas";
import { useUiStore } from "@/store/uiStore";
import { competenciaLabel } from "@/utils/format";
import { transactionId } from "@/lib/idgen";
import { toast } from "sonner";

const repo = () => getRepository();

export const qk = {
  transactions: ["transactions"] as const,
  templates: ["templates"] as const,
  groups: ["payment-groups"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
};

export const useTransactions = () =>
  useQuery({ queryKey: qk.transactions, queryFn: () => repo().getTransactions() });

export const useTemplates = () =>
  useQuery({ queryKey: qk.templates, queryFn: () => repo().getTemplates() });

export const usePaymentGroups = () =>
  useQuery({ queryKey: qk.groups, queryFn: () => repo().getPaymentGroups() });

export const useAccounts = () =>
  useQuery({ queryKey: qk.accounts, queryFn: () => repo().getAccounts() });

export const useCategories = () =>
  useQuery({ queryKey: qk.categories, queryFn: () => repo().getCategories() });

function withSync<T>(fn: () => Promise<T>): Promise<T> {
  useUiStore.getState().setSync("syncing");
  return fn()
    .then((r) => {
      useUiStore.getState().setSync("saved");
      setTimeout(() => useUiStore.getState().setSync("idle"), 1500);
      return r;
    })
    .catch((err) => {
      useUiStore.getState().setSync("error");
      throw err;
    });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const parsed = transactionInputSchema.parse(input);
      return withSync(() =>
        repo().createTransaction(parsed as Omit<Transaction, "transaction_id"> & { transaction_id?: string }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.transactions });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: RecurrenceTemplate) => withSync(() => repo().saveTemplate(t)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.templates });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Transaction> }) =>
      withSync(() => repo().updateTransaction(id, patch)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.transactions });
      toast.success("Lançamento atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deleteTransaction(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.transactions }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkGroupPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().markGroupPaid(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.groups });
      qc.invalidateQueries({ queryKey: qk.transactions });
      toast.success("Fatura marcada como paga");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function matchesTemplate(t: Transaction, tpl: RecurrenceTemplate): boolean {
  return (
    (t.template_id != null && t.template_id === tpl.template_id) ||
    t.origem === `template:${tpl.template_id}` ||
    t.descricao === tpl.nome
  );
}

function resolveLastValue(txs: Transaction[], tpl: RecurrenceTemplate, beforeCompetencia: string): number {
  const lastTx = txs
    .filter((t) => t.competencia < beforeCompetencia && t.status !== "CANCELADO" && matchesTemplate(t, tpl))
    .sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
  return lastTx?.valor_previsto ?? tpl.valor_padrao ?? 0;
}

function alreadyExists(txs: Transaction[], tpl: RecurrenceTemplate, competencia: string): boolean {
  const expectedId = transactionId(competencia, tpl.nome);
  return txs.some(
    (t) =>
      t.competencia === competencia &&
      t.status !== "CANCELADO" &&
      (t.transaction_id === expectedId || matchesTemplate(t, tpl)),
  );
}

// Module-level: survives React StrictMode double-invocations and AppShell remounts.
// useRef would reset on every unmount/remount, causing duplicate batch creation.
let _autoGenRunning = false;
const _autoGenProcessed = new Set<string>();

export function useAutoGenerateRecurring() {
  const competencia = useUiStore((s) => s.competencia);
  const qc = useQueryClient();

  useEffect(() => {
    if (_autoGenRunning) return;
    if (_autoGenProcessed.has(competencia)) return;
    _autoGenRunning = true;

    void (async () => {
      try {
        const [txs, templates] = await Promise.all([
          repo().getTransactions(),
          repo().getTemplates(),
        ]);

        const missing = templates.filter((tpl) => {
          if (!tpl.ativo) return false;
          if (tpl.primeira_competencia > competencia) return false;
          if (tpl.ultima_competencia && competencia > tpl.ultima_competencia) return false;
          return !alreadyExists(txs, tpl, competencia);
        });

        // Mark as processed only after a successful source read (API errors stay retryable)
        _autoGenProcessed.add(competencia);

        if (missing.length === 0) return;

        const monthLabel = competenciaLabel(competencia);
        toast.loading(`Criando transações recorrentes para ${monthLabel}...`, { id: "auto-gen" });
        useUiStore.getState().setGenerating(true);

        const created = await repo().createTransactionsBatch(
          missing.map((tpl) => ({
            competencia,
            descricao: tpl.nome,
            categoria_id: tpl.categoria_id,
            valor_previsto: resolveLastValue(txs, tpl, competencia),
            valor_final: null,
            status: "PENDENTE" as const,
            considerar_resumo: tpl.considerar_resumo,
            payment_account_id: tpl.payment_account_id,
            payment_group_id: null,
            tipo_lancamento: "RECORRENTE" as const,
            origem: `template:${tpl.template_id}`,
            template_id: tpl.template_id,
          })),
        );

        await qc.invalidateQueries({ queryKey: qk.transactions });
        toast.success(`${created.length} transações recorrentes criadas para ${monthLabel}`, { id: "auto-gen" });
      } catch (err) {
        console.error("[AutoGenRecurring]", err);
        toast.error("Erro ao gerar transações recorrentes", { id: "auto-gen" });
      } finally {
        _autoGenRunning = false;
        useUiStore.getState().setGenerating(false);
      }
    })();
  }, [competencia, qc]);
}
