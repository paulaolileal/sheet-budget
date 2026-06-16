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
  PaymentGroup,
  RecurrenceTemplate,
  Transaction,
} from "@/domain/types";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

const SHEETS = {
  transactions: "transactions",
  templates: "recurrence_templates",
  accounts: "accounts",
  categories: "categories",
  paymentGroups: "payment_groups",
} as const;

const TX_HEADERS = [
  "transaction_id",
  "template_id",
  "competencia",
  "descricao",
  "categoria_id",
  "valor_previsto",
  "valor_final",
  "status",
  "considerar_resumo",
  "payment_account_id",
  "payment_group_id",
  "tipo_lancamento",
  "origem",
];

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
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
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
      valor_previsto: Number(String(r.valor_previsto).replace(",", ".")) || 0,
      valor_final: r.valor_final ? Number(String(r.valor_final).replace(",", ".")) : null,
      status: r.status as Transaction["status"],
      considerar_resumo: String(r.considerar_resumo).toUpperCase() === "TRUE",
      payment_account_id: r.payment_account_id || null,
      payment_group_id: r.payment_group_id || null,
      tipo_lancamento: (r.tipo_lancamento as Transaction["tipo_lancamento"]) ?? "MANUAL",
      origem: r.origem ?? "",
    }));
  }

  private txToRow(t: Transaction): (string | number)[] {
    return [
      t.transaction_id,
      t.template_id ?? "",
      t.competencia,
      t.descricao,
      t.categoria_id,
      t.valor_previsto,
      t.valor_final ?? "",
      t.status,
      t.considerar_resumo ? "TRUE" : "FALSE",
      t.payment_account_id ?? "",
      t.payment_group_id ?? "",
      t.tipo_lancamento,
      t.origem,
    ];
  }

  async createTransaction(t: Omit<Transaction, "transaction_id"> & { transaction_id?: string }) {
    const tx: Transaction = {
      ...t,
      transaction_id: t.transaction_id ?? `tx-${Date.now()}`,
    };
    await this.request(
      `/values/${SHEETS.transactions}!A:M:append?valueInputOption=USER_ENTERED`,
      { method: "POST", body: JSON.stringify({ values: [this.txToRow(tx)] }) },
    );
    return tx;
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
      `/values/${SHEETS.transactions}!A${rowIdx}:M${rowIdx}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [this.txToRow(updated)] }) },
    );
    return updated;
  }

  async deleteTransaction(id: string) {
    // Marca como cancelado em vez de remover linha (preserva histórico).
    await this.updateTransaction(id, { status: "CANCELADO" });
  }

  async getTemplates(): Promise<RecurrenceTemplate[]> {
    const rows = await this.getValues(SHEETS.templates);
    return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
      template_id: r.template_id,
      nome: r.nome,
      categoria_id: r.categoria_id,
      payment_account_id: r.payment_account_id || null,
      considerar_resumo: String(r.considerar_resumo).toUpperCase() === "TRUE",
      ativo: String(r.ativo).toUpperCase() === "TRUE",
      primeira_competencia: r.primeira_competencia,
      ultima_competencia: r.ultima_competencia || undefined,
      valor_padrao: r.valor_padrao ? Number(String(r.valor_padrao).replace(",", ".")) : undefined,
    }));
  }

  async saveTemplate(t: RecurrenceTemplate) {
    const row = [
      t.template_id,
      t.nome,
      t.categoria_id,
      t.payment_account_id ?? "",
      t.considerar_resumo ? "TRUE" : "FALSE",
      t.ativo ? "TRUE" : "FALSE",
      t.primeira_competencia,
      t.ultima_competencia ?? "",
      t.valor_padrao ?? "",
    ];
    try {
      const idx = await this.findRowIndex(SHEETS.templates, "template_id", t.template_id);
      await this.request(
        `/values/${SHEETS.templates}!A${idx}:I${idx}?valueInputOption=USER_ENTERED`,
        { method: "PUT", body: JSON.stringify({ values: [row] }) },
      );
    } catch {
      await this.request(
        `/values/${SHEETS.templates}!A:I:append?valueInputOption=USER_ENTERED`,
        { method: "POST", body: JSON.stringify({ values: [row] }) },
      );
    }
    return t;
  }

  async getPaymentGroups(): Promise<PaymentGroup[]> {
    const rows = await this.getValues(SHEETS.paymentGroups);
    return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
      payment_group_id: r.payment_group_id,
      nome: r.nome,
      payment_account_id: r.payment_account_id,
      competencia: r.competencia,
      status: (r.status as PaymentGroup["status"]) ?? "ABERTO",
    }));
  }

  async markGroupPaid(id: string) {
    const idx = await this.findRowIndex(SHEETS.paymentGroups, "payment_group_id", id);
    await this.request(
      `/values/${SHEETS.paymentGroups}!E${idx}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [["PAGO"]] }) },
    );
    const txs = await this.getTransactions();
    const affected = txs.filter((t) => t.payment_group_id === id);
    for (const t of affected) {
      await this.updateTransaction(t.transaction_id, {
        status: "PAGO",
        valor_final: t.valor_final ?? t.valor_previsto,
      });
    }
  }

  async getAccounts(): Promise<Account[]> {
    const rows = await this.getValues(SHEETS.accounts);
    return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
      account_id: r.account_id,
      nome: r.nome,
      tipo: (r.tipo as Account["tipo"]) ?? "CONTA",
    }));
  }
  async getCategories(): Promise<Category[]> {
    const rows = await this.getValues(SHEETS.categories);
    return this.rowsToObjects<Record<string, string>>(rows).map((r) => ({
      category_id: r.category_id,
      nome: r.nome,
    }));
  }
}

export { TX_HEADERS, SHEETS };
