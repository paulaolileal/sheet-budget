/**
 * Implementação Google Sheets do FinanceRepository.
 *
 * Estratégia:
 * - Lê todas as abas via `values:batchGet`.
 * - Escreve por linha: localiza a linha pelo ID, faz PUT em values/{aba}!A{n}:M{n}
 *   ou append (POST values/{aba}!A:A:append) para novas linhas.
 *
 * Esta implementação assume que o frontend já recebeu um access_token via
 * Google Identity Services e o passou ao construtor (em memória, nunca em
 * localStorage).
 *
 * Para ativar:
 * 1. Crie um OAuth Client ID (tipo "Web") no Google Cloud Console.
 * 2. Habilite a Sheets API no projeto.
 * 3. Configure VITE_GOOGLE_CLIENT_ID e VITE_SPREADSHEET_ID.
 * 4. Troque o provider em src/application/repositoryProvider.ts.
 */

import type { FinanceRepository } from "@/domain/repository";
import type {
  Account,
  Category,
  Income,
  InvoiceAmount,
  RecurrenceTemplate,
  Transaction,
} from "@/domain/types";
import { accountId, categoryId, incomeId, transactionId } from "@/lib/idgen";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

function parseCurrency(raw: string): number {
  // Handles "20,9" (BR decimal) and plain "20.9"
  return Number(raw.trim().replace(/\./g, "").replace(",", ".")) || 0;
}

const SHEETS = {
  transactions: "transactions",
  templates: "recurrence_templates",
  accounts: "accounts",
  categories: "categories",
  incomes: "incomes",
  invoice_amounts: "invoice_amounts",
} as const;

const TX_HEADERS = [
  "transaction_id",
  "template_id",
  "competencia",
  "descricao",
  "categoria_id",
  "valor",
  "status",
  "payment_account_id",
  "tipo_lancamento",
];

/**
 * Returns true when the Sheets API error indicates the requested range/sheet
 * does not exist yet (HTTP 400 "Unable to parse range" or HTTP 404).
 * Used to silently return empty arrays for optional sheets.
 */
function isMissingSheetError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("Sheets API 400") ||
    msg.includes("Sheets API 404") ||
    msg.includes("Unable to parse range")
  );
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  getAccessToken: () => string | null;
}

