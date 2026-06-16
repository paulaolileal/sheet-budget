import type { FinanceRepository } from "@/domain/repository";
import { MockRepository } from "@/infrastructure/repositories/MockRepository";
import { GoogleSheetsRepository } from "@/infrastructure/google/GoogleSheetsRepository";
import { config } from "@/services/config";
import { getAccessToken } from "@/services/googleAuth";

let cached: FinanceRepository | null = null;

export function getRepository(): FinanceRepository {
  if (cached) return cached;
  if (config.useMock || !config.spreadsheetId) {
    cached = new MockRepository();
  } else {
    cached = new GoogleSheetsRepository({
      spreadsheetId: config.spreadsheetId,
      getAccessToken,
    });
  }
  return cached;
}

export function resetRepository() {
  cached = null;
}
