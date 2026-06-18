import type {
  Account,
  AccountTipo,
  Category,
  Income,
  InvoiceAmount,
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
  createTransaction(
    t: Omit<Transaction, "transaction_id"> & { transaction_id?: string },
  ): Promise<Transaction>;
  createTransactionsBatch(
    ts: (Omit<Transaction, "transaction_id"> & { transaction_id?: string })[],
  ): Promise<Transaction[]>;
  updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  bulkPayByAccount(payment_account_id: string, competencia: string): Promise<void>;

  // templates
  getTemplates(): Promise<RecurrenceTemplate[]>;
  saveTemplate(t: RecurrenceTemplate): Promise<RecurrenceTemplate>;
  deleteTemplate(id: string): Promise<void>;

  // accounts
  getAccounts(): Promise<Account[]>;
  createAccount(data: { nome: string; tipo: AccountTipo; icon_id?: string }): Promise<Account>;
  updateAccount(
    id: string,
    data: { nome: string; tipo: AccountTipo; icon_id?: string },
  ): Promise<Account>;
  deleteAccount(id: string): Promise<void>;

  // categories
  getCategories(): Promise<Category[]>;
  createCategory(data: Omit<Category, "category_id">): Promise<Category>;
  updateCategory(cat: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  // incomes
  getIncomes(): Promise<Income[]>;
  createIncome(data: Omit<Income, "income_id">): Promise<Income>;
  updateIncome(id: string, patch: Partial<Omit<Income, "income_id">>): Promise<Income>;
  deleteIncome(id: string): Promise<void>;

  // invoice amounts
  getInvoiceAmounts(): Promise<InvoiceAmount[]>;
  saveInvoiceAmount(data: Omit<InvoiceAmount, "invoice_id">): Promise<InvoiceAmount>;
}
