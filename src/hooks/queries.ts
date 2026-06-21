import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepository } from "@/application/repositoryProvider";
import { isTemplateActive } from "@/domain/types";
import type {
  Category,
  Income,
  InvoiceAmount,
  Transaction,
  RecurrenceTemplate,
} from "@/domain/types";
import {
  accountInputSchema,
  categoryInputSchema,
  incomeInputSchema,
  invoiceAmountInputSchema,
  transactionInputSchema,
  type AccountInput,
  type CategoryInput,
  type IncomeInput,
  type InvoiceAmountInput,
  type TransactionInput,
} from "@/domain/schemas";
import { useUiStore } from "@/store/uiStore";
import { competenciaLabel } from "@/utils/format";
import { transactionId } from "@/lib/idgen";
import { toast } from "sonner";

const repo = () => getRepository();

export const qk = {
  transactions: ["transactions"] as const,
  templates: ["templates"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  incomes: ["incomes"] as const,
  invoice_amounts: ["invoice_amounts"] as const,
};

const STALE = {
  reference: 10 * 60 * 1000, // accounts, categories — rarely change
  template: 5 * 60 * 1000, // recurrence templates — change occasionally
  transactional: 2 * 60 * 1000, // transactions, incomes, invoices — default
} as const;

export const useTransactions = () =>
  useQuery({
    queryKey: qk.transactions,
    queryFn: () => repo().getTransactions(),
    staleTime: STALE.transactional,
  });

export const useTemplates = () =>
  useQuery({
    queryKey: qk.templates,
    queryFn: () => repo().getTemplates(),
    staleTime: STALE.template,
  });

export const useAccounts = () =>
  useQuery({
    queryKey: qk.accounts,
    queryFn: () => repo().getAccounts(),
    staleTime: STALE.reference,
  });

export const useCategories = () =>
  useQuery({
    queryKey: qk.categories,
    queryFn: () => repo().getCategories(),
    staleTime: STALE.reference,
  });

export const useIncomes = () =>
  useQuery({
    queryKey: qk.incomes,
    queryFn: () => repo().getIncomes(),
    staleTime: STALE.transactional,
  });

export const useInvoiceAmounts = () =>
  useQuery({
    queryKey: qk.invoice_amounts,
    queryFn: () => repo().getInvoiceAmounts(),
    staleTime: STALE.transactional,
  });

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
        repo().createTransaction(
          parsed as Omit<Transaction, "transaction_id"> & { transaction_id?: string },
        ),
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

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: RecurrenceTemplate) => withSync(() => repo().saveTemplate(t)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.templates });
      toast.success("Recorrência atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deleteTemplate(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.templates });
      toast.success("Recorrência excluída");
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

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AccountInput) => {
      const parsed = accountInputSchema.parse(input);
      return withSync(() => repo().createAccount(parsed));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      toast.success("Conta criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AccountInput }) => {
      const parsed = accountInputSchema.parse(data);
      return withSync(() => repo().updateAccount(id, parsed));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      toast.success("Conta atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deleteAccount(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      qc.invalidateQueries({ queryKey: qk.transactions });
      toast.success("Conta excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      const parsed = categoryInputSchema.parse(input);
      return withSync(() => repo().createCategory(parsed));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories });
      toast.success("Categoria criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: Category) => withSync(() => repo().updateCategory(cat)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories });
      toast.success("Categoria atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deleteCategory(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories });
      qc.invalidateQueries({ queryKey: qk.transactions });
      qc.invalidateQueries({ queryKey: qk.templates });
      toast.success("Categoria excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IncomeInput) => {
      const parsed = incomeInputSchema.parse(input);
      return withSync(() => repo().createIncome(parsed));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.incomes });
      toast.success("Receita adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<Income, "income_id">> }) =>
      withSync(() => repo().updateIncome(id, patch)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.incomes });
      toast.success("Receita atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deleteIncome(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.incomes });
      toast.success("Receita excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveInvoiceAmount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InvoiceAmountInput) => {
      const parsed = invoiceAmountInputSchema.parse(input);
      return withSync(() => repo().saveInvoiceAmount(parsed as Omit<InvoiceAmount, "invoice_id">));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoice_amounts });
      toast.success("Valor da fatura salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBulkPayByAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      payment_account_id,
      competencia,
    }: {
      payment_account_id: string;
      competencia: string;
    }) => withSync(() => repo().bulkPayByAccount(payment_account_id, competencia)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.transactions });
      toast.success("Fatura marcada como paga");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function matchesTemplate(t: Transaction, tpl: RecurrenceTemplate): boolean {
  return (t.template_id != null && t.template_id === tpl.template_id) || t.descricao === tpl.nome;
}

function isDueForCompetencia(tpl: RecurrenceTemplate, competencia: string): boolean {
  if (tpl.recurrence_type !== "A") return true;
  return tpl.primeira_competencia.slice(5) === competencia.slice(5);
}

function resolveLastValue(
  txs: Transaction[],
  tpl: RecurrenceTemplate,
  beforeCompetencia: string,
): number {
  const lastTx = txs
    .filter((t) => t.competencia < beforeCompetencia && matchesTemplate(t, tpl))
    .sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
  return lastTx?.valor ?? 0;
}

function alreadyExists(txs: Transaction[], tpl: RecurrenceTemplate, competencia: string): boolean {
  const expectedId = transactionId(competencia, tpl.nome);
  return txs.some(
    (t) =>
      t.competencia === competencia && (t.transaction_id === expectedId || matchesTemplate(t, tpl)),
  );
}

export function useGenerateRecurring() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const competencia = useUiStore.getState().competencia;
      const [txs, templates] = await Promise.all([repo().getTransactions(), repo().getTemplates()]);

      const missing = templates.filter((tpl) => {
        if (!isTemplateActive(tpl, competencia)) return false;
        if (!isDueForCompetencia(tpl, competencia)) return false;
        return !alreadyExists(txs, tpl, competencia);
      });

      if (missing.length === 0) return { count: 0, competencia };

      const monthLabel = competenciaLabel(competencia);
      toast.loading(`Criando recorrências para ${monthLabel}...`, { id: "gen-recurring" });

      const created = await repo().createTransactionsBatch(
        missing.map((tpl) => ({
          competencia,
          descricao: tpl.nome,
          categoria_id: tpl.categoria_id,
          valor: resolveLastValue(txs, tpl, competencia),
          status: "PENDENTE" as const,
          payment_account_id: tpl.payment_account_id,
          tipo_lancamento: "RECORRENTE" as const,
          template_id: tpl.template_id,
        })),
      );

      return { count: created.length, competencia };
    },
    onSuccess: async ({ count, competencia }) => {
      await qc.invalidateQueries({ queryKey: qk.transactions });
      const monthLabel = competenciaLabel(competencia);
      if (count === 0) {
        toast.info(`Nenhuma recorrência pendente para ${monthLabel}`, { id: "gen-recurring" });
      } else {
        toast.success(`${count} recorrências criadas para ${monthLabel}`, { id: "gen-recurring" });
      }
    },
    onError: (e: Error) => {
      toast.error(e.message, { id: "gen-recurring" });
    },
  });
}
