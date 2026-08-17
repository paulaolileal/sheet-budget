import type {
  Account,
  AccountTipo,
  Category,
  Debt,
  Debtor,
  Income,
  InvoiceAmount,
  PurchasePlan,
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
  createAccount(data: {
    nome: string;
    tipo: AccountTipo;
    icon_id?: string;
    color?: string;
  }): Promise<Account>;
  updateAccount(
    id: string,
    data: { nome: string; tipo: AccountTipo; icon_id?: string; color?: string },
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

  // debtors
  getDebtors(): Promise<Debtor[]>;
  createDebtor(data: Omit<Debtor, "debtor_id">): Promise<Debtor>;
  updateDebtor(id: string, patch: Partial<Omit<Debtor, "debtor_id">>): Promise<Debtor>;
  deleteDebtor(id: string): Promise<void>;

  // debts
  getDebts(): Promise<Debt[]>;
  createDebt(data: Omit<Debt, "debt_id">): Promise<Debt>;
  createDebtsBatch(data: Omit<Debt, "debt_id">[]): Promise<Debt[]>;
  updateDebt(id: string, patch: Partial<Debt>): Promise<Debt>;
  deleteDebt(id: string): Promise<void>;
  bulkPayDebtorMonth(debtor_id: string, competencia: string): Promise<void>;

  // purchase plans
  getPurchasePlans(): Promise<PurchasePlan[]>;
  createPurchasePlan(
    data: Omit<PurchasePlan, "plan_id" | "created_at" | "updated_at">,
  ): Promise<PurchasePlan>;
  updatePurchasePlan(id: string, patch: Partial<PurchasePlan>): Promise<PurchasePlan>;
  deletePurchasePlan(id: string): Promise<void>;
}
