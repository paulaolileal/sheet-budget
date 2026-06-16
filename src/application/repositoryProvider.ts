import type { FinanceRepository } from "@/domain/repository";
import { GoogleSheetsRepository } from "@/infrastructure/google/GoogleSheetsRepository";
import { config } from "@/services/config";
import { getAccessToken } from "@/services/googleAuth";

let cached: FinanceRepository | null = null;

export function getRepository(): FinanceRepository {
  if (cached) return cached;
  cached = new GoogleSheetsRepository({
    spreadsheetId: config.spreadsheetId!,
    getAccessToken,
  });
  return cached;
}

export function resetRepository() {
  cached = null;
}
