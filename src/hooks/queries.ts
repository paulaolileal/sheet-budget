import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSheetProvider } from "@/application/repositoryProvider";
import { isDueForCompetencia, isTemplateActive } from "@/domain/types";
import type {
  Account,
  Category,
  Debt,
  Debtor,
  Income,
  InvoiceAmount,
  PurchasePlan,
  Transaction,
  RecurrenceTemplate,
} from "@/domain/types";
import {
  accountInputSchema,
  categoryInputSchema,
  debtInputSchema,
  debtorInputSchema,
  incomeInputSchema,
  invoiceAmountInputSchema,
  purchasePlanInputSchema,
  transactionInputSchema,
  type AccountInput,
  type CategoryInput,
  type DebtInput,
  type DebtorInput,
  type IncomeInput,
  type InvoiceAmountInput,
  type PurchasePlanInput,
  type TransactionInput,
} from "@/domain/schemas";
import type { AmortizationInstallment } from "@/lib/amortization";
import {
  IMPORT_KIND_LABELS,
  type AccountImportRow,
  type CategoryImportRow,
  type DebtImportRow,
  type DebtorImportRow,
  type ImportKind,
  type IncomeImportRow,
  type TransactionImportRow,
} from "@/domain/importSchemas";
import { useUiStore } from "@/store/uiStore";
import { competenciaLabel, shiftCompetencia } from "@/utils/format";
import { transactionId } from "@/lib/idgen";
import { GoogleAuthError } from "@/infrastructure/google/googleApiFetch";
import { toast } from "sonner";

const repo = () => getSheetProvider();

/**
 * Shared `onError` for mutations. Session-expiry (`GoogleAuthError`) is already
 * surfaced once, globally, by the QueryClient's `mutationCache.onError` (see
 * main.tsx) with a persistent "Reconectar" toast — skip it here to avoid a
 * duplicate, generic-text toast on top of it.
 */
function onErrorToast(e: Error) {
  if (e instanceof GoogleAuthError) return;
  toast.error(e.message);
}

/**
 * Same as `onErrorToast`, but for mutations that open a `toast.loading(..., { id })`
 * from within `mutationFn` — on a session expiry that loading toast must be
 * dismissed instead of left spinning forever under the global reconnect toast.
 */
function onErrorDismissLoading(id: string) {
  return (e: Error) => {
    if (e instanceof GoogleAuthError) {
      toast.dismiss(id);
      return;
    }
    toast.error(e.message, { id });
  };
}

export const qk = {
  transactions: ["transactions"] as const,
  templates: ["templates"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  incomes: ["incomes"] as const,
  invoice_amounts: ["invoice_amounts"] as const,
  debtors: ["debtors"] as const,
  debts: ["debts"] as const,
  purchase_plans: ["purchase_plans"] as const,
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

export const useDebtors = () =>
  useQuery({
    queryKey: qk.debtors,
    queryFn: () => repo().getDebtors(),
    staleTime: STALE.transactional,
  });

export const useDebts = () =>
  useQuery({
    queryKey: qk.debts,
    queryFn: () => repo().getDebts(),
    staleTime: STALE.transactional,
  });

export const usePurchasePlans = () =>
  useQuery({
    queryKey: qk.purchase_plans,
    queryFn: () => repo().getPurchasePlans(),
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
    onError: onErrorToast,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: RecurrenceTemplate) => withSync(() => repo().saveTemplate(t)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.templates });
    },
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deleteTransaction(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.transactions }),
    onError: onErrorToast,
  });
}

type SeriesScope = "only_this" | "this_and_future" | "all";

