import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { DriveApiClient } from "@/infrastructure/google/DriveApiClient";
import { SheetsInitializer } from "@/infrastructure/google/SheetsInitializer";
import { getAccessToken } from "@/services/googleAuth";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";
import { clearSheetProvider } from "@/application/repositoryProvider";

const FOLDER_NAME = "LealTEK Apps";
const SPREADSHEET_TITLE = "SheetBudget";

export function SetupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user)!;
  const setSpreadsheetId = useSpreadsheetStore((s) => s.setSpreadsheetId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function connect() {
      const drive = new DriveApiClient(getAccessToken);
      const found = await drive.listSpreadsheets(SPREADSHEET_TITLE);

      let spreadsheetId: string;
      if (found.length > 0) {
        spreadsheetId = found[0].id;
      } else {
        const initializer = new SheetsInitializer(getAccessToken);
        spreadsheetId = await initializer.createSpreadsheet(SPREADSHEET_TITLE);
        try {
          const folderId = await drive.getOrCreateFolder(FOLDER_NAME);
          await drive.moveToFolder(spreadsheetId, folderId);
        } catch {
          // Non-fatal: folder organization is cosmetic
        }
      }

      setSpreadsheetId(user.email, spreadsheetId);
      clearSheetProvider();
      qc.clear();
      navigate("/", { replace: true });
    }

    connect().catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo-bs.png" alt="Budget" className="h-12 w-12 object-contain rounded-md" />
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-sm text-center">
            {error}
          </p>
        ) : (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Conectando sua planilha…</p>
          </>
        )}
      </div>
    </div>
  );
}
