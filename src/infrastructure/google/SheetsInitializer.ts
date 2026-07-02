const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

interface SheetSpec {
  title: string;
  headers: string[];
}

const SHEET_SPECS: SheetSpec[] = [
  {
    title: "transactions",
    headers: [
      "transaction_id",
      "template_id",
      "competencia",
      "descricao",
      "categoria_id",
      "valor",
      "status",
      "payment_account_id",
      "tipo_lancamento",
    ],
  },
  {
    title: "recurrence_templates",
    headers: [
      "template_id",
      "nome",
      "categoria_id",
      "payment_account_id",
      "primeira_competencia",
      "ultima_competencia",
      "logo_url",
      "icon_id",
      "recurrence_type",
    ],
  },
  {
    title: "accounts",
    headers: ["account_id", "nome", "tipo", "icon_id", "color"],
  },
  {
    title: "categories",
    headers: ["category_id", "nome", "icon_id"],
  },
  {
    title: "incomes",
    headers: ["income_id", "competencia", "descricao", "valor", "icon_id"],
  },
  {
    title: "invoice_amounts",
    headers: ["invoice_id", "payment_account_id", "competencia", "valor_real"],
  },
];

type CreatedSheet = { properties: { sheetId: number; title: string } };
type CreateResponse = { spreadsheetId: string; sheets: CreatedSheet[] };
type AddSheetReply = { replies: { addSheet?: { properties: { title: string; sheetId: number } } }[] };

export class SheetsInitializer {
  constructor(private readonly getAccessToken: () => string | null) {}

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const token = this.getAccessToken();
    if (!token) throw new Error("Sem token Google — faça login novamente.");
    const res = await fetch(url, {
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

  async createSpreadsheet(title: string): Promise<string> {
    const created = await this.request<CreateResponse>(SHEETS_API, {
      method: "POST",
      body: JSON.stringify({
        properties: { title },
        sheets: SHEET_SPECS.map((spec, idx) => ({
          properties: { sheetId: idx, title: spec.title, index: idx },
        })),
      }),
    });

    const { spreadsheetId, sheets } = created;

    const sheetIdMap: Record<string, number> = {};
    for (const s of sheets) {
      sheetIdMap[s.properties.title] = s.properties.sheetId;
    }

    const requests = SHEET_SPECS.map((spec) => ({
      updateCells: {
        range: {
          sheetId: sheetIdMap[spec.title],
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: spec.headers.length,
        },
        rows: [
          {
            values: spec.headers.map((h) => ({
              userEnteredValue: { stringValue: h },
            })),
          },
        ],
        fields: "userEnteredValue",
      },
    }));

    await this.request(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });

    return spreadsheetId;
  }

  async ensureSheets(spreadsheetId: string): Promise<void> {
    type SpreadsheetMeta = { sheets: CreatedSheet[] };
    const meta = await this.request<SpreadsheetMeta>(
      `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`,
    );

    const sheetIdMap = new Map<string, number>(
      meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]),
    );

    const missing = SHEET_SPECS.filter((spec) => !sheetIdMap.has(spec.title));
    if (missing.length > 0) {
      const result = await this.request<AddSheetReply>(
        `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          body: JSON.stringify({
            requests: missing.map((spec) => ({ addSheet: { properties: { title: spec.title } } })),
          }),
        },
      );
      for (const reply of result.replies) {
        if (reply.addSheet) {
          sheetIdMap.set(reply.addSheet.properties.title, reply.addSheet.properties.sheetId);
        }
      }
    }

    await this.request(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: SHEET_SPECS.map((spec) => ({
          updateCells: {
            range: {
              sheetId: sheetIdMap.get(spec.title)!,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: spec.headers.length,
            },
            rows: [{ values: spec.headers.map((h) => ({ userEnteredValue: { stringValue: h } })) }],
            fields: "userEnteredValue",
          },
        })),
      }),
    });
  }
}
