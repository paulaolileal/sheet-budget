import type { FinanceRepository } from "@/domain/repository";
import type {
  Account,
  Category,
  PaymentGroup,
  RecurrenceTemplate,
  Transaction,
} from "@/domain/types";
import { emptyToNull, loadCsv, parseBool, parseBRNumber } from "../csv";
import { transactionId } from "@/lib/idgen";

const STORAGE_KEY = "finapp:mock-state:v1";

interface MockState {
  transactions: Transaction[];
  templates: RecurrenceTemplate[];
  accounts: Account[];
  categories: Category[];
  paymentGroups: PaymentGroup[];
}

let stateCache: MockState | null = null;
let loadPromise: Promise<MockState> | null = null;

async function loadFromSeed(): Promise<MockState> {
  const [txRaw, tplRaw, accRaw, catRaw, pgRaw] = await Promise.all([
    loadCsv<Record<string, string>>("/seed/transactions.csv"),
    loadCsv<Record<string, string>>("/seed/recurrence_templates.csv"),
    loadCsv<Record<string, string>>("/seed/accounts.csv"),
    loadCsv<Record<string, string>>("/seed/categories.csv"),
    loadCsv<Record<string, string>>("/seed/payment_groups.csv"),
  ]);

  const transactions: Transaction[] = txRaw.map((r) => ({
    transaction_id: r.transaction_id,
    template_id: emptyToNull(r.template_id),
    competencia: r.competencia,
    descricao: r.descricao,
    categoria_id: r.categoria_id,
    valor_previsto: parseBRNumber(r.valor_previsto),
    valor_final: r.valor_final ? parseBRNumber(r.valor_final) : null,
    status: (r.status as Transaction["status"]) ?? "PLANEJADO",
    considerar_resumo: parseBool(r.considerar_resumo),
    payment_account_id: emptyToNull(r.payment_account_id),
    payment_group_id: emptyToNull(r.payment_group_id),
    tipo_lancamento: (r.tipo_lancamento as Transaction["tipo_lancamento"]) ?? "MANUAL",
    origem: r.origem ?? "",
  }));

  const templates: RecurrenceTemplate[] = tplRaw.map((r) => ({
    template_id: r.template_id,
    nome: r.nome,
    categoria_id: r.categoria_id,
    payment_account_id: emptyToNull(r.payment_account_id),
    considerar_resumo: parseBool(r.considerar_resumo),
    ativo: parseBool(r.ativo),
    primeira_competencia: r.primeira_competencia,
    ultima_competencia: r.ultima_competencia || undefined,
    valor_padrao: r.valor_padrao ? parseBRNumber(r.valor_padrao) : undefined,
  }));

  const accounts: Account[] = accRaw.map((r) => ({
    account_id: r.account_id,
    nome: r.nome,
    tipo: (r.tipo as Account["tipo"]) ?? "CONTA",
  }));

  const categories: Category[] = catRaw.map((r) => ({
    category_id: r.category_id,
    nome: r.nome,
  }));

  const paymentGroups: PaymentGroup[] = pgRaw.map((r) => ({
    payment_group_id: r.payment_group_id,
    nome: r.nome,
    payment_account_id: r.payment_account_id,
    competencia: r.competencia,
    status: (r.status as PaymentGroup["status"]) ?? "ABERTO",
  }));

  return { transactions, templates, accounts, categories, paymentGroups };
}

function persist(state: MockState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sem espaço — ignora */
  }
}

function loadFromStorage(): MockState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockState;
  } catch {
    return null;
  }
}

async function getState(): Promise<MockState> {
  if (stateCache) return stateCache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const fromStorage = loadFromStorage();
    if (fromStorage) {
      stateCache = fromStorage;
      return fromStorage;
    }
    const seeded = await loadFromSeed();
    stateCache = seeded;
    persist(seeded);
    return seeded;
  })();
  return loadPromise;
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export class MockRepository implements FinanceRepository {
  async getTransactions() {
    return (await getState()).transactions;
  }
  async createTransaction(t: Omit<Transaction, "transaction_id"> & { transaction_id?: string }) {
    const state = await getState();
    const tx: Transaction = {
      ...t,
      transaction_id: t.transaction_id ?? transactionId(t.competencia, t.descricao),
    };
    state.transactions = [...state.transactions, tx];
    persist(state);
    return tx;
  }
  async createTransactionsBatch(ts: (Omit<Transaction, "transaction_id"> & { transaction_id?: string })[]) {
    const state = await getState();
    const created: Transaction[] = ts.map((t) => ({
      ...t,
      transaction_id: t.transaction_id ?? transactionId(t.competencia, t.descricao),
    }));
    state.transactions = [...state.transactions, ...created];
    persist(state);
    return created;
  }
  async updateTransaction(id: string, patch: Partial<Transaction>) {
    const state = await getState();
    let updated: Transaction | undefined;
    state.transactions = state.transactions.map((t) => {
      if (t.transaction_id !== id) return t;
      updated = { ...t, ...patch, transaction_id: t.transaction_id };
      return updated;
    });
    if (!updated) throw new Error(`Transação ${id} não encontrada`);
    persist(state);
    return updated;
  }
  async deleteTransaction(id: string) {
    const state = await getState();
    state.transactions = state.transactions.filter((t) => t.transaction_id !== id);
    persist(state);
  }

  async getTemplates() {
    return (await getState()).templates;
  }
  async saveTemplate(t: RecurrenceTemplate) {
    const state = await getState();
    const exists = state.templates.some((x) => x.template_id === t.template_id);
    state.templates = exists
      ? state.templates.map((x) => (x.template_id === t.template_id ? t : x))
      : [...state.templates, t];
    persist(state);
    return t;
  }

  async getPaymentGroups() {
    return (await getState()).paymentGroups;
  }
  async markGroupPaid(id: string) {
    const state = await getState();
    state.paymentGroups = state.paymentGroups.map((g) =>
      g.payment_group_id === id ? { ...g, status: "PAGO" } : g,
    );
    state.transactions = state.transactions.map((t) => {
      if (t.payment_group_id !== id) return t;
      return {
        ...t,
        status: "PAGO",
        valor_final: t.valor_final ?? t.valor_previsto,
      };
    });
    persist(state);
  }

  async getAccounts() {
    return (await getState()).accounts;
  }
  async getCategories() {
    return (await getState()).categories;
  }
}
