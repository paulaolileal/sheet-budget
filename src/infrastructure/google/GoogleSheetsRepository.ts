/**
 * Implementação Google Sheets do FinanceRepository.
 *
 * Estratégia:
 * - Lê todas as abas via `values.get`.
 * - Escreve por linha: localiza a linha pelo ID, faz PUT em values/{aba}!A{n}:I{n}.
 * - Cria novas linhas via `values:append` (atômico, sem risco de race condition).
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
import { googleApiFetch } from "./googleApiFetch";
import type {
  Account,
  Category,
  Debt,
  Debtor,
  Income,
  InvoiceAmount,
  PurchasePlan,
  RecurrenceTemplate,
  RecurrenceType,
  Transaction,
} from "@/domain/types";
import {
  accountId,
  categoryId,
  debtId,
  debtorId,
  incomeId,
  planId,
  transactionId,
} from "@/lib/idgen";
import { parseCurrency } from "@/lib/currency";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

const SHEETS = {
  transactions: "transactions",
  templates: "recurrence_templates",
  accounts: "accounts",
  categories: "categories",
  incomes: "incomes",
  invoice_amounts: "invoice_amounts",
  debtors: "debtors",
  debts: "debts",
  purchase_plans: "purchase_plans",
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
  "plan_id",
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
}

export class GoogleSheetsRepository implements FinanceRepository {
  constructor(private readonly cfg: GoogleSheetsConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    return googleApiFetch<T>(`${API}/${this.cfg.spreadsheetId}${path}`, {
      ...init,
      apiLabel: "Sheets API",
    });
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
      // Sheet cells commonly carry stray whitespace from manual edits/paste;
      // untrimmed values break strict equality checks (e.g. competencia, tipo comparisons).
      headers.forEach((h, i) => (obj[h.trim()] = (r[i] ?? "").trim()));
      return obj as unknown as T;
    });
  }

  async getTransactions(): Promise<Transaction[]> {
    const rows = await this.getValues(SHEETS.transactions);
    if (rows.length === 0) return [];
    const [rawHeaders, ...body] = rows;
    const trimmedHeaders = rawHeaders.map((h) => h.trim());
    // Fall back to positional TX_HEADERS when the sheet header row is corrupted (e.g. A1 is blank/space)
    const headers = trimmedHeaders.includes("transaction_id") ? trimmedHeaders : TX_HEADERS;
    const seen = new Set<string>();
    return body
      .map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
        return {
          transaction_id: obj.transaction_id,
          template_id: obj.template_id || null,
          competencia: obj.competencia,
          descricao: obj.descricao,
          categoria_id: obj.categoria_id,
          valor: parseCurrency(obj.valor),
          status: obj.status as Transaction["status"],
          payment_account_id: obj.payment_account_id || null,
          tipo_lancamento: (obj.tipo_lancamento as Transaction["tipo_lancamento"]) ?? "MANUAL",
          plan_id: obj.plan_id || null,
        };
      })
      .filter((t) => {
        if (!t.transaction_id || !t.competencia) return false;
        if (seen.has(t.transaction_id)) return false;
        seen.add(t.transaction_id);
        return true;
      });
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
      t.plan_id ?? "",
    ];
  }

  async createTransaction(t: Omit<Transaction, "transaction_id"> & { transaction_id?: string }) {
    const tx: Transaction = {
      ...t,
      transaction_id: t.transaction_id ?? transactionId(t.competencia, t.descricao),
    };
    await this.request(`/values/${SHEETS.transactions}:append?valueInputOption=USER_ENTERED`, {
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
    await this.request(`/values/${SHEETS.transactions}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({ values: created.map((tx) => this.txToRow(tx)) }),
    });
    return created;
  }

  private async findRowIndex(sheet: string, idColumn: string, id: string): Promise<number> {
    const rows = await this.getValues(sheet);
    const trimmedHeaders = rows[0]?.map((h) => h.trim()) ?? [];
    let headerIdx = trimmedHeaders.indexOf(idColumn);
    // Fall back to TX_HEADERS positional index when the transactions header row is corrupted
    if (headerIdx < 0 && sheet === SHEETS.transactions) {
      headerIdx = TX_HEADERS.indexOf(idColumn);
    }
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
    if (rows.length === 0) return [];
    const [headerRow, ...body] = rows;
    const headerMap: Record<string, number> = {};
    headerRow.forEach((h, i) => (headerMap[h.trim()] = i));
    // Reads by header name when available, falls back to known column position.
    const col = (row: string[], name: string, fallback: number): string =>
      row[name in headerMap ? headerMap[name] : fallback] ?? "";

    return body
      .filter((r) => !!col(r, "template_id", 0))
      .map((r) => ({
        template_id: col(r, "template_id", 0),
        nome: col(r, "nome", 1),
        categoria_id: col(r, "categoria_id", 2),
        payment_account_id: col(r, "payment_account_id", 3) || null,
        primeira_competencia: col(r, "primeira_competencia", 4),
        ultima_competencia: col(r, "ultima_competencia", 5) || undefined,
        logo_url: col(r, "logo_url", 6) || undefined,
        icon_id: col(r, "icon_id", 7) || undefined,
        recurrence_type: (col(r, "recurrence_type", 8) as RecurrenceType) || "M",
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
      t.recurrence_type,
    ];
    try {
      const idx = await this.findRowIndex(SHEETS.templates, "template_id", t.template_id);
      await this.request(
        `/values/${SHEETS.templates}!A${idx}:I${idx}?valueInputOption=USER_ENTERED`,
        { method: "PUT", body: JSON.stringify({ values: [row] }) },
      );
    } catch {
      await this.request(`/values/${SHEETS.templates}:append?valueInputOption=USER_ENTERED`, {
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
      color: r.color || undefined,
    }));
  }

  async createAccount(data: {
    nome: string;
    tipo: Account["tipo"];
    icon_id?: string;
    color?: string;
  }): Promise<Account> {
    const account: Account = {
      account_id: accountId(data.nome),
      nome: data.nome,
      tipo: data.tipo,
      icon_id: data.icon_id,
      color: data.color,
    };
    await this.request(`/values/${SHEETS.accounts}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({
        values: [
          [
            account.account_id,
            account.nome,
            account.tipo,
            account.icon_id ?? "",
            account.color ?? "",
          ],
        ],
      }),
    });
    return account;
  }

  async updateAccount(
    id: string,
    data: { nome: string; tipo: Account["tipo"]; icon_id?: string; color?: string },
  ): Promise<Account> {
    const rowIdx = await this.findRowIndex(SHEETS.accounts, "account_id", id);
    await this.request(
      `/values/${SHEETS.accounts}!A${rowIdx}:E${rowIdx}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({
          values: [[id, data.nome, data.tipo, data.icon_id ?? "", data.color ?? ""]],
        }),
      },
    );
    return {
      account_id: id,
      nome: data.nome,
      tipo: data.tipo,
      icon_id: data.icon_id,
      color: data.color,
    };
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
    await this.request(`/values/${SHEETS.categories}:append?valueInputOption=USER_ENTERED`, {
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
    await this.request(`/values/${SHEETS.incomes}:append?valueInputOption=USER_ENTERED`, {
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
      await this.request(`/values/${SHEETS.invoice_amounts}:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        body: JSON.stringify({ values: [row] }),
      });
    }
    return { invoice_id, ...data };
  }

  async getDebtors(): Promise<Debtor[]> {
    try {
      const rows = await this.getValues(SHEETS.debtors);
      return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
        debtor_id: r.debtor_id,
        nome: r.nome,
        telefone: r.telefone || undefined,
        icon_id: r.icon_id || undefined,
      }));
    } catch (err) {
      if (isMissingSheetError(err)) return [];
      throw err;
    }
  }

  private debtorToRow(d: Debtor): (string | number)[] {
    return [d.debtor_id, d.nome, d.telefone ?? "", d.icon_id ?? ""];
  }

  async createDebtor(data: Omit<Debtor, "debtor_id">): Promise<Debtor> {
    const debtor: Debtor = { ...data, debtor_id: debtorId(data.nome) };
    try {
      await this.request(`/values/${SHEETS.debtors}:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        body: JSON.stringify({ values: [this.debtorToRow(debtor)] }),
      });
    } catch (err) {
      if (isMissingSheetError(err)) {
        throw new Error(
          "Crie a aba 'debtors' no Google Sheets com as colunas: debtor_id | nome | telefone | icon_id",
        );
      }
      throw err;
    }
    return debtor;
  }

  async updateDebtor(id: string, patch: Partial<Omit<Debtor, "debtor_id">>): Promise<Debtor> {
    const all = await this.getDebtors();
    const current = all.find((d) => d.debtor_id === id);
    if (!current) throw new Error(`Devedor ${id} não encontrado`);
    const updated: Debtor = { ...current, ...patch, debtor_id: id };
    const rowIdx = await this.findRowIndex(SHEETS.debtors, "debtor_id", id);
    await this.request(
      `/values/${SHEETS.debtors}!A${rowIdx}:D${rowIdx}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [this.debtorToRow(updated)] }) },
    );
    return updated;
  }

  async deleteDebtor(id: string): Promise<void> {
    const debts = await this.getDebts();
    if (debts.some((d) => d.debtor_id === id)) {
      throw new Error("Exclua as dívidas desse devedor antes de removê-lo.");
    }
    const rowIdx = await this.findRowIndex(SHEETS.debtors, "debtor_id", id);
    const sheetId = await this.getSheetId(SHEETS.debtors);
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

  async getDebts(): Promise<Debt[]> {
    try {
      const rows = await this.getValues(SHEETS.debts);
      return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
        debt_id: r.debt_id,
        debtor_id: r.debtor_id,
        competencia: r.competencia,
        descricao: r.descricao,
        valor: parseCurrency(r.valor),
        status: (r.status as Debt["status"]) || "PENDENTE",
        tipo: (r.tipo as Debt["tipo"]) || "UNICO",
        parent_debt_id: r.parent_debt_id || undefined,
      }));
    } catch (err) {
      if (isMissingSheetError(err)) return [];
      throw err;
    }
  }

  private debtToRow(d: Debt): (string | number)[] {
    return [
      d.debt_id,
      d.debtor_id,
      d.competencia,
      d.descricao,
      d.valor,
      d.status,
      d.tipo,
      d.parent_debt_id ?? "",
    ];
  }

  async bulkPayDebtorMonth(debtor_id: string, competencia: string): Promise<void> {
    const debts = await this.getDebts();
    const affected = debts.filter(
      (d) =>
        d.debtor_id === debtor_id &&
        d.competencia === competencia &&
        d.status !== "PAGO" &&
        d.tipo !== "EMPRESTIMO",
    );
    for (const d of affected) {
      await this.updateDebt(d.debt_id, { status: "PAGO" });
    }
  }

  async createDebt(data: Omit<Debt, "debt_id">): Promise<Debt> {
    const debt: Debt = { ...data, debt_id: debtId(data.competencia, data.descricao) };
    try {
      await this.request(`/values/${SHEETS.debts}:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        body: JSON.stringify({ values: [this.debtToRow(debt)] }),
      });
    } catch (err) {
      if (isMissingSheetError(err)) {
        throw new Error(
          "Crie a aba 'debts' no Google Sheets com as colunas: debt_id | debtor_id | competencia | descricao | valor | status | tipo | parent_debt_id",
        );
      }
      throw err;
    }
    return debt;
  }

  async createDebtsBatch(data: Omit<Debt, "debt_id">[]): Promise<Debt[]> {
    const created: Debt[] = data.map((d) => ({
      ...d,
      debt_id: debtId(d.competencia, d.descricao),
    }));
    await this.request(`/values/${SHEETS.debts}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({ values: created.map((d) => this.debtToRow(d)) }),
    });
    return created;
  }

  async updateDebt(id: string, patch: Partial<Debt>): Promise<Debt> {
    const all = await this.getDebts();
    const current = all.find((d) => d.debt_id === id);
    if (!current) throw new Error(`Dívida ${id} não encontrada`);
    const updated: Debt = { ...current, ...patch, debt_id: id };
    const rowIdx = await this.findRowIndex(SHEETS.debts, "debt_id", id);
    await this.request(
      `/values/${SHEETS.debts}!A${rowIdx}:H${rowIdx}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [this.debtToRow(updated)] }) },
    );
    return updated;
  }

  async deleteDebt(id: string): Promise<void> {
    const debts = await this.getDebts();
    if (debts.some((d) => d.parent_debt_id === id)) {
      throw new Error("Exclua os abatimentos desse empréstimo antes de removê-lo.");
    }
    const rowIdx = await this.findRowIndex(SHEETS.debts, "debt_id", id);
    const sheetId = await this.getSheetId(SHEETS.debts);
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

  async getPurchasePlans(): Promise<PurchasePlan[]> {
    try {
      const rows = await this.getValues(SHEETS.purchase_plans);
      return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
        plan_id: r.plan_id,
        nome: r.nome,
        descricao: r.descricao || undefined,
        valor_compra: parseCurrency(r.valor_compra),
        valor_entrada: parseCurrency(r.valor_entrada),
        taxa_juros: Number(r.taxa_juros) || 0,
        taxa_juros_periodicidade:
          (r.taxa_juros_periodicidade as PurchasePlan["taxa_juros_periodicidade"]) || "MENSAL",
        numero_parcelas: Number(r.numero_parcelas) || 1,
        forma_amortizacao: (r.forma_amortizacao as PurchasePlan["forma_amortizacao"]) || "PRICE",
        competencia_inicio: r.competencia_inicio,
        margem_minima: parseCurrency(r.margem_minima),
        categoria_id: r.categoria_id || undefined,
        payment_account_id: r.payment_account_id || undefined,
        status: (r.status as PurchasePlan["status"]) || "RASCUNHO",
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    } catch (err) {
      if (isMissingSheetError(err)) return [];
      throw err;
    }
  }

  private purchasePlanToRow(p: PurchasePlan): (string | number)[] {
    return [
      p.plan_id,
      p.nome,
      p.descricao ?? "",
      p.valor_compra,
      p.valor_entrada,
      p.taxa_juros,
      p.taxa_juros_periodicidade,
      p.numero_parcelas,
      p.forma_amortizacao,
      p.competencia_inicio,
      p.margem_minima,
      p.categoria_id ?? "",
      p.payment_account_id ?? "",
      p.status,
      p.created_at,
      p.updated_at,
    ];
  }

  async createPurchasePlan(
    data: Omit<PurchasePlan, "plan_id" | "created_at" | "updated_at">,
  ): Promise<PurchasePlan> {
    const now = new Date().toISOString();
    const plan: PurchasePlan = {
      ...data,
      plan_id: planId(data.nome),
      created_at: now,
      updated_at: now,
    };
    try {
      await this.request(`/values/${SHEETS.purchase_plans}:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        body: JSON.stringify({ values: [this.purchasePlanToRow(plan)] }),
      });
    } catch (err) {
      if (isMissingSheetError(err)) {
        throw new Error(
          "Crie a aba 'purchase_plans' no Google Sheets com as colunas: plan_id | nome | descricao | valor_compra | valor_entrada | taxa_juros | taxa_juros_periodicidade | numero_parcelas | forma_amortizacao | competencia_inicio | margem_minima | categoria_id | payment_account_id | status | created_at | updated_at",
        );
      }
      throw err;
    }
    return plan;
  }

  async updatePurchasePlan(id: string, patch: Partial<PurchasePlan>): Promise<PurchasePlan> {
    const all = await this.getPurchasePlans();
    const current = all.find((p) => p.plan_id === id);
    if (!current) throw new Error(`Planejamento ${id} não encontrado`);
    const updated: PurchasePlan = {
      ...current,
      ...patch,
      plan_id: id,
      updated_at: new Date().toISOString(),
    };
    const rowIdx = await this.findRowIndex(SHEETS.purchase_plans, "plan_id", id);
    await this.request(
      `/values/${SHEETS.purchase_plans}!A${rowIdx}:P${rowIdx}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [this.purchasePlanToRow(updated)] }) },
    );
    return updated;
  }

  async deletePurchasePlan(id: string): Promise<void> {
    const rowIdx = await this.findRowIndex(SHEETS.purchase_plans, "plan_id", id);
    const sheetId = await this.getSheetId(SHEETS.purchase_plans);
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
}

export { TX_HEADERS, SHEETS };
