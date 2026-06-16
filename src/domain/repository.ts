import type {
  Account,
  Category,
  PaymentGroup,
  RecurrenceTemplate,
  Transaction,
} from "./types";

/**
 * Contrato do repositório. A camada de infraestrutura implementa
 * (mock local ou Google Sheets) sem que UI nem domínio precisem saber.
 */
export interface FinanceRepository {
  // transactions
  getTransactions(): Promise<Transaction[]>;
  createTransaction(t: Omit<Transaction, "transaction_id"> & { transaction_id?: string }): Promise<Transaction>;
  createTransactionsBatch(ts: (Omit<Transaction, "transaction_id"> & { transaction_id?: string })[]): Promise<Transaction[]>;
  updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  // templates
  getTemplates(): Promise<RecurrenceTemplate[]>;
  saveTemplate(t: RecurrenceTemplate): Promise<RecurrenceTemplate>;

  // payment groups
  getPaymentGroups(): Promise<PaymentGroup[]>;
  markGroupPaid(id: string): Promise<void>;

  // catálogos
  getAccounts(): Promise<Account[]>;
  getCategories(): Promise<Category[]>;
}
