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
}