export function useUpdateTransactionSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      transaction,
      patch,
      scope,
      allTransactions,
      templates,
    }: {
      transaction: Transaction;
      patch: Partial<Transaction>;
      scope: SeriesScope;
      allTransactions: Transaction[];
      templates: RecurrenceTemplate[];
    }) =>
      withSync(async () => {
        let targets: Transaction[] = [transaction];
        if (scope !== "only_this") {
          if (transaction.template_id) {
            targets = allTransactions.filter((tx) => tx.template_id === transaction.template_id);
          } else if (transaction.tipo_lancamento === "PARCELADO") {
            const baseDesc = transaction.descricao.replace(/\s*\(\d+\/\d+\)$/, "").trim();
            targets = allTransactions.filter(
              (tx) =>
                tx.tipo_lancamento === "PARCELADO" &&
                tx.descricao.replace(/\s*\(\d+\/\d+\)$/, "").trim() === baseDesc,
            );
          }
          if (scope === "this_and_future") {
            targets = targets.filter((tx) => tx.competencia >= transaction.competencia);
          }
        }

        for (const tx of targets) {
          const txPatch: Partial<Transaction> = { ...patch };
          if (tx.transaction_id !== transaction.transaction_id) {
            // competencia and status belong to each occurrence, not the series —
            // only the edited transaction itself may have them changed
            delete txPatch.competencia;
            delete txPatch.status;
          }
          if (patch.descricao && tx.tipo_lancamento === "PARCELADO") {
            const suffix = tx.descricao.match(/\s*\(\d+\/\d+\)$/)?.[0] ?? "";
            txPatch.descricao = patch.descricao.replace(/\s*\(\d+\/\d+\)$/, "").trim() + suffix;
          }
          await repo().updateTransaction(tx.transaction_id, txPatch);
        }

        if (transaction.template_id && scope !== "only_this") {
          const tpl = templates.find((t) => t.template_id === transaction.template_id);
          if (tpl) {
            await repo().saveTemplate({
              ...tpl,
              nome: patch.descricao ?? tpl.nome,
              categoria_id: patch.categoria_id ?? tpl.categoria_id,
              payment_account_id:
                patch.payment_account_id !== undefined
                  ? patch.payment_account_id
                  : tpl.payment_account_id,
            });
          }
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.transactions });
      qc.invalidateQueries({ queryKey: qk.templates });
      toast.success("Série atualizada");
    },
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
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
    onError: onErrorToast,
  });
}

function matchesTemplate(t: Transaction, tpl: RecurrenceTemplate): boolean {
  return (t.template_id != null && t.template_id === tpl.template_id) || t.descricao === tpl.nome;
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
    mutationFn: async (templateIds?: string[]) => {
      const competencia = useUiStore.getState().competencia;
      const [txs, templates] = await Promise.all([repo().getTransactions(), repo().getTemplates()]);

      const missing = templates.filter((tpl) => {
        if (!isTemplateActive(tpl, competencia)) return false;
        if (!isDueForCompetencia(tpl, competencia)) return false;
        if (templateIds && !templateIds.includes(tpl.template_id)) return false;
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
          plan_id: null,
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
    onError: onErrorDismissLoading("gen-recurring"),
  });
}

export function useCreateDebtor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DebtorInput) => {
      const parsed = debtorInputSchema.parse(input);
      return withSync(() => repo().createDebtor(parsed));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.debtors });
      toast.success("Devedor criado");
    },
    onError: onErrorToast,
  });
}

export function useUpdateDebtor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DebtorInput }) => {
      const parsed = debtorInputSchema.parse(data);
      return withSync(() => repo().updateDebtor(id, parsed));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.debtors });
      toast.success("Devedor atualizado");
    },
    onError: onErrorToast,
  });
}

export function useDeleteDebtor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deleteDebtor(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.debtors });
      qc.invalidateQueries({ queryKey: qk.debts });
      toast.success("Devedor excluído");
    },
    onError: onErrorToast,
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DebtInput) => {
      const parsed = debtInputSchema.parse(input);
      return withSync(() => repo().createDebt(parsed));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.debts });
      toast.success("Dívida adicionada");
    },
    onError: onErrorToast,
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Debt> }) =>
      withSync(() => repo().updateDebt(id, patch)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.debts });
    },
    onError: onErrorToast,
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deleteDebt(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.debts });
      toast.success("Dívida excluída");
    },
    onError: onErrorToast,
  });
}

export function useBulkPayDebtorMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ debtor_id, competencia }: { debtor_id: string; competencia: string }) =>
      withSync(() => repo().bulkPayDebtorMonth(debtor_id, competencia)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.debts });
      toast.success("Dívidas do mês marcadas como pagas");
    },
    onError: onErrorToast,
  });
}

/** Resolves entity names to ids, creating any name not found among `existing`. */
async function resolveIdsByName<T>(
  names: string[],
  existing: T[],
  nomeOf: (item: T) => string,
  idOf: (item: T) => string,
  create: (nome: string) => Promise<T>,
): Promise<Map<string, string>> {
  const byLowerName = new Map(existing.map((item) => [nomeOf(item).toLowerCase(), idOf(item)]));
  const uniqueNames = [...new Set(names.map((n) => n.toLowerCase()))];
  for (const lower of uniqueNames) {
    if (byLowerName.has(lower)) continue;
    const original = names.find((n) => n.toLowerCase() === lower)!;
    const created = await create(original);
    byLowerName.set(lower, idOf(created));
  }
  return byLowerName;
}

