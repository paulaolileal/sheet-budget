import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { DriveApiClient } from "@/infrastructure/google/DriveApiClient";
import { SheetsInitializer } from "@/infrastructure/google/SheetsInitializer";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";
import { clearSheetProvider } from "@/application/repositoryProvider";

const FOLDER_NAME = "LealTEK Apps";
const SPREADSHEET_TITLE = "SheetBudget";

const STEPS = ["Verificando sua planilha…", "Configurando estrutura…", "Quase lá…"] as const;

export function SetupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user)!;
  const setSpreadsheetId = useSpreadsheetStore((s) => s.setSpreadsheetId);
  const [error, setError] = useState<string | null>(null);
  const connectingRef = useRef(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (error) return;
    const t1 = setTimeout(() => setStep(1), 1800);
    const t2 = setTimeout(() => setStep(2), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [error]);

  useEffect(() => {
    if (connectingRef.current) return;
    connectingRef.current = true;

    async function connect() {
      const drive = new DriveApiClient();
      const initializer = new SheetsInitializer();
      const found = await drive.listSpreadsheets(SPREADSHEET_TITLE);

      let spreadsheetId: string;
      if (found.length > 0) {
        spreadsheetId = found[0].id;
        await initializer.ensureSheets(spreadsheetId);
      } else {
        spreadsheetId = await initializer.createSpreadsheet(SPREADSHEET_TITLE);
      }

      const folderId = await drive.getOrCreateFolder(FOLDER_NAME);
      await drive.moveToFolder(spreadsheetId, folderId);

      setSpreadsheetId(user.email, spreadsheetId);
      clearSheetProvider();
      qc.clear();
      navigate("/", { replace: true });
    }

    connect().catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="flex flex-col items-center gap-6 max-w-xs w-full text-center">
        <div className="flex items-center gap-3">
          <img src="/logo-bs.png" alt="Budget" className="h-10 w-10 object-contain rounded-md" />
          <div className="text-left">
            <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              lealtek
            </p>
            <p className="text-sm font-bold tracking-tight">Budget</p>
          </div>
        </div>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">{STEPS[step]}</p>
              <p className="text-xs text-muted-foreground mt-1">Conectando ao Google Drive</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
