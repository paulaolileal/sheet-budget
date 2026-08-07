import { GoogleSheetsRepository } from "@/infrastructure/google/GoogleSheetsRepository";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";

let cached: { id: string; repo: GoogleSheetsRepository } | null = null;

export function getSheetProvider(): GoogleSheetsRepository {
  const email = useAuthStore.getState().user?.email;
  if (!email) throw new Error("Usuário não autenticado");

  const spreadsheetId = useSpreadsheetStore.getState().byEmail[email];
  if (!spreadsheetId) throw new Error("Planilha não configurada");

  if (cached?.id === spreadsheetId) return cached.repo;

  const repo = new GoogleSheetsRepository({ spreadsheetId });
  cached = { id: spreadsheetId, repo };
  return repo;
}

export function clearSheetProvider(): void {
  cached = null;
}