export class GoogleSheetsRepository implements FinanceRepository {
  constructor(private readonly cfg: GoogleSheetsConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.cfg.getAccessToken();
    if (!token) throw new Error("Sem token Google — faça login novamente.");
    const res = await fetch(`${API}/${this.cfg.spreadsheetId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  private async getValues(range: string): Promise<string[][]> {
    const data = await this.request<{ values?: string[][] }>(`/values/${range}`);
    return data.values ?? [];
  }

  private rowsToObjects<T>(rows: string[][]): T[] {
    if (rows.length === 0) return [];
    const [headers, ...body] = rows;
    return body.map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h.trim()] = r[i] ?? ""));
      return obj as unknown as T;
    });
  }

  async getTransactions(): Promise<Transaction[]> {
    const rows = await this.getValues(SHEETS.transactions);
    const raw = this.rowsToObjects<Record<string, string>>(rows);
    return raw.map((r) => ({
      transaction_id: r.transaction_id,
      template_id: r.template_id || null,
      competencia: r.competencia,
      descricao: r.descricao,
      categoria_id: r.categoria_id,
      valor: parseCurrency(r.valor),
      status: r.status as Transaction["status"],
      payment_account_id: r.payment_account_id || null,
      tipo_lancamento: (r.tipo_lancamento as Transaction["tipo_lancamento"]) ?? "MANUAL",
    }));
  }

  private txToRow(t: Transaction): (string | number)[] {
    return [
      t.transaction_id,
      t.template_id ?? "",
      t.competencia,
      t.descricao,
      t.categoria_id,
      t.valor,
      t.status,
      t.payment_account_id ?? "",
      t.tipo_lancamento,
    ];
  }

  async createTransaction(t: Omit<Transaction, "transaction_id"> & { transaction_id?: string }) {
    const tx: Transaction = {
      ...t,
      transaction_id: t.transaction_id ?? transactionId(t.competencia, t.descricao),
    };
    await this.request(`/values/${SHEETS.transactions}!A:K:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({ values: [this.txToRow(tx)] }),
    });
    return tx;
  }

  async createTransactionsBatch(
    ts: (Omit<Transaction, "transaction_id"> & { transaction_id?: string })[],
  ) {
    const created: Transaction[] = ts.map((t) => ({
      ...t,
      transaction_id: t.transaction_id ?? transactionId(t.competencia, t.descricao),
    }));
    await this.request(`/values/${SHEETS.transactions}!A:K:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({ values: created.map((tx) => this.txToRow(tx)) }),
    });
    return created;
  }

  private async findRowIndex(sheet: string, idColumn: string, id: string): Promise<number> {
    const rows = await this.getValues(sheet);
    const headerIdx = rows[0]?.indexOf(idColumn) ?? -1;
    if (headerIdx < 0) throw new Error(`Cabeçalho ${idColumn} não encontrado em ${sheet}`);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][headerIdx] === id) return i + 1; // 1-indexed
    }
    throw new Error(`${idColumn}=${id} não encontrado em ${sheet}`);
  }

  async updateTransaction(id: string, patch: Partial<Transaction>) {
    const all = await this.getTransactions();
    const current = all.find((t) => t.transaction_id === id);
    if (!current) throw new Error(`Transação ${id} não encontrada`);
    const updated: Transaction = { ...current, ...patch, transaction_id: id };
    const rowIdx = await this.findRowIndex(SHEETS.transactions, "transaction_id", id);
    await this.request(
      `/values/${SHEETS.transactions}!A${rowIdx}:K${rowIdx}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [this.txToRow(updated)] }) },
    );
    return updated;
  }

  private async getSheetId(sheetName: string): Promise<number> {
    const data = await this.request<{
      sheets: { properties: { sheetId: number; title: string } }[];
    }>("");
    const sheet = data.sheets.find((s) => s.properties.title === sheetName);
    if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada na planilha`);
    return sheet.properties.sheetId;
  }

  async deleteTransaction(id: string) {
    const rowIdx = await this.findRowIndex(SHEETS.transactions, "transaction_id", id);
    const sheetId = await this.getSheetId(SHEETS.transactions);
    await this.request("/:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIdx - 1,
                endIndex: rowIdx,
              },
            },
          },
        ],
      }),
    });
  }

  async getTemplates(): Promise<RecurrenceTemplate[]> {
    const rows = await this.getValues(SHEETS.templates);
    return this.rowsToObjects<Record<string, string>>(rows)
      .filter((r) => !!r.template_id)
      .map((r) => ({
        template_id: r.template_id,
        nome: r.nome,
        categoria_id: r.categoria_id,
        payment_account_id: r.payment_account_id || null,
        primeira_competencia: r.primeira_competencia,
        ultima_competencia: r.ultima_competencia || undefined,
        logo_url: r.logo_url || undefined,
        icon_id: r.icon_id || undefined,
      }));
  }

  async saveTemplate(t: RecurrenceTemplate) {
    const row = [
      t.template_id,
      t.nome,
      t.categoria_id,
      t.payment_account_id ?? "",
      t.primeira_competencia,
      t.ultima_competencia ?? "",
      t.logo_url ?? "",
      t.icon_id ?? "",
    ];
    try {
      const idx = await this.findRowIndex(SHEETS.templates, "template_id", t.template_id);
      await this.request(
        `/values/${SHEETS.templates}!A${idx}:I${idx}?valueInputOption=USER_ENTERED`,
        { method: "PUT", body: JSON.stringify({ values: [row] }) },
      );
    } catch {
      await this.request(`/values/${SHEETS.templates}!A:I:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        body: JSON.stringify({ values: [row] }),
      });
    }
    return t;
  }

  async deleteTemplate(id: string): Promise<void> {
    const rowIdx = await this.findRowIndex(SHEETS.templates, "template_id", id);
    const sheetId = await this.getSheetId(SHEETS.templates);
    await this.request("/:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIdx - 1,
                endIndex: rowIdx,
              },
            },
          },
        ],
      }),
    });
  }

  async bulkPayByAccount(payment_account_id: string, competencia: string): Promise<void> {
    const txs = await this.getTransactions();
    const affected = txs.filter(
      (t) =>
        t.payment_account_id === payment_account_id &&
        t.competencia === competencia &&
        t.status !== "ADIANTADO" &&
        t.status !== "IGNORADO",
    );
    for (const t of affected) {
      await this.updateTransaction(t.transaction_id, { status: "PAGO" });
    }
  }

  async getAccounts(): Promise<Account[]> {
    const rows = await this.getValues(SHEETS.accounts);
    return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
      account_id: r.account_id,
      nome: r.nome,
      tipo: (r.tipo as Account["tipo"]) ?? "CONTA",
      icon_id: r.icon_id || undefined,
    }));
  }

  async createAccount(data: {
    nome: string;
    tipo: Account["tipo"];
    icon_id?: string;
  }): Promise<Account> {
    const account: Account = {
      account_id: accountId(data.nome),
      nome: data.nome,
      tipo: data.tipo,
      icon_id: data.icon_id,
    };
    await this.request(`/values/${SHEETS.accounts}!A:D:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({
        values: [[account.account_id, account.nome, account.tipo, account.icon_id ?? ""]],
      }),
    });
    return account;
  }

  async updateAccount(
    id: string,
    data: { nome: string; tipo: Account["tipo"]; icon_id?: string },
  ): Promise<Account> {
    const rowIdx = await this.findRowIndex(SHEETS.accounts, "account_id", id);
    await this.request(
      `/values/${SHEETS.accounts}!A${rowIdx}:D${rowIdx}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [[id, data.nome, data.tipo, data.icon_id ?? ""]] }),
      },
    );
    return { account_id: id, nome: data.nome, tipo: data.tipo, icon_id: data.icon_id };
  }

  async deleteAccount(id: string): Promise<void> {
    const rowIdx = await this.findRowIndex(SHEETS.accounts, "account_id", id);
    const sheetId = await this.getSheetId(SHEETS.accounts);
    await this.request("/:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIdx - 1,
                endIndex: rowIdx,
              },
            },
          },
        ],
      }),
    });
  }
  async getCategories(): Promise<Category[]> {
    const rows = await this.getValues(SHEETS.categories);
    return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
      category_id: r.category_id,
      nome: r.nome,
      icon_id: r.icon_id || undefined,
    }));
  }

  async createCategory(data: Omit<Category, "category_id">): Promise<Category> {
    const cat: Category = {
      category_id: categoryId(data.nome),
      nome: data.nome,
      icon_id: data.icon_id,
    };
    await this.request(`/values/${SHEETS.categories}!A:C:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({ values: [[cat.category_id, cat.nome, cat.icon_id ?? ""]] }),
    });
    return cat;
  }

  async updateCategory(cat: Category): Promise<void> {
    const rowIdx = await this.findRowIndex(SHEETS.categories, "category_id", cat.category_id);
    await this.request(
      `/values/${SHEETS.categories}!A${rowIdx}:C${rowIdx}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [[cat.category_id, cat.nome, cat.icon_id ?? ""]] }),
      },
    );
  }

  async deleteCategory(id: string): Promise<void> {
    const rowIdx = await this.findRowIndex(SHEETS.categories, "category_id", id);
    const sheetId = await this.getSheetId(SHEETS.categories);
    await this.request("/:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIdx - 1,
                endIndex: rowIdx,
              },
            },
          },
        ],
      }),
    });
  }

  async getIncomes(): Promise<Income[]> {
    try {
      const rows = await this.getValues(SHEETS.incomes);
      return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
        income_id: r.income_id,
        competencia: r.competencia,
        descricao: r.descricao,
        valor: parseCurrency(r.valor),
        icon_id: r.icon_id || undefined,
      }));
    } catch (err) {
      if (isMissingSheetError(err)) return [];
      throw err;
    }
  }

  private incomeToRow(i: Income): (string | number)[] {
    return [i.income_id, i.competencia, i.descricao, i.valor, i.icon_id ?? ""];
  }

  async createIncome(data: Omit<Income, "income_id">): Promise<Income> {
    const income: Income = {
      ...data,
      income_id: incomeId(data.competencia, data.descricao),
    };
    await this.request(`/values/${SHEETS.incomes}!A:E:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({ values: [this.incomeToRow(income)] }),
    });
    return income;
  }

  async updateIncome(id: string, patch: Partial<Omit<Income, "income_id">>): Promise<Income> {
    const all = await this.getIncomes();
    const current = all.find((i) => i.income_id === id);
    if (!current) throw new Error(`Receita ${id} não encontrada`);
    const updated: Income = { ...current, ...patch, income_id: id };
    const rowIdx = await this.findRowIndex(SHEETS.incomes, "income_id", id);
    await this.request(
      `/values/${SHEETS.incomes}!A${rowIdx}:E${rowIdx}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [this.incomeToRow(updated)] }) },
    );
    return updated;
  }

  async deleteIncome(id: string): Promise<void> {
    const rowIdx = await this.findRowIndex(SHEETS.incomes, "income_id", id);
    const sheetId = await this.getSheetId(SHEETS.incomes);
    await this.request("/:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: rowIdx - 1, endIndex: rowIdx },
            },
          },
        ],
      }),
    });
  }

  async getInvoiceAmounts(): Promise<InvoiceAmount[]> {
    try {
      const rows = await this.getValues(SHEETS.invoice_amounts);
      return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
        invoice_id: r.invoice_id,
        // spreadsheets created before the rename may have "account_id" instead of "payment_account_id"
        payment_account_id: r.payment_account_id || r.account_id,
        competencia: r.competencia,
        valor_real: parseCurrency(r.valor_real),
      }));
    } catch (err) {
      if (isMissingSheetError(err)) return [];
      throw err;
    }
  }

  async saveInvoiceAmount(data: Omit<InvoiceAmount, "invoice_id">): Promise<InvoiceAmount> {
    const invoice_id = `inv-${data.payment_account_id}-${data.competencia}`;
    const row = [invoice_id, data.payment_account_id, data.competencia, data.valor_real];
    try {
      const rowIdx = await this.findRowIndex(SHEETS.invoice_amounts, "invoice_id", invoice_id);
      await this.request(
        `/values/${SHEETS.invoice_amounts}!A${rowIdx}:D${rowIdx}?valueInputOption=USER_ENTERED`,
        { method: "PUT", body: JSON.stringify({ values: [row] }) },
      );
    } catch (err) {
      if (isMissingSheetError(err)) {
        throw new Error(
          "Crie a aba 'invoice_amounts' no Google Sheets com as colunas: invoice_id | payment_account_id | competencia | valor_real",
        );
      }
      // Row not found: append as new record
      await this.request(
        `/values/${SHEETS.invoice_amounts}!A:D:append?valueInputOption=USER_ENTERED`,
        { method: "POST", body: JSON.stringify({ values: [row] }) },
      );
    }
    return { invoice_id, ...data };
  }
}

export { TX_HEADERS, SHEETS };
