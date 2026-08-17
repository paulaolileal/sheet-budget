import { GoogleSheetsRepository } from "@/infrastructure/google/GoogleSheetsRepository";
import { SheetsInitializer } from "@/infrastructure/google/SheetsInitializer";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";

let cached: { id: string; repo: GoogleSheetsRepository } | null = null;

/**
 * Self-healing: silently ensures every required tab/column exists on the user's
 * spreadsheet, once per session per spreadsheet id. This is what lets a new sheet
 * or a new column (e.g. `purchase_plans`, `Transaction.plan_id`) reach an
 * already-onboarded, in-production user without asking them to revisit `/setup`
 * or edit their Sheet by hand. Fire-and-forget and best-effort: reads/writes never
 * wait on it, and a failure here (e.g. the user revoked edit access) never breaks them —
 * it only means self-healing didn't happen this time, same as before this existed.
 */
function selfHealSchema(spreadsheetId: string): void {
  new SheetsInitializer().ensureSheets(spreadsheetId).catch((err) => {
    console.warn("[repositoryProvider] Schema self-heal failed:", err);
  });
}

export function getSheetProvider(): GoogleSheetsRepository {
  const email = useAuthStore.getState().user?.email;
  if (!email) throw new Error("Usuário não autenticado");

  const spreadsheetId = useSpreadsheetStore.getState().byEmail[email];
  if (!spreadsheetId) throw new Error("Planilha não configurada");

  if (cached?.id === spreadsheetId) return cached.repo;

  const repo = new GoogleSheetsRepository({ spreadsheetId });
  cached = { id: spreadsheetId, repo };
  selfHealSchema(spreadsheetId);
  return repo;
}

export function clearSheetProvider(): void {
  cached = null;
}