type ImportPayload =
  | { kind: "categorias"; rows: CategoryImportRow[] }
  | { kind: "contas"; rows: AccountImportRow[] }
  | { kind: "receitas"; rows: IncomeImportRow[] }
  | { kind: "devedores"; rows: DebtorImportRow[] }
  | { kind: "transacoes"; rows: TransactionImportRow[] }
  | { kind: "dividas"; rows: DebtImportRow[] };

/** Imports validated CSV rows for the given entity kind, creating referenced entities (by name) on the fly. */
export function useImportRows() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ImportPayload): Promise<{ kind: ImportKind; count: number }> => {
      const label = IMPORT_KIND_LABELS[payload.kind];
      toast.loading(`Importando ${label.toLowerCase()}...`, { id: "import-rows" });

      return withSync(async () => {
        switch (payload.kind) {
          case "categorias": {
            for (const row of payload.rows) {
              const data = categoryInputSchema.parse({ nome: row.nome, icon_id: row.icone });
              await repo().createCategory(data);
            }
            return { kind: payload.kind, count: payload.rows.length };
          }
          case "contas": {
            for (const row of payload.rows) {
              const data = accountInputSchema.parse({
                nome: row.nome,
                tipo: row.tipo,
                color: row.cor,
                icon_id: row.icone,
              });
              await repo().createAccount(data);
            }
            return { kind: payload.kind, count: payload.rows.length };
          }
          case "receitas": {
            for (const row of payload.rows) {
              const data = incomeInputSchema.parse({
                competencia: row.competencia,
                descricao: row.descricao,
                valor: row.valor,
                icon_id: row.icone,
              });
              await repo().createIncome(data);
            }
            return { kind: payload.kind, count: payload.rows.length };
          }
          case "devedores": {
            for (const row of payload.rows) {
              const data = debtorInputSchema.parse({ nome: row.nome, telefone: row.telefone });
              await repo().createDebtor(data);
            }
            return { kind: payload.kind, count: payload.rows.length };
          }
          case "transacoes": {
            const [categories, accounts] = await Promise.all([
              repo().getCategories(),
              repo().getAccounts(),
            ]);
            const categoriaIds = await resolveIdsByName<Category>(
              payload.rows.map((r) => r.categoria),
              categories,
              (c) => c.nome,
              (c) => c.category_id,
              (nome) => repo().createCategory({ nome }),
            );
            const contaNames = payload.rows.map((r) => r.conta).filter((v): v is string => !!v);
            const contaIds = await resolveIdsByName<Account>(
              contaNames,
              accounts,
              (a) => a.nome,
              (a) => a.account_id,
              (nome) => repo().createAccount({ nome, tipo: "CONTA" }),
            );
            const toCreate = payload.rows.map((row) =>
              transactionInputSchema.parse({
                competencia: row.competencia,
                descricao: row.descricao,
                categoria_id: categoriaIds.get(row.categoria.toLowerCase())!,
                valor: row.valor,
                status: row.status,
                payment_account_id: row.conta
                  ? (contaIds.get(row.conta.toLowerCase()) ?? null)
                  : null,
                tipo_lancamento: row.tipo_lancamento,
                template_id: null,
              }),
            );
            const created = await repo().createTransactionsBatch(
              toCreate as (Omit<Transaction, "transaction_id"> & { transaction_id?: string })[],
            );
            return { kind: payload.kind, count: created.length };
          }
          case "dividas": {
            const debtors = await repo().getDebtors();
            const devedorIds = await resolveIdsByName<Debtor>(
              payload.rows.map((r) => r.devedor),
              debtors,
              (d) => d.nome,
              (d) => d.debtor_id,
              (nome) => repo().createDebtor({ nome }),
            );
            const toCreate = payload.rows.map((row) =>
              debtInputSchema.parse({
                debtor_id: devedorIds.get(row.devedor.toLowerCase())!,
                competencia: row.competencia,
                descricao: row.descricao,
                valor: row.valor,
                status: row.status,
                tipo: row.tipo,
              }),
            );
            const created = await repo().createDebtsBatch(toCreate);
            return { kind: payload.kind, count: created.length };
          }
        }
      });
    },
    onSuccess: async ({ kind, count }) => {
      const primaryKey: Record<ImportKind, (typeof qk)[keyof typeof qk]> = {
        categorias: qk.categories,
        contas: qk.accounts,
        receitas: qk.incomes,
        devedores: qk.debtors,
        transacoes: qk.transactions,
        dividas: qk.debts,
      };
      await qc.invalidateQueries({ queryKey: primaryKey[kind] });
      if (kind === "transacoes") {
        await qc.invalidateQueries({ queryKey: qk.categories });
        await qc.invalidateQueries({ queryKey: qk.accounts });
      }
      if (kind === "dividas") {
        await qc.invalidateQueries({ queryKey: qk.debtors });
      }
      const label = IMPORT_KIND_LABELS[kind];
      toast.success(`${count} registro(s) importado(s) em ${label}`, { id: "import-rows" });
    },
    onError: onErrorDismissLoading("import-rows"),
  });
}

