import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepository } from "@/application/repositoryProvider";
import type { Transaction, RecurrenceTemplate } from "@/domain/types";
import { transactionInputSchema, type TransactionInput } from "@/domain/schemas";
import { useUiStore } from "@/store/uiStore";
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