/** Duplicates the selected previous-month debts (only RECORRENTE ones are eligible) into the active competencia. */
export function useDuplicatePreviousMonthDebts() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (debtIds: string[]) => {
      const competencia = useUiStore.getState().competencia;
      const debts = await repo().getDebts();

      const toCopy = debts.filter((d) => d.tipo === "RECORRENTE" && debtIds.includes(d.debt_id));

      if (toCopy.length === 0) return { count: 0, competencia };

      const monthLabel = competenciaLabel(competencia);
      toast.loading(`Duplicando dívidas para ${monthLabel}...`, { id: "dup-debts" });

      const created = await repo().createDebtsBatch(
        toCopy.map((d) => ({
          debtor_id: d.debtor_id,
          competencia,
          descricao: d.descricao,
          valor: d.valor,
          status: "PENDENTE" as const,
          tipo: d.tipo,
        })),
      );

      return { count: created.length, competencia };
    },
    onSuccess: async ({ count, competencia }) => {
      await qc.invalidateQueries({ queryKey: qk.debts });
      const monthLabel = competenciaLabel(competencia);
      if (count === 0) {
        toast.info(`Nenhuma dívida duplicada para ${monthLabel}`, { id: "dup-debts" });
      } else {
        toast.success(`${count} dívida(s) duplicada(s) para ${monthLabel}`, { id: "dup-debts" });
      }
    },
    onError: onErrorDismissLoading("dup-debts"),
  });
}

export function useCreatePurchasePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PurchasePlanInput) => {
      const parsed = purchasePlanInputSchema.parse(input);
      return withSync(() => repo().createPurchasePlan(parsed));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.purchase_plans });
      toast.success("Planejamento salvo");
    },
    onError: onErrorToast,
  });
}

export function useUpdatePurchasePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PurchasePlan> }) =>
      withSync(() => repo().updatePurchasePlan(id, patch)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.purchase_plans });
      toast.success("Planejamento atualizado");
    },
    onError: onErrorToast,
  });
}

export function useDeletePurchasePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withSync(() => repo().deletePurchasePlan(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.purchase_plans });
      toast.success("Planejamento excluído");
    },
    onError: onErrorToast,
  });
}

/**
 * Confirms a purchase plan: creates the real PARCELADO transactions for the given
 * (already computed) amortization schedule, linked back to the plan via `plan_id`,
 * then flips the plan's status to CONFIRMADO.
 */
export function useConfirmPurchasePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      plan,
      installments,
    }: {
      plan: PurchasePlan;
      installments: AmortizationInstallment[];
    }) =>
      withSync(async () => {
        const created = await repo().createTransactionsBatch(
          installments.map((row) => ({
            competencia: shiftCompetencia(plan.competencia_inicio, row.numero_parcela - 1),
            descricao: `${plan.nome} (${row.numero_parcela}/${installments.length})`,
            categoria_id: plan.categoria_id ?? "",
            valor: row.valor_parcela,
            status: "PENDENTE" as const,
            payment_account_id: plan.payment_account_id ?? null,
            tipo_lancamento: "PARCELADO" as const,
            template_id: null,
            plan_id: plan.plan_id,
          })),
        );
        await repo().updatePurchasePlan(plan.plan_id, { status: "CONFIRMADO" });
        return created;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.transactions });
      qc.invalidateQueries({ queryKey: qk.purchase_plans });
      toast.success("Compra confirmada — parcelas criadas em Lançamentos");
    },
    onError: onErrorToast,
  });
}
